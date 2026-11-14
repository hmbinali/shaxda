import {
  applyAction,
  createInitialState,
  deserialize,
  encodeAction,
  REPLAY_VERSION,
  getActingPlayer,
  serialize,
} from "@shaxda/game-engine";
import type {
  GameAction,
  GameState,
  SerializedGameState,
} from "@shaxda/game-engine";
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
  rematchStatusServerMessageSchema,
  serverMessageSchema,
  stateServerMessageSchema,
} from "@shaxda/shared";
import type {
  AvatarMode,
  MatchPayload,
  MatchSave,
  RematchVote,
} from "@shaxda/shared";
import { verifyIdentityTicket } from "@shaxda/shared/identity";
import type { IdentityTicketPayload } from "@shaxda/shared/identity";
import { roomInboundSchema, roomInitRequestSchema } from "./protocol";
import type { PlayerSlot, RoomInboundMessage } from "./protocol";

import { saveMatch } from "@shaxda/db/match";
import type { SaveMatchResult } from "@shaxda/db/match";
import { writesLedgerRow } from "@shaxda/shared/rated-play";
import {
  createOutboxEntry,
  MAX_UNSAVED,
  outboxKey,
  outboxSummary,
  RETRY_DELAYS,
  nextAutomaticAttempt,
} from "./match-outbox";
import type { MatchLog, OutboxEntry, OutboxSummary } from "./match-outbox";

import { discardRequestSchema, entryRequestSchema, opsJson } from "./match-ops";

const LOG_KEY = "log";
const HOLD_RETRY_MS = 60_000;
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

type RematchVotes = Record<PlayerSlot, RematchVote | null>;

type RoomState = {
  roomCode: string;
  createdAt: number;
  lastActivityAt: number;
  seatVersion: 2;
  slots: Partial<Record<PlayerSlot, string>>;
  seats: Partial<Record<PlayerSlot, SeatIdentity>>;
  // Counts the logical matches played by this room's two seats. The first game
  // is match 1 and every accepted rematch starts the next numbered match, so a
  // completed game is never conflated with the rematch that follows it.
  matchNumber: number;
  gameState: SerializedGameState;
  connections: Partial<Record<PlayerSlot, ConnectionState>>;
  turnStartedAt: number | null;
  nudgedTurnAt: number | null;
  claimableBy: PlayerSlot | null;
  claimReason: OnlineMatchEndReason | null;
  onlineEndReason: OnlineMatchEndReason | null;
  rematch: RematchVotes;
  options: { mode: MatchPayload["mode"]; ratedRequest: boolean };
  consent: Record<PlayerSlot, { accept: boolean; disclosureV: number } | null>;
  rated: boolean | null;
  consentPolicyV: number | null;
  playBeganAt: number | null;
  unsaved: Record<number, OutboxSummary>;
  lastSave: MatchSave | null;
  expiredAt: number | null;
  holdSynced: boolean;
  holdsUnsaved: boolean;
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
  DB?: D1Database;
  ONLINE_IDENTITY_SECRET?: string;
  ONLINE_IDENTITY_SECRET_PREVIOUS?: string;
}

export class MatchRoom implements DurableObject {
  private readonly attemptsInProgress = new Set<number>();
  private holdInProgress = false;
  private cleanupInProgress = false;
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: MatchRoomEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/internal/rooms/init") {
      return this.initializeRoom(request);
    }

    if (url.pathname.startsWith("/internal/ops/"))
      return this.handleOps(request, url.pathname);

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json(
        { error: "Expected WebSocket upgrade" },
        { status: 426 },
      );
    }

    const room = await this.readRoom();
    if (!room || room.expiredAt !== null) {
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
    if (!room || room.expiredAt !== null) {
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
      case "rematch":
        await this.handleRematch(ws, room, parsed.message, now);
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
    let room = await this.readRoom();
    const now = Date.now();
    if (!room) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const due = Object.keys(room.unsaved)
      .map(Number)
      .sort((a, b) => a - b)
      .filter(
        (number) => (room?.unsaved[number]?.nextAttemptAt ?? Infinity) <= now,
      );
    for (const number of due) {
      try {
        await this.attemptSave(number);
      } catch {
        console.error("matchSaveAttemptFailed", {
          roomCode: room.roomCode,
          matchNumber: number,
        });
      }
    }

    room = await this.readRoom();
    if (!room) return;
    if (
      room.expiredAt !== null ||
      now - room.lastActivityAt >= IDLE_TIMEOUT_MS
    ) {
      if (room.expiredAt === null) {
        room = { ...room, expiredAt: now };
        await this.persistRoom(this.updateHold(room));
        for (const socket of this.ctx.getWebSockets())
          socket.close(1001, "Room expired.");
      }
      await this.reconcileRetention();
      return;
    }
    if (!room.holdSynced) {
      await this.reconcileRetention();
      room = await this.readRoom();
      if (!room || room.expiredAt !== null) return;
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
    const startingSeat =
      (crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) % 2 === 0 ? "A" : "B";
    const room: RoomState = {
      roomCode: body.data.roomCode,
      createdAt: now,
      lastActivityAt: now,
      seatVersion: 2,
      slots: {},
      seats: {},
      matchNumber: 1,
      gameState: serialize(createInitialState(startingSeat)),
      connections: {},
      turnStartedAt: null,
      nudgedTurnAt: null,
      claimableBy: null,
      claimReason: null,
      onlineEndReason: null,
      rematch: emptyRematchVotes(),
      options: {
        mode: "invite",
        ratedRequest: body.data.options?.ratedRequest ?? false,
      },
      consent: { A: null, B: null },
      rated: null,
      consentPolicyV: null,
      playBeganAt: null,
      unsaved: {},
      lastSave: null,
      expiredAt: null,
      holdSynced: true,
      holdsUnsaved: false,
    };

    await this.persistRoom(room, {
      [LOG_KEY]: emptyLog(room.matchNumber, startingSeat),
    });

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
    if (!authoritativeRoom || authoritativeRoom.expiredAt !== null) {
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
    // Establish the match generation before the matching board. This also
    // restores any rematch vote cast while this seat was away.
    this.sendRematchStatus(ws, updatedRoom);
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

    if (!this.checkMatchNumber(ws, room, message.matchNumber)) return;

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
    if (
      message.action.type !== "resign" &&
      getActingPlayer(state) !== attachment.slot
    ) {
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
    await this.recordAction(
      updatedRoom,
      state,
      result.state,
      message.action,
      now,
    );
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

    if (!this.checkMatchNumber(ws, room, message.matchNumber)) return;

    const reason = this.claimReasonFor(room, attachment.slot, now);
    if (reason === null) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(ws, "notClaimable", "Claim win is not available.");
      return;
    }

    const state = deserialize(room.gameState);
    const opponent = otherSlot(attachment.slot);
    const action = { type: "resign", player: opponent } as const;
    const result = applyAction(state, action);
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
    await this.recordAction(
      updatedRoom,
      state,
      result.state,
      action,
      now,
      reason,
    );
  }

  private async handleRematch(
    ws: WebSocket,
    room: RoomState,
    message: Extract<RoomInboundMessage, { type: "rematch" }>,
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
      this.sendError(
        ws,
        "notJoined",
        "Join the room before asking for a rematch.",
      );
      return;
    }

    if (!this.checkMatchNumber(ws, room, message.matchNumber)) return;

    if (
      !room.slots.A ||
      !room.slots.B ||
      deserialize(room.gameState).phase !== "gameOver"
    ) {
      await this.refreshActivityIfStale(room, now);
      this.sendError(
        ws,
        "rematchUnavailable",
        "A rematch is only available once the game is over.",
      );
      return;
    }

    if (
      message.vote === "accept" &&
      Object.keys(room.unsaved).length >= MAX_UNSAVED
    ) {
      this.sendError(
        ws,
        "savingEarlierGames",
        "Earlier games are still saving.",
      );
      return;
    }
    const votes = applyRematchVote(room.rematch, attachment.slot, message.vote);
    if (sameRematchVotes(votes, room.rematch)) {
      // A retried vote changes nothing, so keep the room untouched and just
      // resync the sender.
      await this.refreshActivityIfStale(room, now);
      this.sendRematchStatus(ws, room);
      return;
    }

    if (votes.A === "accept" && votes.B === "accept") {
      await this.startRematch(room, now);
      return;
    }

    const updatedRoom: RoomState = {
      ...room,
      lastActivityAt: now,
      rematch: votes,
    };
    await this.persistRoom(updatedRoom);
    this.broadcastRematchStatus(updatedRoom);
  }

  private async handleOps(request: Request, path: string): Promise<Response> {
    if (request.method === "GET" && path === "/internal/ops/outbox") {
      const room = await this.readRoom();
      if (!room) return opsJson({ error: "noEntry" }, 404);
      const numbers = Object.keys(room.unsaved)
        .map(Number)
        .sort((a, b) => a - b);
      const entries = await this.ctx.storage.get<OutboxEntry>(
        numbers.map(outboxKey),
      );
      return opsJson({
        roomCode: room.roomCode,
        roomCreatedAt: room.createdAt,
        expired: room.expiredAt !== null,
        entries: [...entries.values()].map((entry) => ({
          matchNumber: entry.payload.matchNumber,
          matchId: entry.payload.id,
          status: entry.status,
          stalledReason: entry.stalledReason,
          attempts: entry.attempts,
          firstAttemptAt: entry.firstAttemptAt,
          nextAttemptAt: entry.nextAttemptAt,
          lastError: entry.lastError,
          endedAt: entry.payload.endedAt,
          actionCount: entry.payload.actionCount,
          mode: entry.payload.mode,
          rated: entry.payload.rated,
          payloadHash: entry.payloadHash,
        })),
      });
    }
    const discard = path === "/internal/ops/discard";
    if (
      request.method !== "POST" ||
      (!discard && path !== "/internal/ops/retry")
    ) {
      return opsJson({ error: "notFound" }, 404);
    }

    const body = (
      discard ? discardRequestSchema : entryRequestSchema
    ).safeParse(await request.json().catch(() => null));
    if (!body.success) return opsJson({ error: "invalidRequest" }, 400);
    const { roomCode, matchNumber, matchId } = body.data;
    const key = outboxKey(matchNumber);
    const values = await this.ctx.storage.get<RoomState | OutboxEntry>([
      ROOM_STATE_KEY,
      key,
    ]);
    const stored = values.get(ROOM_STATE_KEY) as RoomState | undefined;
    const entry = values.get(key) as OutboxEntry | undefined;
    if (!stored || stored.roomCode !== roomCode || !entry)
      return opsJson({ error: "noEntry" }, 404);
    if (entry.payload.id !== matchId)
      return opsJson({ error: "entryMismatch" }, 409);
    if (this.attemptsInProgress.has(matchNumber))
      return opsJson({ error: "attemptInProgress" }, 409);
    if (!discard) {
      if (entry.stalledReason === "replayMismatch")
        return opsJson({ error: "notRetryable" }, 409);
      await this.attemptSave(matchNumber, true);
      const remaining = await this.ctx.storage.get<OutboxEntry>(key);
      return opsJson({ status: remaining?.status ?? "saved" });
    }

    const room = this.normalizeRoom(stored);
    delete room.unsaved[matchNumber];
    if (room.lastSave?.matchNumber === matchNumber)
      room.lastSave = { matchNumber, status: "stalled" };
    this.updateHold(room);
    const remove = this.ctx.storage.delete(key);
    const write = this.persistRoom(room);
    await Promise.all([remove, write]);
    if (room.expiredAt === null) this.broadcastMatchStatus(room);
    await this.reconcileRetention();
    return opsJson({ status: "discarded" });
  }

  private checkMatchNumber(
    ws: WebSocket,
    room: RoomState,
    matchNumber: number | undefined,
  ): boolean {
    if (matchNumber === undefined || matchNumber === room.matchNumber)
      return true;
    this.sendError(ws, "staleMatch", "The action belongs to another match.");
    return false;
  }

  private async recordAction(
    room: RoomState,
    previous: GameState,
    state: GameState,
    action: GameAction,
    now: number,
    claim?: OnlineMatchEndReason,
  ): Promise<void> {
    const entry = await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<MatchLog>(LOG_KEY);
      const isInitial =
        !stored &&
        serialize(previous) ===
          serialize(createInitialState(previous.startingPlayer));
      const currentLog =
        stored ??
        (isInitial
          ? emptyLog(room.matchNumber, previous.startingPlayer)
          : undefined);
      const log = currentLog && {
        ...currentLog,
        a: [...currentLog.a, encodeAction(action)],
      };
      if (action.type !== "resign" && room.playBeganAt === null) {
        room.playBeganAt = now;
        // R2 supplies the consent handshake. H1 games are always friendly.
        room.rated = false;
        room.consentPolicyV = null;
      }

      const writes: Record<string, unknown> = log ? { [LOG_KEY]: log } : {};
      const A = room.seats.A;
      const B = room.seats.B;
      let entry: OutboxEntry | undefined;
      if (
        state.endReason !== null &&
        A?.kind === "account" &&
        B?.kind === "account"
      ) {
        if ((!log || log.matchNumber !== room.matchNumber) && !isInitial) {
          console.info("matchLogMissing", {
            roomCode: room.roomCode,
            matchNumber: room.matchNumber,
          });
        } else if (
          log?.matchNumber === room.matchNumber &&
          room.playBeganAt !== null &&
          writesLedgerRow({
            seatKinds: { A: A.kind, B: B.kind },
            playBegan: true,
            endedBy: claim ? "claim" : "action",
          })
        ) {
          entry = await createOutboxEntry(
            log,
            { ...state, endReason: state.endReason },
            {
              roomCode: room.roomCode,
              roomCreatedAt: room.createdAt,
              mode: room.options.mode,
              rated: room.rated ? 1 : 0,
              consentPolicyV: room.consentPolicyV,
              startedAt: room.playBeganAt,
              endedAt: now,
              onlineEndReason:
                claim === "opponentAbandoned"
                  ? "abandoned"
                  : claim === "opponentIdleTimeout"
                    ? "idle"
                    : null,
              userIds: { A: A.userId, B: B.userId },
            },
          );
          room.unsaved = {
            ...room.unsaved,
            [room.matchNumber]: outboxSummary(entry),
          };
          room.lastSave = {
            matchNumber: room.matchNumber,
            status: entry.status,
          };
          writes[outboxKey(room.matchNumber)] = entry;
          this.updateHold(room);
        }
      }
      await this.persistRoom(room, writes);
      return entry;
    });

    this.broadcastState(room);
    this.broadcastMatchStatus(room);
    if (claim && state.winner !== null)
      this.broadcastMatchEnded(room, state.winner, claim);

    if (entry?.status === "pending") await this.attemptSave(room.matchNumber);
    else if (entry) await this.reconcileRetention();
  }

  private async attemptSave(
    matchNumber: number,
    manual = false,
  ): Promise<void> {
    if (this.attemptsInProgress.has(matchNumber)) return;
    this.attemptsInProgress.add(matchNumber);
    try {
      const key = outboxKey(matchNumber);
      const entry = await this.ctx.storage.get<OutboxEntry>(key);
      if (!entry || entry.stalledReason === "replayMismatch") return;
      if (!manual && entry.status !== "pending") return;

      const now = Date.now();
      if (!manual && entry.firstAttemptAt === null) {
        // If the object stops during D1 commit, the alarm can retry within
        // the original window.
        await this.ctx.storage.put(key, { ...entry, firstAttemptAt: now });
      }
      const result: SaveMatchResult = this.env.DB
        ? await saveMatch(this.env.DB, entry.payload, entry.payloadHash)
        : { status: "failed", error: new Error("DB binding unavailable") };

      const updated = await this.ctx.storage.transaction(async (storage) => {
        const values = await storage.get<RoomState | OutboxEntry>([
          ROOM_STATE_KEY,
          key,
        ]);
        const stored = values.get(ROOM_STATE_KEY) as RoomState | undefined;
        const current = values.get(key) as OutboxEntry | undefined;
        if (!stored || !current || current.payload.id !== entry.payload.id)
          return;
        const room = this.normalizeRoom(stored);
        const latest = room.lastSave?.matchNumber === matchNumber;
        if (result.status === "saved") {
          delete room.unsaved[matchNumber];
          if (latest)
            room.lastSave = {
              matchNumber,
              status: "saved",
              matchId: result.matchId,
            };
          await storage.delete(key);
        } else {
          const failed = this.recordSaveFailure(current, result, now, manual);
          room.unsaved = {
            ...room.unsaved,
            [matchNumber]: outboxSummary(failed),
          };
          if (latest) room.lastSave = { matchNumber, status: failed.status };
          await storage.put(key, failed);
        }
        this.updateHold(room);
        await storage.put(ROOM_STATE_KEY, room);
        await this.scheduleAlarm(room, storage);
        return { room, latest };
      });

      if (updated?.latest && updated.room.expiredAt === null) {
        const latest = await this.readRoom();
        if (latest?.expiredAt === null) this.broadcastMatchStatus(latest);
      }
      await this.reconcileRetention();
    } finally {
      this.attemptsInProgress.delete(matchNumber);
    }
  }

  private recordSaveFailure(
    entry: OutboxEntry,
    failure: Exclude<SaveMatchResult, { status: "saved" }>,
    now: number,
    manual: boolean,
  ): OutboxEntry {
    const updated = { ...entry };
    const scope = {
      roomCode: entry.payload.roomCode,
      matchNumber: entry.payload.matchNumber,
      matchId: entry.payload.id,
    };
    if (!manual) {
      updated.attempts++;
      updated.firstAttemptAt ??= now;
    }
    if (failure.status === "conflict") {
      updated.lastError = "Ledger payload hash conflict.";
      updated.stalledReason = "integrity";
      console.error("matchSaveIntegrity", scope);
    } else {
      // D1 may include statement data in error strings. Keep a fixed diagnostic
      // here so operator output and logs cannot expose account ids or replays.
      updated.lastError = this.env.DB
        ? "D1 ledger write failed."
        : "DB binding unavailable.";
      if (!manual) {
        const next = nextAutomaticAttempt(
          updated.firstAttemptAt ?? now,
          now,
          updated.attempts,
        );
        if (next === null) {
          updated.stalledReason = "retriesExhausted";
          console.error("matchSaveStalled", scope);
        } else {
          updated.nextAttemptAt = next;
          console.warn("matchSaveRetry", {
            ...scope,
            attempts: updated.attempts,
            nextAttemptAt: next,
          });
        }
      }
    }
    if (updated.stalledReason) {
      updated.status = "stalled";
      updated.nextAttemptAt = null;
    }
    return updated;
  }

  private updateHold(room: RoomState): RoomState {
    const entries = Object.values(room.unsaved);
    const hold =
      entries.length > 0 &&
      (room.expiredAt !== null ||
        entries.some(
          (entry) => entry.attempts > 0 || entry.status === "stalled",
        ));
    if (hold !== room.holdsUnsaved) {
      room.holdsUnsaved = hold;
      room.holdSynced = false;
    }
    return room;
  }

  private async reconcileRetention(): Promise<void> {
    let room = await this.readRoom();
    if (!room) return;

    if (
      room.expiredAt !== null &&
      Object.keys(room.unsaved).length === 0 &&
      !this.holdInProgress
    ) {
      if (this.cleanupInProgress) return;
      this.cleanupInProgress = true;
      try {
        await this.releaseCoordinatorRoom(room);
        const remove = this.ctx.storage.deleteAll();
        const alarm = this.ctx.storage.deleteAlarm();
        await Promise.all([remove, alarm]);
      } catch {
        await this.scheduleAlarm(room);
      } finally {
        this.cleanupInProgress = false;
      }
      return;
    }

    if (!room.holdSynced && !this.holdInProgress) {
      this.holdInProgress = true;
      const sent = room;
      try {
        const coordinator = this.env.MATCH_COORDINATOR.get(
          this.env.MATCH_COORDINATOR.idFromName("global"),
        );
        const response = await coordinator.fetch(
          "https://shaxda.internal/internal/coordinator/hold",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: sent.roomCode,
              roomCreatedAt: sent.createdAt,
              holdsUnsaved: sent.holdsUnsaved,
            }),
          },
        );
        room = await this.readRoom();
        if (
          response.ok &&
          room?.createdAt === sent.createdAt &&
          room.holdsUnsaved === sent.holdsUnsaved
        ) {
          await this.persistRoom({ ...room, holdSynced: true });
        }
      } catch {
        // The stored unsynced flag keeps the hold eligible for an alarm retry.
      } finally {
        this.holdInProgress = false;
      }
      room = await this.readRoom();
      if (!room) return;
    }
    await this.scheduleAlarm(room);
  }

  private async startRematch(room: RoomState, now: number): Promise<void> {
    const startingSeat = otherSlot(deserialize(room.gameState).startingPlayer);
    const updatedRoom = this.reconcileClaimability(
      this.ensureTurnStarted(
        {
          ...room,
          lastActivityAt: now,
          matchNumber: room.matchNumber + 1,
          gameState: serialize(createInitialState(startingSeat)),
          turnStartedAt: null,
          nudgedTurnAt: null,
          claimableBy: null,
          claimReason: null,
          onlineEndReason: null,
          rematch: emptyRematchVotes(),
          consent: { A: null, B: null },
          rated: null,
          consentPolicyV: null,
          playBeganAt: null,
        },
        now,
      ),
      now,
    );
    await this.persistRoom(updatedRoom, {
      [LOG_KEY]: emptyLog(updatedRoom.matchNumber, startingSeat),
    });
    // Announce the new match generation before its board so clients drop the
    // finished game's result before the fresh state arrives.
    this.broadcastRematchStatus(updatedRoom);
    this.broadcastState(updatedRoom);
    this.broadcastMatchStatus(updatedRoom);
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
    if (!room || room.expiredAt !== null || !this.authorizeSocket(room, ws)) {
      return;
    }
    ws.serializeAttachment(null);

    const now = Date.now();
    const liveConnections = this.liveConnections(room);
    const connections = { ...room.connections };
    const rematch = { ...room.rematch };
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
      // A seat that is gone cannot be waiting on, or agreeing to, a rematch.
      rematch[slot] = null;
    }

    const rematchChanged = !sameRematchVotes(rematch, room.rematch);
    const updatedRoom = this.reconcileClaimability(
      { ...room, lastActivityAt: now, connections, rematch },
      now,
    );
    await this.persistRoom(updatedRoom);
    this.broadcastMatchStatus(updatedRoom);
    if (rematchChanged) {
      this.broadcastRematchStatus(updatedRoom);
    }
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

  private broadcastRematchStatus(room: RoomState): void {
    this.broadcastToJoinedSockets(room, this.rematchStatus(room));
  }

  private sendRematchStatus(ws: WebSocket, room: RoomState): void {
    ws.send(this.rematchStatus(room));
  }

  private rematchStatus(room: RoomState): string {
    return JSON.stringify(
      rematchStatusServerMessageSchema.parse({
        v: protocolVersion,
        type: "rematchStatus",
        roomCode: room.roomCode,
        matchNumber: room.matchNumber,
        votes: { A: room.rematch.A, B: room.rematch.B },
      }),
    );
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
      mode: room.options.mode,
      ratedRequest: room.options.ratedRequest,
      consent: {
        A: room.consent.A?.accept ?? null,
        B: room.consent.B?.accept ?? null,
      },
      rated: room.rated,
      save: room.lastSave ?? undefined,
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

  private async persistRoom(
    room: RoomState,
    entries: Record<string, unknown> = {},
  ): Promise<void> {
    const write = this.ctx.storage.put({ [ROOM_STATE_KEY]: room, ...entries });
    const alarm = this.scheduleAlarm(room);
    await Promise.all([write, alarm]);
  }

  private async readRoom(): Promise<RoomState | null> {
    const stored =
      await this.ctx.storage.get<Partial<RoomState>>(ROOM_STATE_KEY);
    return stored ? this.normalizeRoom(stored) : null;
  }

  private async scheduleAlarm(
    room: RoomState,
    storage: Pick<DurableObjectTransaction, "setAlarm" | "deleteAlarm"> = this
      .ctx.storage,
  ): Promise<void> {
    const deadlines: number[] = [];
    const now = Date.now();
    if (
      !room.holdSynced ||
      (room.expiredAt !== null && Object.keys(room.unsaved).length === 0)
    ) {
      deadlines.push(now + HOLD_RETRY_MS);
    }
    for (const [matchNumber, entry] of Object.entries(room.unsaved)) {
      if (entry.nextAttemptAt !== null) {
        deadlines.push(
          entry.nextAttemptAt <= now &&
            this.attemptsInProgress.has(Number(matchNumber))
            ? now + RETRY_DELAYS[0]
            : entry.nextAttemptAt,
        );
      }
    }
    if (room.expiredAt === null)
      deadlines.push(room.lastActivityAt + IDLE_TIMEOUT_MS);

    if (room.expiredAt === null && this.isActiveMatch(room)) {
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

    if (deadlines.length === 0) await storage.deleteAlarm();
    else await storage.setAlarm(Math.min(...deadlines));
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
      matchNumber:
        Number.isInteger(stored.matchNumber) && Number(stored.matchNumber) > 0
          ? Number(stored.matchNumber)
          : 1,
      gameState: stored.gameState ?? serialize(createInitialState("A")),
      connections: stored.connections ?? {},
      turnStartedAt: stored.turnStartedAt ?? null,
      nudgedTurnAt: stored.nudgedTurnAt ?? null,
      claimableBy: stored.claimableBy ?? null,
      claimReason: stored.claimReason ?? null,
      onlineEndReason: stored.onlineEndReason ?? null,
      rematch: normalizeRematchVotes(stored.rematch),
      options: stored.options ?? { mode: "invite", ratedRequest: false },
      consent: stored.consent ?? { A: null, B: null },
      rated: stored.rated ?? null,
      consentPolicyV: stored.consentPolicyV ?? null,
      playBeganAt: stored.playBeganAt ?? null,
      unsaved: stored.unsaved ?? {},
      lastSave: stored.lastSave ?? null,
      expiredAt: stored.expiredAt ?? null,
      holdSynced: stored.holdSynced ?? true,
      holdsUnsaved: stored.holdsUnsaved ?? false,
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

  private async releaseCoordinatorRoom(room: RoomState): Promise<void> {
    const coordinator = this.env.MATCH_COORDINATOR.get(
      this.env.MATCH_COORDINATOR.idFromName("global"),
    );
    const response = await coordinator.fetch(
      new Request("https://shaxda.internal/internal/coordinator/release", {
        method: "POST",
        body: JSON.stringify({
          roomCode: room.roomCode,
          roomCreatedAt: room.createdAt,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    if (!response.ok) throw new Error("Coordinator release failed.");
  }
}

function emptyLog(matchNumber: number, startingSeat: PlayerSlot): MatchLog {
  return { v: REPLAY_VERSION, matchNumber, s: startingSeat, a: [] };
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

function emptyRematchVotes(): RematchVotes {
  return { A: null, B: null };
}

function normalizeRematchVotes(stored: unknown): RematchVotes {
  const candidate = (stored ?? {}) as Partial<RematchVotes>;

  return {
    A: isRematchVote(candidate.A) ? candidate.A : null,
    B: isRematchVote(candidate.B) ? candidate.B : null,
  };
}

function isRematchVote(value: unknown): value is RematchVote {
  return value === "accept" || value === "decline";
}

function applyRematchVote(
  votes: RematchVotes,
  slot: PlayerSlot,
  vote: RematchVote,
): RematchVotes {
  const next: RematchVotes = { A: votes.A, B: votes.B };
  next[slot] = vote;
  if (vote === "decline") {
    // A decline closes the current negotiation for both seats so a standing
    // request can never restart the game after the opponent said no.
    next[otherSlot(slot)] = null;
  }

  return next;
}

function sameRematchVotes(left: RematchVotes, right: RematchVotes): boolean {
  return left.A === right.A && left.B === right.B;
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
