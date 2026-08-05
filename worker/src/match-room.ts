import {
  applyAction,
  createInitialState,
  deserialize,
  getActingPlayer,
  serialize,
} from "@shaxda/game-engine";
import type { SerializedGameState } from "@shaxda/game-engine";
import {
  allowedGoogleAvatarUrl,
  avatarColorForUserId,
  avatarInitial,
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
import type { AvatarMode } from "@shaxda/shared";
import { verifyIdentityTicket } from "@shaxda/shared/identity";
import type { IdentityTicketPayload } from "@shaxda/shared/identity";
import { roomInboundSchema, roomInitRequestSchema } from "./protocol";
import type { PlayerSlot, RoomInboundMessage } from "./protocol";

const ROOM_STATE_KEY = "room";
const IDLE_TIMEOUT_MS = 60 * 60 * 1_000;
const DISCONNECT_GRACE_MS = 45_000;
const IDLE_NUDGE_MS = 60_000;
const IDLE_CLAIM_MS = 180_000;
const MAX_MESSAGE_BYTES = 4_096;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const MESSAGE_RATE_MAX = 30;
const MAX_SOCKETS_PER_ROOM = 8;
const ACTIVITY_WRITE_MIN_INTERVAL_MS = 30_000;
const PLAYER_SLOTS = ["A", "B"] as const;
const MAX_USED_TICKETS_PER_SEAT = 16;

type OnlineMatchEndReason = "opponentAbandoned" | "opponentIdleTimeout";

type ConnectionState = {
  connected: boolean;
  disconnectedAt: number | null;
};

type UsedTicket = { jti: string; exp: number };

type SeatIdentity =
  | {
      kind: "guest";
      displayName?: string;
      connectionEpoch: number;
      usedTickets: [];
    }
  | {
      kind: "account";
      userId: string;
      usernameSnapshot: string;
      avatarMode: AvatarMode;
      imageUrl: string | null;
      connectionEpoch: number;
      usedTickets: UsedTicket[];
    };

type RoomState = {
  roomCode: string;
  createdAt: number;
  lastActivityAt: number;
  seatVersion: 2;
  slots: Partial<Record<PlayerSlot, string>>;
  seats: Partial<Record<PlayerSlot, SeatIdentity>>;
  gameState: SerializedGameState;
  connections: Partial<Record<PlayerSlot, ConnectionState>>;
  turnStartedAt: number | null;
  nudgedTurnAt: number | null;
  claimableBy: PlayerSlot | null;
  claimReason: OnlineMatchEndReason | null;
  onlineEndReason: OnlineMatchEndReason | null;
};

type SocketAttachment = {
  guestId?: string;
  slot?: PlayerSlot;
  identityKey?: string;
  epoch?: number;
  messageTimestamps?: number[];
};

type JoinedSocketAttachment = {
  guestId: string;
  slot: PlayerSlot;
  identityKey: string;
  epoch?: number;
  messageTimestamps?: number[];
};

export interface MatchRoomEnv {
  MATCH_COORDINATOR: DurableObjectNamespace;
  ONLINE_IDENTITY_SECRET?: string;
  ONLINE_IDENTITY_SECRET_PREVIOUS?: string;
}

export class MatchRoom implements DurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: MatchRoomEnv,
  ) {}

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

    if (this.ctx.getWebSockets().length >= MAX_SOCKETS_PER_ROOM) {
      return Response.json({ error: "tooManyConnections" }, { status: 429 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    await this.refreshActivityIfStale(room, Date.now());

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const now = Date.now();
    if (!this.consumeMessageQuota(ws, now)) {
      this.sendError(ws, "rateLimited", "Too many messages.");
      return;
    }

    const parsed = parseMessage(message);
    if (!parsed.ok) {
      this.sendError(ws, parsed.code, parsed.message);
      return;
    }

    const room = await this.refreshStoredActivity();
    if (!room) {
      this.sendError(ws, "roomNotFound", "Room not found.");
      return;
    }

    switch (parsed.message.type) {
      case "joinRoom":
        await this.handleJoin(ws, room, parsed.message, now);
        return;
      case "gameAction":
        await this.handleGameAction(ws, room, parsed.message, now);
        return;
      case "claimWin":
        await this.handleClaimWin(ws, room, parsed.message, now);
        return;
      case "ping":
        await this.refreshActivityIfStale(room, now);
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
        this.handleEcho(
          ws,
          await this.refreshActivityIfStale(room, now),
          parsed.message,
        );
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

      await this.releaseCoordinatorRoom(room.roomCode);
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
      seatVersion: 2,
      slots: {},
      seats: {},
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
    now: number,
  ): Promise<void> {
    if (message.roomCode !== room.roomCode) {
      await this.refreshActivityIfStale(room, now);
      if (message.identityTicket) {
        this.sendIdentityError(
          ws,
          "identityScope",
          "Identity ticket does not belong to this room.",
          true,
        );
      } else {
        this.sendError(
          ws,
          "roomMismatch",
          "Room code does not match this room.",
        );
      }
      return;
    }

    let accountPayload: IdentityTicketPayload | null = null;
    if (message.identityTicket !== undefined) {
      const secrets = [
        this.env.ONLINE_IDENTITY_SECRET,
        this.env.ONLINE_IDENTITY_SECRET_PREVIOUS,
      ].filter((secret): secret is string => Boolean(secret?.trim()));
      if (secrets.length === 0) {
        this.sendIdentityError(
          ws,
          "identityUnavailable",
          "Online account identity is unavailable.",
          true,
        );
        return;
      }

      let verification: Awaited<ReturnType<typeof verifyIdentityTicket>>;
      try {
        verification = await verifyIdentityTicket(
          message.identityTicket,
          secrets,
          { allowedActions: ["join", "reconnect"], roomCode: room.roomCode },
          now,
        );
      } catch {
        this.sendIdentityError(
          ws,
          "identityInvalid",
          "Identity ticket could not be verified.",
          true,
        );
        return;
      }

      if (!verification.ok) {
        const code =
          verification.code === "expired"
            ? "identityExpired"
            : verification.code === "scope"
              ? "identityScope"
              : "identityInvalid";
        this.sendIdentityError(ws, code, "Identity ticket was rejected.", true);
        return;
      }
      accountPayload = verification.payload;
    }

    // Ticket verification is a non-storage await. Re-read under the Durable
    // Object input gate before assigning a seat or recording a JTI.
    const authoritativeRoom = await this.readRoom();
    if (!authoritativeRoom) {
      this.sendError(ws, "roomNotFound", "Room not found.");
      return;
    }

    const updated = accountPayload
      ? this.assignAccountSlot(authoritativeRoom, accountPayload, now)
      : this.assignGuestSlot(
          authoritativeRoom,
          message.guestId,
          message.displayName,
        );
    if (updated !== null && "error" in updated) {
      const retryable =
        updated.error === "identityScope" &&
        accountPayload?.action === "reconnect";
      this.sendIdentityError(
        ws,
        updated.error,
        "Account identity could not claim this seat.",
        !retryable,
      );
      return;
    }
    if (!updated) {
      this.sendError(ws, "roomFull", "Room already has two guests.");
      return;
    }

    const { slot, identityKey, epoch } = updated;
    ws.serializeAttachment({
      ...rawSocketAttachment(ws),
      guestId: message.guestId,
      slot,
      identityKey,
      ...(epoch === undefined ? {} : { epoch }),
    } satisfies SocketAttachment);

    if (accountPayload !== null) {
      for (const socket of this.ctx.getWebSockets()) {
        if (socket === ws) continue;
        const attachment = socketAttachment(socket);
        if (
          attachment?.slot === slot &&
          attachment.identityKey === identityKey
        ) {
          socket.serializeAttachment(null);
          socket.close(4001, "replaced");
        }
      }
    }

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
    now: number,
  ): Promise<void> {
    if (message.roomCode !== room.roomCode) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "roomMismatch", "Room code does not match this room.");
      return;
    }

    const attachment = this.authorizeSocket(room, ws);
    if (!attachment) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "notJoined", "Join the room before playing.");
      return;
    }

    if (!room.slots.A || !room.slots.B) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "waitingForOpponent", "Wait for an opponent.");
      return;
    }

    if (message.action.player !== attachment.slot) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "notYourTurn", "It is not your turn.");
      return;
    }

    const state = deserialize(room.gameState);
    if (getActingPlayer(state) !== attachment.slot) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "notYourTurn", "It is not your turn.");
      return;
    }

    const result = applyAction(state, message.action);
    if (!result.ok) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, result.error, "Action rejected by game rules.");
      return;
    }

    const updatedRoom = {
      ...room,
      lastActivityAt: now,
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
    now: number,
  ): Promise<void> {
    if (message.roomCode !== room.roomCode) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "roomMismatch", "Room code does not match this room.");
      return;
    }

    const attachment = this.authorizeSocket(room, ws);
    if (!attachment) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "notJoined", "Join the room before claiming a win.");
      return;
    }

    const reason = this.claimReasonFor(room, attachment.slot, now);
    if (reason === null) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "notClaimable", "Claim win is not available.");
      return;
    }

    const state = deserialize(room.gameState);
    const opponent = otherSlot(attachment.slot);
    const result = applyAction(state, { type: "resign", player: opponent });
    if (!result.ok || result.state.winner === null) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "notClaimable", "Claim win is not available.");
      return;
    }

    const updatedRoom: RoomState = {
      ...room,
      lastActivityAt: now,
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

    const attachment = this.authorizeSocket(room, ws);
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
      if (this.authorizeSocket(room, socket)) {
        socket.send(broadcast);
      }
    }
  }

  private assignGuestSlot(
    room: RoomState,
    guestId: string,
    displayName: string | undefined,
  ): {
    room: RoomState;
    slot: PlayerSlot;
    identityKey: string;
    epoch?: number;
  } | null {
    const identityKey = `guest:${guestId}`;
    const existingSlot = PLAYER_SLOTS.find(
      (slot) => room.slots[slot] === identityKey,
    );
    const slot =
      existingSlot ?? PLAYER_SLOTS.find((candidate) => !room.slots[candidate]);
    if (slot === undefined) return null;

    const existing = room.seats[slot];
    const connectionEpoch = Math.max(existing?.connectionEpoch ?? 0, 1);
    const seat: SeatIdentity = {
      kind: "guest",
      ...(displayName === undefined
        ? existing?.kind === "guest" && existing.displayName !== undefined
          ? { displayName: existing.displayName }
          : {}
        : { displayName }),
      connectionEpoch,
      usedTickets: [],
    };
    return {
      room: {
        ...room,
        slots: { ...room.slots, [slot]: identityKey },
        seats: { ...room.seats, [slot]: seat },
      },
      slot,
      identityKey,
    };
  }

  private assignAccountSlot(
    room: RoomState,
    payload: IdentityTicketPayload,
    now: number,
  ):
    | {
        room: RoomState;
        slot: PlayerSlot;
        identityKey: string;
        epoch: number;
      }
    | {
        error: "identityScope" | "identityReplayed" | "rateLimited";
      }
    | null {
    const identityKey = `account:${payload.userId}`;
    const existingSlot = PLAYER_SLOTS.find(
      (slot) => room.slots[slot] === identityKey,
    );
    if (payload.action === "reconnect" && existingSlot === undefined) {
      return { error: "identityScope" };
    }

    const slot =
      existingSlot ?? PLAYER_SLOTS.find((candidate) => !room.slots[candidate]);
    if (slot === undefined) return null;

    const existing = room.seats[slot];
    const usedTickets =
      existing?.kind === "account"
        ? existing.usedTickets.filter((ticket) => ticket.exp > now)
        : [];
    if (usedTickets.some((ticket) => ticket.jti === payload.jti)) {
      return { error: "identityReplayed" };
    }
    if (usedTickets.length >= MAX_USED_TICKETS_PER_SEAT) {
      return { error: "rateLimited" };
    }

    const epoch = (existing?.connectionEpoch ?? 0) + 1;
    const seat: SeatIdentity = {
      kind: "account",
      userId: payload.userId,
      usernameSnapshot:
        existing?.kind === "account"
          ? existing.usernameSnapshot
          : payload.usernameSnapshot,
      avatarMode: payload.avatarMode,
      imageUrl:
        payload.avatarMode === "google"
          ? allowedGoogleAvatarUrl(payload.imageUrl)
          : null,
      connectionEpoch: epoch,
      usedTickets: [...usedTickets, { jti: payload.jti, exp: payload.exp }],
    };
    return {
      room: {
        ...room,
        slots: { ...room.slots, [slot]: identityKey },
        seats: { ...room.seats, [slot]: seat },
      },
      slot,
      identityKey,
      epoch,
    };
  }

  private async handleSocketDisconnect(ws: WebSocket): Promise<void> {
    const room = await this.readRoom();
    if (!room || !this.authorizeSocket(room, ws)) {
      return;
    }
    ws.serializeAttachment(null);

    const now = Date.now();
    const liveConnections = this.liveConnections(room);
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
          A: room.slots.A ? presencePlayer(room.seats.A) : null,
          B: room.slots.B ? presencePlayer(room.seats.B) : null,
        },
        started: Boolean(room.slots.A && room.slots.B),
      }),
    );

    this.broadcastToJoinedSockets(room, message);
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

    this.broadcastToJoinedSockets(room, message);
  }

  private broadcastMatchStatus(room: RoomState): void {
    const message = JSON.stringify(this.matchStatus(room));
    this.broadcastToJoinedSockets(room, message);
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

    this.broadcastToJoinedSockets(room, message);
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

  private broadcastToJoinedSockets(room: RoomState, message: string): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (this.authorizeSocket(room, socket)) {
        socket.send(message);
      }
    }
  }

  private async refreshStoredActivity(): Promise<RoomState | null> {
    return this.readRoom();
  }

  private async refreshActivityIfStale(
    room: RoomState,
    now: number,
  ): Promise<RoomState> {
    if (now - room.lastActivityAt < ACTIVITY_WRITE_MIN_INTERVAL_MS) {
      return room;
    }

    const updatedRoom = { ...room, lastActivityAt: now };
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
    const legacyDisplayNames = (
      stored as Partial<RoomState> & {
        displayNames?: Partial<Record<PlayerSlot, string>>;
      }
    ).displayNames;
    const legacySlots = stored.slots ?? {};
    const migrated = stored.seatVersion !== 2;
    const slots: Partial<Record<PlayerSlot, string>> = {};
    const seats: Partial<Record<PlayerSlot, SeatIdentity>> = {};
    for (const slot of PLAYER_SLOTS) {
      const legacyIdentity = legacySlots[slot];
      if (migrated) {
        if (legacyIdentity !== undefined) {
          slots[slot] = `guest:${legacyIdentity}`;
          seats[slot] = {
            kind: "guest",
            ...(legacyDisplayNames?.[slot] === undefined
              ? {}
              : { displayName: legacyDisplayNames[slot] }),
            connectionEpoch: 0,
            usedTickets: [],
          };
        }
        continue;
      }

      if (legacyIdentity !== undefined) slots[slot] = legacyIdentity;
      const existingSeat = stored.seats?.[slot];
      if (existingSeat !== undefined) {
        seats[slot] = normalizeSeat(existingSeat);
      }
    }

    const baseRoom: RoomState = {
      roomCode: stored.roomCode ?? "",
      createdAt: stored.createdAt ?? Date.now(),
      lastActivityAt: stored.lastActivityAt ?? Date.now(),
      seatVersion: 2,
      slots,
      seats,
      gameState: stored.gameState ?? serialize(createInitialState("A")),
      connections: stored.connections ?? {},
      turnStartedAt: stored.turnStartedAt ?? null,
      nudgedTurnAt: stored.nudgedTurnAt ?? null,
      claimableBy: stored.claimableBy ?? null,
      claimReason: stored.claimReason ?? null,
      onlineEndReason: stored.onlineEndReason ?? null,
    };
    const liveConnections = this.liveConnections(baseRoom);
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
      ...baseRoom,
      connections,
    };
  }

  private liveConnections(room: RoomState): Record<PlayerSlot, boolean> {
    const connections = { A: false, B: false };
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = this.authorizeSocket(room, socket);
      if (attachment) {
        connections[attachment.slot] = true;
      }
    }

    return connections;
  }

  private authorizeSocket(
    room: RoomState,
    ws: WebSocket,
  ): JoinedSocketAttachment | null {
    const attachment = socketAttachment(ws);
    if (!attachment || room.slots[attachment.slot] !== attachment.identityKey) {
      return null;
    }

    const seat = room.seats[attachment.slot];
    if (seat?.kind === "account" && attachment.epoch !== seat.connectionEpoch) {
      return null;
    }

    return attachment;
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

  private sendIdentityError(
    ws: WebSocket,
    code: string,
    message: string,
    close: boolean,
  ): void {
    this.sendError(ws, code, message);
    if (close) ws.close(4003, code);
  }

  private consumeMessageQuota(ws: WebSocket, now: number): boolean {
    const attachment = rawSocketAttachment(ws);
    const windowTimestamps = (attachment.messageTimestamps ?? []).filter(
      (timestamp) => now - timestamp < MESSAGE_RATE_WINDOW_MS,
    );
    const recent = windowTimestamps.slice(-(MESSAGE_RATE_MAX - 1));

    if (windowTimestamps.length >= MESSAGE_RATE_MAX) {
      ws.serializeAttachment({
        ...attachment,
        messageTimestamps: windowTimestamps.slice(-MESSAGE_RATE_MAX),
      });
      return false;
    }

    ws.serializeAttachment({
      ...attachment,
      messageTimestamps: [...recent, now],
    } satisfies SocketAttachment);
    return true;
  }

  private async releaseCoordinatorRoom(roomCode: string): Promise<void> {
    const coordinator = this.env.MATCH_COORDINATOR.get(
      this.env.MATCH_COORDINATOR.idFromName("global"),
    );
    await coordinator.fetch(
      new Request("https://shaxda.internal/internal/coordinator/release", {
        method: "POST",
        body: JSON.stringify({ roomCode }),
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
}

function presencePlayer(seat: SeatIdentity | undefined): {
  displayName?: string;
  kind?: "guest" | "account";
  username?: string;
  avatar?: {
    mode: AvatarMode;
    imageUrl: string | null;
    color: string;
    initial: string;
  };
} {
  if (!seat) return {};
  if (seat.kind === "guest") {
    return {
      kind: "guest",
      ...(seat.displayName === undefined
        ? {}
        : { displayName: seat.displayName }),
    };
  }

  return {
    kind: "account",
    displayName: seat.usernameSnapshot,
    username: seat.usernameSnapshot,
    avatar: {
      mode: seat.avatarMode,
      imageUrl: seat.imageUrl,
      color: avatarColorForUserId(seat.userId),
      initial: avatarInitial(seat.usernameSnapshot),
    },
  };
}

function normalizeSeat(seat: SeatIdentity): SeatIdentity {
  if (seat.kind === "guest") {
    return {
      kind: "guest",
      ...(seat.displayName === undefined
        ? {}
        : { displayName: seat.displayName }),
      connectionEpoch: Number.isInteger(seat.connectionEpoch)
        ? seat.connectionEpoch
        : 0,
      usedTickets: [],
    };
  }

  return {
    kind: "account",
    userId: seat.userId,
    usernameSnapshot: seat.usernameSnapshot,
    avatarMode: seat.avatarMode,
    imageUrl:
      seat.avatarMode === "google"
        ? allowedGoogleAvatarUrl(seat.imageUrl)
        : null,
    connectionEpoch: Number.isInteger(seat.connectionEpoch)
      ? seat.connectionEpoch
      : 0,
    usedTickets: Array.isArray(seat.usedTickets)
      ? seat.usedTickets
          .filter(
            (ticket) =>
              typeof ticket?.jti === "string" && typeof ticket.exp === "number",
          )
          .slice(-MAX_USED_TICKETS_PER_SEAT)
      : [],
  };
}

function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === "A" ? "B" : "A";
}

function parseMessage(
  message: string | ArrayBuffer,
):
  | { ok: true; message: RoomInboundMessage }
  | { ok: false; code: "invalidMessage" | "messageTooLarge"; message: string } {
  const byteLength =
    typeof message === "string"
      ? new TextEncoder().encode(message).byteLength
      : message.byteLength;
  if (byteLength > MAX_MESSAGE_BYTES) {
    return {
      ok: false,
      code: "messageTooLarge",
      message: "Message is too large.",
    };
  }

  if (typeof message !== "string") {
    return {
      ok: false,
      code: "invalidMessage",
      message: "Message must be text JSON.",
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(message);
  } catch {
    return {
      ok: false,
      code: "invalidMessage",
      message: "Message must be valid JSON.",
    };
  }

  const parsed = roomInboundSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalidMessage",
      message: "Message does not match the room protocol.",
    };
  }

  return { ok: true, message: parsed.data };
}

function socketAttachment(ws: WebSocket): JoinedSocketAttachment | null {
  const attachment = rawSocketAttachment(ws);
  if (
    typeof attachment.guestId === "string" &&
    guestIdSchema.safeParse(attachment.guestId).success &&
    (attachment.slot === "A" || attachment.slot === "B")
  ) {
    return {
      guestId: attachment.guestId,
      slot: attachment.slot,
      identityKey:
        typeof attachment.identityKey === "string"
          ? attachment.identityKey
          : `guest:${attachment.guestId}`,
      ...(typeof attachment.epoch === "number"
        ? { epoch: attachment.epoch }
        : {}),
      ...(attachment.messageTimestamps
        ? { messageTimestamps: attachment.messageTimestamps }
        : {}),
    };
  }

  return null;
}

function rawSocketAttachment(ws: WebSocket): SocketAttachment {
  const attachment: unknown = ws.deserializeAttachment();
  if (!attachment || typeof attachment !== "object") {
    return {};
  }

  const candidate = attachment as Partial<SocketAttachment>;
  const rawTimestamps = Array.isArray(candidate.messageTimestamps)
    ? candidate.messageTimestamps
    : [];
  const messageTimestamps = rawTimestamps
    .filter((timestamp): timestamp is number => typeof timestamp === "number")
    .slice(-MESSAGE_RATE_MAX);

  return {
    ...(typeof candidate.guestId === "string"
      ? { guestId: candidate.guestId }
      : {}),
    ...(candidate.slot === "A" || candidate.slot === "B"
      ? { slot: candidate.slot }
      : {}),
    ...(typeof candidate.identityKey === "string"
      ? { identityKey: candidate.identityKey }
      : {}),
    ...(typeof candidate.epoch === "number" ? { epoch: candidate.epoch } : {}),
    ...(messageTimestamps.length > 0 ? { messageTimestamps } : {}),
  };
}
