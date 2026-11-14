import { roomCodeSchema } from "@shaxda/shared";
import { z } from "zod";

export const CREATE_WINDOW_MS = 60_000;
export const CREATE_MAX_PER_IP = 10;
export const ACTIVE_MAX_PER_IP = 5;
export const ACTIVE_MAX_GLOBAL = 500;
export const ACTIVE_ROOM_TTL_MS = 70 * 60 * 1_000;

const COORDINATOR_STATE_KEY = "coordinator";

const reserveRequestSchema = z.object({
  ip: z.string().min(1).max(128),
  roomCode: z.string().min(1).max(64),
});

const releaseRequestSchema = z.object({
  roomCode: z.string().min(1).max(64),
  roomCreatedAt: z.number().int().optional(),
});
const holdRequestSchema = z.object({
  roomCode: roomCodeSchema,
  roomCreatedAt: z.number().int(),
  holdsUnsaved: z.boolean(),
});

type CoordinatorDenyCode =
  "rateLimited" | "tooManyRooms" | "capacityFull" | "roomCodeTaken";

type CoordinatorState = {
  createAttemptsByIp: Record<string, number[]>;
  activeRooms: Record<
    string,
    {
      ip: string | null;
      createdAt: number;
      roomCreatedAt?: number;
      holdsUnsaved?: true;
    }
  >;
};

export class RoomCoordinator implements DurableObject {
  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "POST" &&
      url.pathname === "/internal/coordinator/reserve"
    ) {
      return this.reserve(request);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/internal/coordinator/release"
    ) {
      return this.release(request);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/internal/coordinator/hold"
    ) {
      return this.hold(request);
    }
    if (
      request.method === "GET" &&
      url.pathname === "/internal/coordinator/unsaved"
    ) {
      const after = url.searchParams.get("after");
      if (after !== null && !roomCodeSchema.safeParse(after).success) {
        return Response.json({ error: "invalidRequest" }, { status: 400 });
      }
      const state = await this.readState();
      const codes = Object.keys(state.activeRooms)
        .sort()
        .filter(
          (code) =>
            state.activeRooms[code]?.holdsUnsaved &&
            (after === null || code > after),
        )
        .slice(0, 51);
      const rooms = codes.slice(0, 50);
      return Response.json({
        rooms,
        nextAfter: codes.length > 50 ? rooms.at(-1) : null,
      });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const state = await this.readState();
    const pruned = this.pruneState(state, Date.now());
    await this.persistState(pruned);
  }

  private async reserve(request: Request): Promise<Response> {
    const parsed = reserveRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        { ok: false, code: "invalidRequest" },
        { status: 400 },
      );
    }

    const now = Date.now();
    const state = this.pruneState(await this.readState(), now);
    const result = this.reserveRoom(
      state,
      parsed.data.ip,
      parsed.data.roomCode,
      now,
    );
    await this.persistState(result.state);

    if (!result.ok) {
      return Response.json({ ok: false, code: result.code });
    }

    return Response.json({ ok: true });
  }

  private async release(request: Request): Promise<Response> {
    const parsed = releaseRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        { ok: false, code: "invalidRequest" },
        { status: 400 },
      );
    }

    const state = await this.readState();
    const activeRooms = { ...state.activeRooms };
    const current = activeRooms[parsed.data.roomCode];
    if (
      current?.holdsUnsaved &&
      current.roomCreatedAt !== parsed.data.roomCreatedAt
    ) {
      return Response.json({ ok: true });
    }
    if (
      parsed.data.roomCreatedAt !== undefined &&
      current?.roomCreatedAt !== undefined &&
      current.roomCreatedAt !== parsed.data.roomCreatedAt
    ) {
      return Response.json({ ok: true });
    }
    delete activeRooms[parsed.data.roomCode];
    await this.persistState({ ...state, activeRooms });

    return Response.json({ ok: true });
  }

  private async hold(request: Request): Promise<Response> {
    const parsed = holdRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return Response.json({ error: "invalidRequest" }, { status: 400 });
    const { roomCode, roomCreatedAt, holdsUnsaved } = parsed.data;
    const now = Date.now();
    const state = this.pruneState(await this.readState(), now);
    const current = state.activeRooms[roomCode];
    if (
      current?.roomCreatedAt !== undefined &&
      current.roomCreatedAt !== roomCreatedAt
    ) {
      return Response.json({ error: "roomMismatch" }, { status: 409 });
    }

    if (holdsUnsaved) {
      state.activeRooms[roomCode] = {
        ip: current?.ip ?? null,
        createdAt: current?.createdAt ?? roomCreatedAt,
        roomCreatedAt,
        holdsUnsaved: true,
      };
    } else if (current) {
      if (
        now - current.createdAt >= ACTIVE_ROOM_TTL_MS ||
        current.ip === null
      ) {
        delete state.activeRooms[roomCode];
      } else {
        const { ip, createdAt } = current;
        state.activeRooms[roomCode] = { ip, createdAt, roomCreatedAt };
      }
    }
    await this.persistState(state);
    return Response.json({ ok: true });
  }

  private reserveRoom(
    state: CoordinatorState,
    ip: string,
    roomCode: string,
    now: number,
  ):
    | { ok: true; state: CoordinatorState }
    | { ok: false; code: CoordinatorDenyCode; state: CoordinatorState } {
    if (state.activeRooms[roomCode]) {
      return { ok: false, code: "roomCodeTaken", state };
    }

    const attempts = state.createAttemptsByIp[ip] ?? [];
    if (attempts.length >= CREATE_MAX_PER_IP) {
      return { ok: false, code: "rateLimited", state };
    }

    const activeRooms = Object.values(state.activeRooms).filter(
      (room) => !room.holdsUnsaved,
    );
    const activeRoomCount = activeRooms.length;
    if (activeRoomCount >= ACTIVE_MAX_GLOBAL) {
      return { ok: false, code: "capacityFull", state };
    }

    const activeForIp = activeRooms.filter((room) => room.ip === ip).length;
    if (activeForIp >= ACTIVE_MAX_PER_IP) {
      return { ok: false, code: "tooManyRooms", state };
    }

    return {
      ok: true,
      state: {
        createAttemptsByIp: {
          ...state.createAttemptsByIp,
          [ip]: [...attempts, now].slice(-CREATE_MAX_PER_IP),
        },
        activeRooms: {
          ...state.activeRooms,
          [roomCode]: { ip, createdAt: now },
        },
      },
    };
  }

  private pruneState(state: CoordinatorState, now: number): CoordinatorState {
    const createAttemptsByIp: Record<string, number[]> = {};
    for (const [ip, attempts] of Object.entries(state.createAttemptsByIp)) {
      const recent = attempts
        .filter((timestamp) => now - timestamp < CREATE_WINDOW_MS)
        .slice(-CREATE_MAX_PER_IP);
      if (recent.length > 0) {
        createAttemptsByIp[ip] = recent;
      }
    }

    const activeRooms: CoordinatorState["activeRooms"] = {};
    for (const [roomCode, room] of Object.entries(state.activeRooms)) {
      if (room.holdsUnsaved || now - room.createdAt < ACTIVE_ROOM_TTL_MS) {
        activeRooms[roomCode] = room;
      }
    }

    return { createAttemptsByIp, activeRooms };
  }

  private async readState(): Promise<CoordinatorState> {
    const stored = await this.ctx.storage.get<Partial<CoordinatorState>>(
      COORDINATOR_STATE_KEY,
    );

    return {
      createAttemptsByIp: stored?.createAttemptsByIp ?? {},
      activeRooms: stored?.activeRooms ?? {},
    };
  }

  private async persistState(state: CoordinatorState): Promise<void> {
    await this.ctx.storage.put(COORDINATOR_STATE_KEY, state);
    await this.scheduleAlarm(state);
  }

  private async scheduleAlarm(state: CoordinatorState): Promise<void> {
    const activeRooms = Object.values(state.activeRooms).filter(
      (room) => !room.holdsUnsaved,
    );
    if (activeRooms.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.ctx.storage.setAlarm(
      Math.min(
        ...activeRooms.map((room) => room.createdAt + ACTIVE_ROOM_TTL_MS),
      ),
    );
  }
}
