import {
  echoBroadcastServerMessageSchema,
  guestIdSchema,
  joinedServerMessageSchema,
  protocolVersion,
  serverMessageSchema,
} from "@shaxda/shared";
import { roomInboundSchema, roomInitRequestSchema } from "./protocol";
import type { PlayerSlot, RoomInboundMessage } from "./protocol";

const ROOM_STATE_KEY = "room";
const IDLE_TIMEOUT_MS = 60 * 60 * 1_000;

type RoomState = {
  roomCode: string;
  createdAt: number;
  lastActivityAt: number;
  slots: Partial<Record<PlayerSlot, string>>;
};

type SocketAttachment = {
  guestId: string;
  slot: PlayerSlot;
};

export class MatchRoom implements DurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: unknown,
  ) {
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/internal/rooms/init") {
      return this.initializeRoom(request);
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json(
        { error: "Expected WebSocket upgrade" },
        { status: 426 },
      );
    }

    const room = await this.ctx.storage.get<RoomState>(ROOM_STATE_KEY);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    await this.refreshActivity(room);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const parsed = parseMessage(message);
    if (!parsed.ok) {
      this.sendError(ws, "invalidMessage", parsed.message);
      return;
    }

    const room = await this.ctx.storage.get<RoomState>(ROOM_STATE_KEY);
    if (!room) {
      this.sendError(ws, "roomNotFound", "Room not found.");
      return;
    }

    await this.refreshActivity(room);

    switch (parsed.message.type) {
      case "joinRoom":
        await this.handleJoin(ws, room, parsed.message);
        return;
      case "ping":
        ws.send(
          JSON.stringify(
            serverMessageSchema.parse({
              v: protocolVersion,
              type: "pong",
              nonce: parsed.message.nonce,
            }),
          ),
        );
        return;
      case "echo":
        this.handleEcho(ws, room, parsed.message);
        return;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.refreshStoredActivity();
    ws.serializeAttachment(null);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.refreshStoredActivity();
    ws.serializeAttachment(null);
  }

  async alarm(): Promise<void> {
    const room = await this.ctx.storage.get<RoomState>(ROOM_STATE_KEY);
    if (!room) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const now = Date.now();
    if (now - room.lastActivityAt < IDLE_TIMEOUT_MS) {
      await this.ctx.storage.setAlarm(room.lastActivityAt + IDLE_TIMEOUT_MS);
      return;
    }

    for (const socket of this.ctx.getWebSockets()) {
      socket.close(1001, "Room expired.");
    }

    await this.ctx.storage.deleteAll();
  }

  private async initializeRoom(request: Request): Promise<Response> {
    const body = roomInitRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!body.success) {
      return Response.json(
        { error: "Invalid room init payload" },
        { status: 400 },
      );
    }

    const existingRoom = await this.ctx.storage.get<RoomState>(ROOM_STATE_KEY);
    if (existingRoom) {
      return Response.json(
        { error: "Room code already exists" },
        { status: 409 },
      );
    }

    const now = Date.now();
    const room: RoomState = {
      roomCode: body.data.roomCode,
      createdAt: now,
      lastActivityAt: now,
      slots: {},
    };

    await this.ctx.storage.put(ROOM_STATE_KEY, room);
    await this.ctx.storage.setAlarm(now + IDLE_TIMEOUT_MS);

    return Response.json({ ok: true });
  }

  private async handleJoin(
    ws: WebSocket,
    room: RoomState,
    message: Extract<RoomInboundMessage, { type: "joinRoom" }>,
  ): Promise<void> {
    if (message.roomCode !== room.roomCode) {
      this.sendError(ws, "roomMismatch", "Room code does not match this room.");
      return;
    }

    const slot = await this.assignSlot(room, message.guestId);
    if (!slot) {
      this.sendError(ws, "roomFull", "Room already has two guests.");
      return;
    }

    ws.serializeAttachment({
      guestId: message.guestId,
      slot,
    } satisfies SocketAttachment);
    ws.send(
      JSON.stringify(
        joinedServerMessageSchema.parse({
          v: protocolVersion,
          type: "joined",
          roomCode: room.roomCode,
          guestId: message.guestId,
          slot,
        }),
      ),
    );
  }

  private handleEcho(
    ws: WebSocket,
    room: RoomState,
    message: Extract<RoomInboundMessage, { type: "echo" }>,
  ): void {
    if (message.roomCode !== room.roomCode) {
      this.sendError(ws, "roomMismatch", "Room code does not match this room.");
      return;
    }

    const attachment = socketAttachment(ws);
    if (!attachment) {
      this.sendError(
        ws,
        "notJoined",
        "Join the room before sending echo messages.",
      );
      return;
    }

    const broadcast = JSON.stringify(
      echoBroadcastServerMessageSchema.parse({
        v: protocolVersion,
        type: "echoBroadcast",
        roomCode: room.roomCode,
        fromGuestId: attachment.guestId,
        payload: message.payload,
      }),
    );

    for (const socket of this.ctx.getWebSockets()) {
      if (socketAttachment(socket)) {
        socket.send(broadcast);
      }
    }
  }

  private async assignSlot(
    room: RoomState,
    guestId: string,
  ): Promise<PlayerSlot | null> {
    if (room.slots.A === guestId) {
      return "A";
    }

    if (room.slots.B === guestId) {
      return "B";
    }

    if (!room.slots.A) {
      const updatedRoom = {
        ...room,
        slots: { ...room.slots, A: guestId },
      };
      await this.ctx.storage.put(ROOM_STATE_KEY, updatedRoom);
      return "A";
    }

    if (!room.slots.B) {
      const updatedRoom = {
        ...room,
        slots: { ...room.slots, B: guestId },
      };
      await this.ctx.storage.put(ROOM_STATE_KEY, updatedRoom);
      return "B";
    }

    return null;
  }

  private async refreshStoredActivity(): Promise<void> {
    const room = await this.ctx.storage.get<RoomState>(ROOM_STATE_KEY);
    if (room) {
      await this.refreshActivity(room);
    }
  }

  private async refreshActivity(room: RoomState): Promise<void> {
    const updatedRoom = { ...room, lastActivityAt: Date.now() };
    await this.ctx.storage.put(ROOM_STATE_KEY, updatedRoom);
    await this.ctx.storage.setAlarm(
      updatedRoom.lastActivityAt + IDLE_TIMEOUT_MS,
    );
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    ws.send(
      JSON.stringify(
        serverMessageSchema.parse({
          v: protocolVersion,
          type: "error",
          code,
          message,
        }),
      ),
    );
  }
}

function parseMessage(
  message: string | ArrayBuffer,
): { ok: true; message: RoomInboundMessage } | { ok: false; message: string } {
  if (typeof message !== "string") {
    return { ok: false, message: "Message must be text JSON." };
  }

  let json: unknown;
  try {
    json = JSON.parse(message);
  } catch {
    return { ok: false, message: "Message must be valid JSON." };
  }

  const parsed = roomInboundSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, message: "Message does not match the room protocol." };
  }

  return { ok: true, message: parsed.data };
}

function socketAttachment(ws: WebSocket): SocketAttachment | null {
  const attachment: unknown = ws.deserializeAttachment();
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  const candidate = attachment as Partial<SocketAttachment>;
  if (
    typeof candidate.guestId === "string" &&
    guestIdSchema.safeParse(candidate.guestId).success &&
    (candidate.slot === "A" || candidate.slot === "B")
  ) {
    return { guestId: candidate.guestId, slot: candidate.slot };
  }

  return null;
}
