import {
  applyAction,
  createInitialState,
  deserialize,
  getActingPlayer,
  serialize,
} from "@shaxda/game-engine";
import type { SerializedGameState } from "@shaxda/game-engine";
import {
  echoBroadcastServerMessageSchema,
  guestIdSchema,
  joinedServerMessageSchema,
  matchEndedServerMessageSchema,
  matchStatusServerMessageSchema,
  presenceServerMessageSchema,
  protocolVersion,
  serverMessageSchema,
  stateServerMessageSchema,
} from "@shaxda/shared";
import { roomInboundSchema, roomInitRequestSchema } from "./protocol";
import type { PlayerSlot, RoomInboundMessage } from "./protocol";

const ROOM_STATE_KEY = "room";
const IDLE_TIMEOUT_MS = 60 * 60 * 1_000;
const DISCONNECT_GRACE_MS = 45_000;
const IDLE_NUDGE_MS = 60_000;
const IDLE_CLAIM_MS = 180_000;
const PLAYER_SLOTS = ["A", "B"] as const;

type OnlineMatchEndReason = "opponentAbandoned" | "opponentIdleTimeout";

type ConnectionState = {
  connected: boolean;
  disconnectedAt: number | null;
};

type RoomState = {
  roomCode: string;
  createdAt: number;
  lastActivityAt: number;
  slots: Partial<Record<PlayerSlot, string>>;
  displayNames: Partial<Record<PlayerSlot, string>>;
  gameState: SerializedGameState;
  connections: Partial<Record<PlayerSlot, ConnectionState>>;
  turnStartedAt: number | null;
  nudgedTurnAt: number | null;
  claimableBy: PlayerSlot | null;
  claimReason: OnlineMatchEndReason | null;
  onlineEndReason: OnlineMatchEndReason | null;
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

    const room = await this.readRoom();
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

    const room = await this.refreshStoredActivity();
    if (!room) {
      this.sendError(ws, "roomNotFound", "Room not found.");
      return;
    }

    switch (parsed.message.type) {
      case "joinRoom":
        await this.handleJoin(ws, room, parsed.message);
        return;
      case "gameAction":
        await this.handleGameAction(ws, room, parsed.message);
        return;
      case "claimWin":
        await this.handleClaimWin(ws, room, parsed.message);
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
    await this.handleSocketDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleSocketDisconnect(ws);
  }

  async alarm(): Promise<void> {
    const room = await this.readRoom();
    if (!room) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const now = Date.now();
    if (now - room.lastActivityAt >= IDLE_TIMEOUT_MS) {
      for (const socket of this.ctx.getWebSockets()) {
        socket.close(1001, "Room expired.");
      }

      await this.ctx.storage.deleteAll();
      return;
    }

    const updatedRoom = this.reconcileClaimability(
      this.applyIdleNudge(room, now),
      now,
    );
    await this.persistRoom(updatedRoom);
    this.broadcastMatchStatus(updatedRoom);
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

    const existingRoom = await this.readRoom();
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
      displayNames: {},
      gameState: serialize(createInitialState("A")),
      connections: {},
      turnStartedAt: null,
      nudgedTurnAt: null,
      claimableBy: null,
      claimReason: null,
      onlineEndReason: null,
    };

    await this.persistRoom(room);

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

    const updated = this.assignSlot(room, message.guestId, message.displayName);
    if (!updated) {
      this.sendError(ws, "roomFull", "Room already has two guests.");
      return;
    }

    const { slot } = updated;
    ws.serializeAttachment({
      guestId: message.guestId,
      slot,
    } satisfies SocketAttachment);

    const now = Date.now();
    const updatedRoom = this.reconcileClaimability(
      this.ensureTurnStarted(
        this.markSlotConnected(updated.room, slot, now),
        now,
      ),
      now,
    );
    const state = deserialize(updatedRoom.gameState);
    await this.persistRoom(updatedRoom);

    ws.send(
      JSON.stringify(
        joinedServerMessageSchema.parse({
          v: protocolVersion,
          type: "joined",
          roomCode: updatedRoom.roomCode,
          guestId: message.guestId,
          slot,
        }),
      ),
    );
    this.broadcastPresence(updatedRoom);
    this.broadcastMatchStatus(updatedRoom);
    ws.send(
      JSON.stringify(
        stateServerMessageSchema.parse({
          v: protocolVersion,
          type: "state",
          roomCode: updatedRoom.roomCode,
          state,
        }),
      ),
    );
    if (updatedRoom.onlineEndReason !== null && state.winner !== null) {
      this.sendMatchEnded(
        ws,
        updatedRoom,
        state.winner,
        updatedRoom.onlineEndReason,
      );
    }
  }

  private async handleGameAction(
    ws: WebSocket,
    room: RoomState,
    message: Extract<RoomInboundMessage, { type: "gameAction" }>,
  ): Promise<void> {
    if (message.roomCode !== room.roomCode) {
      this.sendError(ws, "roomMismatch", "Room code does not match this room.");
      return;
    }

    const attachment = socketAttachment(ws);
    if (!attachment) {
      this.sendError(ws, "notJoined", "Join the room before playing.");
      return;
    }

    if (!room.slots.A || !room.slots.B) {
      this.sendError(ws, "waitingForOpponent", "Wait for an opponent.");
      return;
    }

    if (message.action.player !== attachment.slot) {
      this.sendError(ws, "notYourTurn", "It is not your turn.");
      return;
    }

    const state = deserialize(room.gameState);
    if (getActingPlayer(state) !== attachment.slot) {
      this.sendError(ws, "notYourTurn", "It is not your turn.");
      return;
    }

    const result = applyAction(state, message.action);
    if (!result.ok) {
      this.sendError(ws, result.error, "Action rejected by game rules.");
      return;
    }

    const now = Date.now();
    const updatedRoom = {
      ...room,
      gameState: serialize(result.state),
      turnStartedAt: result.state.phase === "gameOver" ? null : now,
      nudgedTurnAt: null,
      claimableBy: null,
      claimReason: null,
      onlineEndReason: null,
    };
    await this.persistRoom(updatedRoom);
    this.broadcastState(updatedRoom);
    this.broadcastMatchStatus(updatedRoom);
  }

  private async handleClaimWin(
    ws: WebSocket,
    room: RoomState,
    message: Extract<RoomInboundMessage, { type: "claimWin" }>,
  ): Promise<void> {
    if (message.roomCode !== room.roomCode) {
      this.sendError(ws, "roomMismatch", "Room code does not match this room.");
      return;
    }

    const attachment = socketAttachment(ws);
    if (!attachment) {
      this.sendError(ws, "notJoined", "Join the room before claiming a win.");
      return;
    }

    const now = Date.now();
    const reason = this.claimReasonFor(room, attachment.slot, now);
    if (reason === null) {
      this.sendError(ws, "notClaimable", "Claim win is not available.");
      return;
    }

    const state = deserialize(room.gameState);
    const opponent = otherSlot(attachment.slot);
    const result = applyAction(state, { type: "resign", player: opponent });
    if (!result.ok || result.state.winner === null) {
      this.sendError(ws, "notClaimable", "Claim win is not available.");
      return;
    }

    const updatedRoom: RoomState = {
      ...room,
      gameState: serialize(result.state),
      turnStartedAt: null,
      nudgedTurnAt: null,
      claimableBy: attachment.slot,
      claimReason: reason,
      onlineEndReason: reason,
    };
    await this.persistRoom(updatedRoom);
    this.broadcastState(updatedRoom);
    this.broadcastMatchStatus(updatedRoom);
    this.broadcastMatchEnded(updatedRoom, result.state.winner, reason);
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

  private assignSlot(
    room: RoomState,
    guestId: string,
    displayName: string | undefined,
  ): { room: RoomState; slot: PlayerSlot } | null {
    if (room.slots.A === guestId) {
      return {
        room: this.withDisplayName(room, "A", displayName),
        slot: "A",
      };
    }

    if (room.slots.B === guestId) {
      return {
        room: this.withDisplayName(room, "B", displayName),
        slot: "B",
      };
    }

    if (!room.slots.A) {
      return {
        room: this.withDisplayName(
          {
            ...room,
            slots: { ...room.slots, A: guestId },
          },
          "A",
          displayName,
        ),
        slot: "A",
      };
    }

    if (!room.slots.B) {
      return {
        room: this.withDisplayName(
          {
            ...room,
            slots: { ...room.slots, B: guestId },
          },
          "B",
          displayName,
        ),
        slot: "B",
      };
    }

    return null;
  }

  private withDisplayName(
    room: RoomState,
    slot: PlayerSlot,
    displayName: string | undefined,
  ): RoomState {
    if (displayName === undefined) {
      return room;
    }

    return {
      ...room,
      displayNames: { ...room.displayNames, [slot]: displayName },
    };
  }

  private async handleSocketDisconnect(ws: WebSocket): Promise<void> {
    const room = await this.readRoom();
    const attachment = socketAttachment(ws);
    ws.serializeAttachment(null);
    if (!room || !attachment) {
      return;
    }

    const now = Date.now();
    const liveConnections = this.liveConnections();
    const connections = { ...room.connections };
    for (const slot of PLAYER_SLOTS) {
      if (!room.slots[slot]) {
        continue;
      }

      if (liveConnections[slot]) {
        connections[slot] = { connected: true, disconnectedAt: null };
        continue;
      }

      const existing = room.connections[slot];
      connections[slot] = {
        connected: false,
        disconnectedAt: existing?.disconnectedAt ?? now,
      };
    }

    const updatedRoom = this.reconcileClaimability(
      { ...room, lastActivityAt: now, connections },
      now,
    );
    await this.persistRoom(updatedRoom);
    this.broadcastMatchStatus(updatedRoom);
  }

  private markSlotConnected(
    room: RoomState,
    slot: PlayerSlot,
    now: number,
  ): RoomState {
    const connections = {
      ...room.connections,
      [slot]: { connected: true, disconnectedAt: null },
    };
    let updatedRoom: RoomState = { ...room, lastActivityAt: now, connections };

    if (
      updatedRoom.claimReason === "opponentAbandoned" &&
      updatedRoom.claimableBy === otherSlot(slot)
    ) {
      updatedRoom = {
        ...updatedRoom,
        claimableBy: null,
        claimReason: null,
      };
    }

    return updatedRoom;
  }

  private ensureTurnStarted(room: RoomState, now: number): RoomState {
    const state = deserialize(room.gameState);
    if (
      room.turnStartedAt !== null ||
      !room.slots.A ||
      !room.slots.B ||
      state.phase === "gameOver"
    ) {
      return room;
    }

    return { ...room, turnStartedAt: now };
  }

  private applyIdleNudge(room: RoomState, now: number): RoomState {
    if (!this.isActiveMatch(room) || room.turnStartedAt === null) {
      return room;
    }

    const state = deserialize(room.gameState);
    const actingPlayer = getActingPlayer(state);
    if (
      room.nudgedTurnAt !== room.turnStartedAt &&
      room.connections[actingPlayer]?.connected === true &&
      now - room.turnStartedAt >= IDLE_NUDGE_MS
    ) {
      return { ...room, nudgedTurnAt: room.turnStartedAt };
    }

    return room;
  }

  private reconcileClaimability(room: RoomState, now: number): RoomState {
    for (const claimant of PLAYER_SLOTS) {
      const reason = this.claimReasonFor(room, claimant, now);
      if (reason !== null) {
        return { ...room, claimableBy: claimant, claimReason: reason };
      }
    }

    if (room.onlineEndReason !== null) {
      return room;
    }

    return { ...room, claimableBy: null, claimReason: null };
  }

  private claimReasonFor(
    room: RoomState,
    claimant: PlayerSlot,
    now: number,
  ): OnlineMatchEndReason | null {
    if (
      !this.isActiveMatch(room) ||
      room.connections[claimant]?.connected !== true
    ) {
      return null;
    }

    const opponent = otherSlot(claimant);
    const opponentConnection = room.connections[opponent];
    if (
      opponentConnection?.connected === false &&
      opponentConnection.disconnectedAt !== null &&
      now - opponentConnection.disconnectedAt >= DISCONNECT_GRACE_MS
    ) {
      return "opponentAbandoned";
    }

    if (
      opponentConnection?.connected === true &&
      room.turnStartedAt !== null &&
      now - room.turnStartedAt >= IDLE_CLAIM_MS
    ) {
      const state = deserialize(room.gameState);
      if (getActingPlayer(state) === opponent) {
        return "opponentIdleTimeout";
      }
    }

    return null;
  }

  private isActiveMatch(room: RoomState): boolean {
    if (!room.slots.A || !room.slots.B) {
      return false;
    }

    return deserialize(room.gameState).phase !== "gameOver";
  }

  private broadcastPresence(room: RoomState): void {
    const message = JSON.stringify(
      presenceServerMessageSchema.parse({
        v: protocolVersion,
        type: "presence",
        roomCode: room.roomCode,
        players: {
          A: room.slots.A ? presencePlayer(room.displayNames.A) : null,
          B: room.slots.B ? presencePlayer(room.displayNames.B) : null,
        },
        started: Boolean(room.slots.A && room.slots.B),
      }),
    );

    this.broadcastToJoinedSockets(message);
  }

  private broadcastState(room: RoomState): void {
    const message = JSON.stringify(
      stateServerMessageSchema.parse({
        v: protocolVersion,
        type: "state",
        roomCode: room.roomCode,
        state: deserialize(room.gameState),
      }),
    );

    this.broadcastToJoinedSockets(message);
  }

  private broadcastMatchStatus(room: RoomState): void {
    const message = JSON.stringify(this.matchStatus(room));
    this.broadcastToJoinedSockets(message);
  }

  private broadcastMatchEnded(
    room: RoomState,
    winner: PlayerSlot,
    reason: OnlineMatchEndReason,
  ): void {
    const message = JSON.stringify(
      matchEndedServerMessageSchema.parse({
        v: protocolVersion,
        type: "matchEnded",
        roomCode: room.roomCode,
        winner,
        reason,
      }),
    );

    this.broadcastToJoinedSockets(message);
  }

  private sendMatchEnded(
    ws: WebSocket,
    room: RoomState,
    winner: PlayerSlot,
    reason: OnlineMatchEndReason,
  ): void {
    ws.send(
      JSON.stringify(
        matchEndedServerMessageSchema.parse({
          v: protocolVersion,
          type: "matchEnded",
          roomCode: room.roomCode,
          winner,
          reason,
        }),
      ),
    );
  }

  private matchStatus(
    room: RoomState,
  ): ReturnType<typeof matchStatusServerMessageSchema.parse> {
    const idleSlot = this.currentIdleSlot(room);

    return matchStatusServerMessageSchema.parse({
      v: protocolVersion,
      type: "matchStatus",
      roomCode: room.roomCode,
      connections: {
        A: room.connections.A?.connected === true,
        B: room.connections.B?.connected === true,
      },
      idleSlot,
      claimableBy: room.claimableBy,
      claimReason: room.claimReason,
    });
  }

  private currentIdleSlot(room: RoomState): PlayerSlot | null {
    if (
      !this.isActiveMatch(room) ||
      room.turnStartedAt === null ||
      room.nudgedTurnAt !== room.turnStartedAt
    ) {
      return null;
    }

    const actingPlayer = getActingPlayer(deserialize(room.gameState));
    return room.connections[actingPlayer]?.connected === true
      ? actingPlayer
      : null;
  }

  private broadcastToJoinedSockets(message: string): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socketAttachment(socket)) {
        socket.send(message);
      }
    }
  }

  private async refreshStoredActivity(): Promise<RoomState | null> {
    const room = await this.readRoom();
    return room ? this.refreshActivity(room) : null;
  }

  private async refreshActivity(room: RoomState): Promise<RoomState> {
    const updatedRoom = { ...room, lastActivityAt: Date.now() };
    await this.persistRoom(updatedRoom);
    return updatedRoom;
  }

  private async persistRoom(room: RoomState): Promise<void> {
    await this.ctx.storage.put(ROOM_STATE_KEY, room);
    await this.scheduleAlarm(room);
  }

  private async readRoom(): Promise<RoomState | null> {
    const stored =
      await this.ctx.storage.get<Partial<RoomState>>(ROOM_STATE_KEY);
    return stored ? this.normalizeRoom(stored) : null;
  }

  private async scheduleAlarm(room: RoomState): Promise<void> {
    const deadlines = [room.lastActivityAt + IDLE_TIMEOUT_MS];

    if (this.isActiveMatch(room)) {
      for (const slot of PLAYER_SLOTS) {
        const connection = room.connections[slot];
        const claimant = otherSlot(slot);
        if (
          room.slots[claimant] &&
          room.connections[claimant]?.connected === true &&
          connection?.connected === false &&
          connection.disconnectedAt !== null &&
          !(
            room.claimableBy === claimant &&
            room.claimReason === "opponentAbandoned"
          )
        ) {
          deadlines.push(connection.disconnectedAt + DISCONNECT_GRACE_MS);
        }
      }

      if (room.turnStartedAt !== null) {
        const actingPlayer = getActingPlayer(deserialize(room.gameState));
        const claimant = otherSlot(actingPlayer);
        if (room.connections[actingPlayer]?.connected === true) {
          if (room.nudgedTurnAt !== room.turnStartedAt) {
            deadlines.push(room.turnStartedAt + IDLE_NUDGE_MS);
          }
          if (
            room.connections[claimant]?.connected === true &&
            !(
              room.claimableBy === claimant &&
              room.claimReason === "opponentIdleTimeout"
            )
          ) {
            deadlines.push(room.turnStartedAt + IDLE_CLAIM_MS);
          }
        }
      }
    }

    await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }

  private normalizeRoom(stored: Partial<RoomState>): RoomState {
    const liveConnections = this.liveConnections();
    const slots = stored.slots ?? {};
    const connections: Partial<Record<PlayerSlot, ConnectionState>> = {};

    for (const slot of PLAYER_SLOTS) {
      const existing = stored.connections?.[slot];
      if (existing) {
        connections[slot] = existing;
        continue;
      }

      if (slots[slot]) {
        connections[slot] = liveConnections[slot]
          ? { connected: true, disconnectedAt: null }
          : { connected: false, disconnectedAt: null };
      }
    }

    return {
      roomCode: stored.roomCode ?? "",
      createdAt: stored.createdAt ?? Date.now(),
      lastActivityAt: stored.lastActivityAt ?? Date.now(),
      slots,
      displayNames: stored.displayNames ?? {},
      gameState: stored.gameState ?? serialize(createInitialState("A")),
      connections,
      turnStartedAt: stored.turnStartedAt ?? null,
      nudgedTurnAt: stored.nudgedTurnAt ?? null,
      claimableBy: stored.claimableBy ?? null,
      claimReason: stored.claimReason ?? null,
      onlineEndReason: stored.onlineEndReason ?? null,
    };
  }

  private liveConnections(): Record<PlayerSlot, boolean> {
    const connections = { A: false, B: false };
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socketAttachment(socket);
      if (attachment) {
        connections[attachment.slot] = true;
      }
    }

    return connections;
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

function presencePlayer(displayName: string | undefined): {
  displayName?: string;
} {
  return displayName === undefined ? {} : { displayName };
}

function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === "A" ? "B" : "A";
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
