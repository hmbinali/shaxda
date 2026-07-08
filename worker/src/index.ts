import {
  appMetadata,
  healthResponseSchema,
  protocolVersion,
  roomCodeSchema,
  serverMessageSchema,
} from "@shaxda/shared";
import { MatchRoom } from "./match-room";
import { RoomCoordinator } from "./room-coordinator";
import { generateRoomCode } from "./room-code";
import { verifyTurnstile } from "./turnstile";
import { z } from "zod";

const MAX_ROOM_CREATION_ATTEMPTS = 5;
const COORDINATOR_NAME = "global";

const createRoomRequestSchema = z.object({
  turnstileToken: z.string().min(1).max(4096).optional(),
});

const coordinatorReserveResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      "rateLimited",
      "tooManyRooms",
      "capacityFull",
      "roomCodeTaken",
    ]),
  }),
]);

type PublicCreateRoomErrorCode =
  | "rateLimited"
  | "tooManyRooms"
  | "capacityFull"
  | "turnstileFailed"
  | "createFailed";

interface Env {
  MATCH_ROOM: DurableObjectNamespace;
  MATCH_COORDINATOR: DurableObjectNamespace;
  ALLOWED_ORIGIN?: string;
  TURNSTILE_SECRET?: string;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname === "/rooms") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (url.pathname === "/health") {
      return Response.json(
        healthResponseSchema.parse({ ok: true, service: appMetadata.id }),
      );
    }

    if (request.method === "POST" && url.pathname === "/rooms") {
      const createRequest = createRoomRequestSchema.safeParse(
        await request.json().catch(() => ({})),
      );
      if (!createRequest.success) {
        return withCors(createErrorResponse("createFailed", 400), env);
      }

      const ip = clientIp(request);
      const turnstileOk = await verifyTurnstile(
        createRequest.data.turnstileToken,
        env.TURNSTILE_SECRET,
        ip,
      );
      if (!turnstileOk) {
        return withCors(createErrorResponse("turnstileFailed", 403), env);
      }

      const coordinator = env.MATCH_COORDINATOR.get(
        env.MATCH_COORDINATOR.idFromName(COORDINATOR_NAME),
      );

      for (
        let attempt = 0;
        attempt < MAX_ROOM_CREATION_ATTEMPTS;
        attempt += 1
      ) {
        const roomCode = generateRoomCode();
        const reserve = await reserveRoom(
          coordinator,
          url.origin,
          ip,
          roomCode,
        );
        if (!reserve.ok) {
          if (reserve.code === "roomCodeTaken") {
            continue;
          }

          return withCors(
            createErrorResponse(
              reserve.code,
              reserve.code === "capacityFull" ? 503 : 429,
            ),
            env,
          );
        }

        const id = env.MATCH_ROOM.idFromName(roomCode);
        const room = env.MATCH_ROOM.get(id);
        const initResponse = await room.fetch(
          new Request(new URL("/internal/rooms/init", url.origin), {
            method: "POST",
            body: JSON.stringify({ roomCode }),
            headers: { "Content-Type": "application/json" },
          }),
        );

        if (initResponse.status === 409) {
          await releaseRoom(coordinator, url.origin, roomCode);
          continue;
        }

        if (!initResponse.ok) {
          await releaseRoom(coordinator, url.origin, roomCode);
          return withCors(createErrorResponse("createFailed", 500), env);
        }

        return withCors(
          Response.json(
            serverMessageSchema.parse({
              v: protocolVersion,
              type: "roomCreated",
              roomCode,
            }),
          ),
          env,
        );
      }

      return withCors(createErrorResponse("capacityFull", 503), env);
    }

    const roomMatch = /^\/rooms\/([^/]+)\/ws$/.exec(url.pathname);
    if (request.method === "GET" && roomMatch) {
      const roomCode = roomCodeSchema.safeParse(roomMatch[1]);
      if (!roomCode.success) {
        return Response.json({ error: "Invalid room code" }, { status: 400 });
      }

      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return Response.json(
          { error: "Expected WebSocket upgrade" },
          { status: 426 },
        );
      }

      const id = env.MATCH_ROOM.idFromName(roomCode.data);
      const room = env.MATCH_ROOM.get(id);
      return room.fetch(request);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function reserveRoom(
  coordinator: DurableObjectStub,
  origin: string,
  ip: string,
  roomCode: string,
): Promise<z.infer<typeof coordinatorReserveResponseSchema>> {
  const response = await coordinator.fetch(
    new Request(new URL("/internal/coordinator/reserve", origin), {
      method: "POST",
      body: JSON.stringify({ ip, roomCode }),
      headers: { "Content-Type": "application/json" },
    }),
  );

  return coordinatorReserveResponseSchema.parse(await response.json());
}

async function releaseRoom(
  coordinator: DurableObjectStub,
  origin: string,
  roomCode: string,
): Promise<void> {
  await coordinator.fetch(
    new Request(new URL("/internal/coordinator/release", origin), {
      method: "POST",
      body: JSON.stringify({ roomCode }),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "local"
  );
}

function createErrorResponse(
  code: PublicCreateRoomErrorCode,
  status: number,
): Response {
  return Response.json({ error: code, code }, { status });
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function withCors(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(env))) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default worker;
export { MatchRoom, RoomCoordinator };
