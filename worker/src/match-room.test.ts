import {
  applyD1Migrations,
  type D1Migration,
  env,
  evictDurableObject,
  reset,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { saveMatch } from "@shaxda/db/match";
import { outboxSummary } from "./match-outbox";
import type { OutboxEntry, OutboxSummary } from "./match-outbox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInitialState,
  deserialize,
  serialize,
} from "@shaxda/game-engine";
import type {
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "@shaxda/game-engine";
import {
  a2ConformanceActionScripts,
  fullGameActionScripts,
  matchPayloadHash,
  protocolVersion,
  ROOM_CODE_ALPHABET,
  serverMessageSchema,
} from "@shaxda/shared";
import type { ServerMessage } from "@shaxda/shared";
import {
  IDENTITY_TICKET_SKEW_MS,
  IDENTITY_TICKET_TTL_MS,
  mintIdentityTicket,
} from "@shaxda/shared/identity";
import type { TicketAction } from "@shaxda/shared/identity";

const testEnv = env as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
  MATCH_OPS_TOKEN: string;
  MATCH_ROOM: DurableObjectNamespace;
  MATCH_COORDINATOR: DurableObjectNamespace;
  ONLINE_IDENTITY_SECRET: string;
};

beforeEach(() => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
    if (array instanceof Uint8Array && array.length === 1) {
      array[0] = 0;
      return array;
    }
    return getRandomValues(array);
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("match room hibernation spike", () => {
  it("creates rooms with schema-valid roomCreated payloads", async () => {
    const response = await SELF.fetch("https://shaxda.test/rooms", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    const body = serverMessageSchema.parse(await response.json());
    expect(body).toMatchObject({
      v: protocolVersion,
      type: "roomCreated",
    });
  });

  it("retries room creation when a generated code already exists", async () => {
    await initializeRoom("ABCDEFGH");
    const generatedCodes = ["ABCDEFGH", "JKLMNPQR"];
    vi.spyOn(crypto, "getRandomValues").mockImplementation((<
      T extends ArrayBufferView | null,
    >(
      array: T,
    ): T => {
      if (!(array instanceof Uint8Array)) {
        throw new Error("Expected Uint8Array room-code entropy.");
      }

      if (array.length === 1) return array;
      const roomCode = generatedCodes.shift();
      if (!roomCode) {
        throw new Error("Unexpected room-code generation attempt.");
      }

      const bytes = roomCodeBytes(roomCode);
      array.set(bytes);
      return array;
    }) as Crypto["getRandomValues"]);

    const response = await SELF.fetch("https://shaxda.test/rooms", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      type: "roomCreated",
      roomCode: "JKLMNPQR",
    });
  });

  it("rejects joins for valid-looking rooms that were never created", async () => {
    const response = await websocketResponse("ABCDEFGH");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Room not found" });
  });

  it("caps concurrent sockets per room and keeps accepted sockets usable", async () => {
    const roomCode = await createRoom();
    const sockets = await Promise.all(
      Array.from({ length: 8 }, () => connectRoom(roomCode)),
    );

    const rejected = await websocketResponse(roomCode);
    expect(rejected.status).toBe(429);
    await expect(rejected.json()).resolves.toEqual({
      error: "tooManyConnections",
    });

    for (const [index, socket] of sockets.entries()) {
      sendJson(socket, {
        v: protocolVersion,
        type: "ping",
        nonce: `socket-${index}`,
      });
      await expect(nextJson(socket)).resolves.toMatchObject({
        type: "pong",
        nonce: `socket-${index}`,
      });
    }

    for (const socket of sockets) {
      socket.close();
    }
  });

  it("assigns two slots and rejects a third guest", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);
    const third = await connectRoom(roomCode);

    const firstJoin = await joinAndWait(first, roomCode, "guest-id-a", "Ayaan");
    expect(firstJoin.joined).toMatchObject({
      type: "joined",
      guestId: "guest-id-a",
      slot: "A",
    });
    expect(firstJoin.presence).toMatchObject({
      type: "presence",
      players: { A: { displayName: "Ayaan" }, B: null },
      started: false,
    });
    expect(firstJoin.state).toMatchObject({
      type: "state",
      state: { phase: "placement", currentPlayer: "A" },
    });

    const firstPresenceAfterSecondJoin = waitForMessage(first, "presence");
    const secondJoin = await joinAndWait(
      second,
      roomCode,
      "guest-id-b",
      "Cabdi",
    );
    expect(secondJoin.joined).toMatchObject({
      type: "joined",
      guestId: "guest-id-b",
      slot: "B",
    });
    expect(secondJoin.presence).toMatchObject({
      type: "presence",
      players: {
        A: { displayName: "Ayaan" },
        B: { displayName: "Cabdi" },
      },
      started: true,
    });
    await expect(firstPresenceAfterSecondJoin).resolves.toMatchObject({
      type: "presence",
      started: true,
    });

    sendJson(third, joinRoom(roomCode, "guest-id-c"));
    await expect(waitForMessage(third, "error")).resolves.toMatchObject({
      type: "error",
      code: "roomFull",
    });

    first.close();
    second.close();
    third.close();
  });

  it("seats an account by user id and broadcasts only its public snapshot", async () => {
    const roomCode = await createRoom();
    const account = await connectRoom(roomCode);
    const guest = await connectRoom(roomCode);
    const ticket = await mintTestTicket("join", roomCode, {
      userId: "private-user-id",
      usernameSnapshot: "ayaan_7",
    });

    const joined = await joinAndWait(
      account,
      roomCode,
      "account-device-a",
      undefined,
      ticket,
    );
    expect(joined.presence.players.A).toMatchObject({
      kind: "account",
      displayName: "ayaan_7",
      username: "ayaan_7",
      avatar: { mode: "initial", imageUrl: null, initial: "A" },
    });
    expect(JSON.stringify(joined.presence)).not.toContain("private-user-id");

    const accountPresence = waitForMessage(account, "presence");
    const guestJoin = await joinAndWait(
      guest,
      roomCode,
      "guest-id-b",
      "ayaan_7",
    );
    expect(guestJoin.presence.players).toMatchObject({
      A: { kind: "account", username: "ayaan_7" },
      B: { kind: "guest", displayName: "ayaan_7" },
    });
    expect(JSON.stringify(await accountPresence)).not.toContain(
      "private-user-id",
    );

    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      seatVersion: 2,
      slots: { A: "account:private-user-id", B: "guest:guest-id-b" },
      seats: {
        A: { kind: "account", usernameSnapshot: "ayaan_7" },
        B: { kind: "guest", displayName: "ayaan_7" },
      },
    });

    account.close();
    guest.close();
  });

  it("rejects forged, expired, wrong-room, and replayed tickets", async () => {
    const roomCode = await createRoom();
    const forged = await connectRoom(roomCode);
    const valid = await mintTestTicket("join", roomCode);
    const forgedTicket = forgeTicketSignature(valid);
    expect(forgedTicket).not.toBe(valid);
    const forgedClosed = waitForClose(forged);
    sendJson(
      forged,
      joinRoom(roomCode, "account-device-a", undefined, forgedTicket),
    );
    await expect(waitForMessage(forged, "error")).resolves.toMatchObject({
      code: "identityInvalid",
    });
    await expect(forgedClosed).resolves.toMatchObject({ code: 4003 });

    const expired = await connectRoom(roomCode);
    sendJson(
      expired,
      joinRoom(
        roomCode,
        "account-device-b",
        undefined,
        await mintTestTicket(
          "join",
          roomCode,
          {},
          Date.now() - IDENTITY_TICKET_TTL_MS - IDENTITY_TICKET_SKEW_MS,
        ),
      ),
    );
    await expect(waitForMessage(expired, "error")).resolves.toMatchObject({
      code: "identityExpired",
    });

    const wrongRoom = await connectRoom(roomCode);
    sendJson(
      wrongRoom,
      joinRoom(
        roomCode,
        "account-device-c",
        undefined,
        await mintTestTicket("join", "BCDEFGHJ"),
      ),
    );
    await expect(waitForMessage(wrongRoom, "error")).resolves.toMatchObject({
      code: "identityScope",
    });

    const first = await connectRoom(roomCode);
    const replayTicket = await mintTestTicket("join", roomCode);
    await joinAndWait(
      first,
      roomCode,
      "account-device-d",
      undefined,
      replayTicket,
    );
    const replay = await connectRoom(roomCode);
    sendJson(
      replay,
      joinRoom(roomCode, "account-device-e", undefined, replayTicket),
    );
    await expect(waitForMessage(replay, "error")).resolves.toMatchObject({
      code: "identityReplayed",
    });
    expect(await readStoredRoom(roomCode)).toMatchObject({
      slots: { A: "account:user-id-a" },
    });

    first.close();
    expired.close();
    wrongRoom.close();
  });

  it("allows one join retry after reconnect has no committed seat", async () => {
    const roomCode = await createRoom();
    const socket = await connectRoom(roomCode);
    sendJson(
      socket,
      joinRoom(
        roomCode,
        "account-device-a",
        undefined,
        await mintTestTicket("reconnect", roomCode),
      ),
    );
    await expect(waitForMessage(socket, "error")).resolves.toMatchObject({
      code: "identityScope",
    });
    expect(socket.readyState).toBe(WebSocket.OPEN);

    await expect(
      joinAndWait(
        socket,
        roomCode,
        "account-device-a",
        undefined,
        await mintTestTicket("join", roomCode),
      ),
    ).resolves.toMatchObject({ joined: { slot: "A" } });
    socket.close();
  });

  it("serializes simultaneous ticket reuse so exactly one join succeeds", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);
    const ticket = await mintTestTicket("join", roomCode);
    sendJson(first, joinRoom(roomCode, "account-device-a", undefined, ticket));
    sendJson(second, joinRoom(roomCode, "account-device-b", undefined, ticket));

    const outcomes = await Promise.all([
      waitForJoinedOrError(first),
      waitForJoinedOrError(second),
    ]);
    expect(
      outcomes.filter((message) => message.type === "joined"),
    ).toHaveLength(1);
    expect(outcomes.filter((message) => message.type === "error")).toEqual([
      expect.objectContaining({ code: "identityReplayed" }),
    ]);
    first.close();
    second.close();
  });

  it("takes over duplicate account connections and rejects the stale socket", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    await joinAndWait(
      first,
      roomCode,
      "account-device-a",
      undefined,
      await mintTestTicket("join", roomCode),
    );

    const closed = waitForClose(first);
    const replacement = await connectRoom(roomCode);
    await joinAndWait(
      replacement,
      roomCode,
      "account-device-b",
      undefined,
      await mintTestTicket("reconnect", roomCode),
    );
    await expect(closed).resolves.toMatchObject({ code: 4001 });
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      connections: { A: { connected: true, disconnectedAt: null } },
      seats: { A: { connectionEpoch: 2 } },
    });
    replacement.close();
  });

  it("migrates legacy room state and legacy socket attachments in memory", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);
    await joinAndWait(first, roomCode, "guest-id-a", "Ayaan");
    await joinAndWait(second, roomCode, "guest-id-b", "Cabdi");

    await patchStoredRoom(roomCode, (room) => {
      const legacy = { ...room };
      delete legacy.seatVersion;
      delete legacy.seats;
      return {
        ...legacy,
        slots: { A: "guest-id-a", B: "guest-id-b" },
        displayNames: { A: "Ayaan", B: "Cabdi" },
      };
    });
    await runInDurableObject(roomStub(roomCode), async (_instance, state) => {
      for (const socket of state.getWebSockets()) {
        const attachment = socket.deserializeAttachment() as {
          guestId?: string;
          slot?: "A" | "B";
        };
        socket.serializeAttachment({
          guestId: attachment.guestId,
          slot: attachment.slot,
        });
      }
    });

    const firstState = waitForMessage(first, "state");
    const secondState = waitForMessage(second, "state");
    sendAction(first, roomCode, { type: "place", player: "A", point: "O1" });
    await expect(firstState).resolves.toMatchObject({
      state: { board: { O1: "A" } },
    });
    await secondState;

    const reconnected = await connectRoom(roomCode);
    const rejoin = await joinAndWait(reconnected, roomCode, "guest-id-a");
    expect(rejoin.presence.players.A).toMatchObject({
      kind: "guest",
      displayName: "Ayaan",
    });
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      seatVersion: 2,
      slots: { A: "guest:guest-id-a", B: "guest:guest-id-b" },
      seats: {
        A: { connectionEpoch: 1, usedTickets: [] },
        B: { connectionEpoch: 0, usedTickets: [] },
      },
    });

    first.close();
    second.close();
    reconnected.close();
  });

  it("reattaches reconnecting guests to the same slot", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);

    await expect(
      joinAndWait(first, roomCode, "guest-id-a"),
    ).resolves.toMatchObject({
      joined: {
        type: "joined",
        slot: "A",
      },
    });
    first.close();

    const reconnected = await connectRoom(roomCode);
    sendJson(reconnected, joinRoom(roomCode, "guest-id-a"));

    await expect(waitForMessage(reconnected, "joined")).resolves.toMatchObject({
      type: "joined",
      guestId: "guest-id-a",
      slot: "A",
    });

    reconnected.close();
  });

  it("rejects illegal moves and keeps authoritative state", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    const firstPresenceAfterSecondJoin = waitForMessage(first, "presence");
    await joinAndWait(second, roomCode, "guest-id-b");
    await firstPresenceAfterSecondJoin;

    const errorPromise = waitForMessage(first, "error");
    sendAction(first, roomCode, { type: "place", player: "B", point: "O1" });

    await expect(errorPromise).resolves.toMatchObject({
      type: "error",
      code: "notYourTurn",
    });

    first.close();
    second.close();
  });

  it("responds to ping with the shared pong shape", async () => {
    const roomCode = await createRoom();
    const socket = await connectRoom(roomCode);

    sendJson(socket, { v: protocolVersion, type: "ping", nonce: "n-1" });

    await expect(nextJson(socket)).resolves.toEqual({
      v: protocolVersion,
      type: "pong",
      nonce: "n-1",
    });

    socket.close();
  });

  it("throttles stored activity writes for repeated unjoined pings", async () => {
    const initialTime = 1_000_000;
    const firstPingTime = initialTime + 31_000;
    vi.spyOn(Date, "now").mockReturnValue(initialTime);
    const roomCode = await createRoom();
    const socket = await connectRoom(roomCode);

    for (let index = 0; index < 20; index += 1) {
      vi.mocked(Date.now).mockReturnValue(firstPingTime + index * 100);
      sendJson(socket, {
        v: protocolVersion,
        type: "ping",
        nonce: `activity-${index}`,
      });
      await expect(nextJson(socket)).resolves.toMatchObject({
        type: "pong",
        nonce: `activity-${index}`,
      });
    }

    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      lastActivityAt: firstPingTime,
    });

    socket.close();
  });

  it("persists activity immediately with a valid game action", async () => {
    const initialTime = 1_000_000;
    const actionTime = initialTime + 1_000;
    vi.spyOn(Date, "now").mockReturnValue(initialTime);
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    const firstPresenceAfterSecondJoin = waitForMessage(first, "presence");
    await joinAndWait(second, roomCode, "guest-id-b");
    await firstPresenceAfterSecondJoin;

    vi.mocked(Date.now).mockReturnValue(actionTime);
    const firstState = waitForMessage(first, "state");
    const secondState = waitForMessage(second, "state");
    sendAction(first, roomCode, { type: "place", player: "A", point: "O1" });
    await firstState;
    await secondState;

    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      lastActivityAt: actionTime,
    });

    first.close();
    second.close();
  });

  it("reports invalid messages and keeps the socket usable", async () => {
    const roomCode = await createRoom();
    const socket = await connectRoom(roomCode);

    socket.send("{");
    await expect(nextJson(socket)).resolves.toMatchObject({
      type: "error",
      code: "invalidMessage",
    });

    sendJson(socket, {
      v: protocolVersion,
      type: "ping",
      nonce: "after-error",
    });
    await expect(nextJson(socket)).resolves.toMatchObject({
      type: "pong",
      nonce: "after-error",
    });

    socket.close();
  });

  it("rejects oversized messages and keeps the socket usable", async () => {
    const roomCode = await createRoom();
    const socket = await connectRoom(roomCode);

    socket.send("x".repeat(4_097));
    await expect(nextJson(socket)).resolves.toMatchObject({
      type: "error",
      code: "messageTooLarge",
    });

    sendJson(socket, {
      v: protocolVersion,
      type: "ping",
      nonce: "after-oversize",
    });
    await expect(nextJson(socket)).resolves.toMatchObject({
      type: "pong",
      nonce: "after-oversize",
    });

    socket.close();
  });

  it("rate-limits message floods and recovers after the window", async () => {
    const now = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const roomCode = await createRoom();
    const socket = await connectRoom(roomCode);

    for (let index = 0; index < 31; index += 1) {
      sendJson(socket, {
        v: protocolVersion,
        type: "ping",
        nonce: `flood-${index}`,
      });
    }

    await expect(waitForMessage(socket, "error")).resolves.toMatchObject({
      code: "rateLimited",
    });

    sendJson(socket, {
      v: protocolVersion,
      type: "ping",
      nonce: "still-limited",
    });
    await expect(waitForMessage(socket, "error")).resolves.toMatchObject({
      code: "rateLimited",
    });

    vi.mocked(Date.now).mockReturnValue(now + 11_000);
    sendJson(socket, {
      v: protocolVersion,
      type: "ping",
      nonce: "after-window",
    });
    await expect(
      waitForMessageWhere(
        socket,
        "pong",
        (message) => message.nonce === "after-window",
      ),
    ).resolves.toMatchObject({ nonce: "after-window" });

    socket.close();
  });

  it("broadcasts echo payloads to both connected guests", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    const firstBroadcast = waitForMessage(first, "echoBroadcast");
    const secondBroadcast = waitForMessage(second, "echoBroadcast");
    sendJson(first, {
      v: protocolVersion,
      type: "echo",
      roomCode,
      payload: "hello",
    });

    expect(await firstBroadcast).toEqual({
      v: protocolVersion,
      type: "echoBroadcast",
      roomCode,
      fromGuestId: "guest-id-a",
      payload: "hello",
    });
    expect(await secondBroadcast).toEqual({
      v: protocolVersion,
      type: "echoBroadcast",
      roomCode,
      fromGuestId: "guest-id-a",
      payload: "hello",
    });

    first.close();
    second.close();
  });

  it("does not broadcast echo payloads to unjoined or rejected sockets", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);
    const unjoined = await connectRoom(roomCode);
    const rejected = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    sendJson(rejected, joinRoom(roomCode, "guest-id-c"));
    await expect(waitForMessage(rejected, "error")).resolves.toMatchObject({
      type: "error",
      code: "roomFull",
    });

    const firstBroadcast = waitForMessage(first, "echoBroadcast");
    const secondBroadcast = waitForMessage(second, "echoBroadcast");
    sendJson(first, {
      v: protocolVersion,
      type: "echo",
      roomCode,
      payload: "hello",
    });

    await expect(firstBroadcast).resolves.toMatchObject({
      v: protocolVersion,
      type: "echoBroadcast",
      roomCode,
      fromGuestId: "guest-id-a",
      payload: "hello",
    });
    await expect(secondBroadcast).resolves.toMatchObject({
      v: protocolVersion,
      type: "echoBroadcast",
      roomCode,
      fromGuestId: "guest-id-a",
      payload: "hello",
    });
    await expect(nextJson(unjoined, 75)).rejects.toThrow(
      "Timed out waiting for WebSocket message.",
    );
    await expect(nextJson(rejected, 75)).rejects.toThrow(
      "Timed out waiting for WebSocket message.",
    );

    first.close();
    second.close();
    unjoined.close();
    rejected.close();
  });

  it("replays placement through initial removal with authoritative state broadcasts", async () => {
    const script = fullGameActionScripts.find(
      (candidate) => candidate.name === "placement-through-initial-removal",
    );
    expect(script).toBeDefined();
    if (!script) {
      return;
    }

    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    let latestState: GameState | null = null;
    for (const action of script.actions) {
      const socket = action.player === "A" ? first : second;
      const firstStatePromise = waitForMessage(first, "state");
      const secondStatePromise = waitForMessage(second, "state");
      sendAction(socket, roomCode, action);
      const firstState = await firstStatePromise;
      const secondState = await secondStatePromise;
      expect(firstState.state).toEqual(secondState.state);
      latestState = firstState.state;
    }

    expect(latestState).toEqual(script.expectedFinalState);

    first.close();
    second.close();
  });

  it("syncs movement jare and capture from an engine fixture", async () => {
    const script = a2ConformanceActionScripts.find(
      (candidate) => candidate.name === "movement-jare-pending-capture",
    );
    expect(script).toBeDefined();
    if (!script) {
      return;
    }

    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await replaceStoredGameState(roomCode, script.initialState);

    const action = script.actions[0];
    const firstPendingPromise = waitForMessage(first, "state");
    const secondPendingPromise = waitForMessage(second, "state");
    sendAction(first, roomCode, action);
    const pending = await firstPendingPromise;
    await secondPendingPromise;
    expect(pending.state).toEqual(script.expectedFinalState);
    expect(pending.state.phase).toBe("capture");

    const capturePoint = firstPointOwnedBy(pending.state, "B");
    const firstCapturePromise = waitForMessage(first, "state");
    const secondCapturePromise = waitForMessage(second, "state");
    sendAction(first, roomCode, {
      type: "capture",
      player: "A",
      point: capturePoint,
    });

    const firstCaptureState = await firstCapturePromise;
    const secondCaptureState = await secondCapturePromise;
    expect(firstCaptureState.state).toEqual(secondCaptureState.state);
    expect(firstCaptureState.state.phase).not.toBe("capture");
    expect(firstCaptureState.state.pendingCapture).toBeNull();

    first.close();
    second.close();
  });

  it("resends current state when the same guest rejoins", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    const firstStatePromise = waitForMessage(first, "state");
    const secondStatePromise = waitForMessage(second, "state");
    sendAction(first, roomCode, { type: "place", player: "A", point: "O1" });
    await firstStatePromise;
    await secondStatePromise;
    first.close();

    const reconnected = await connectRoom(roomCode);
    const rejoin = await joinAndWait(reconnected, roomCode, "guest-id-a");

    expect(rejoin.joined).toMatchObject({ type: "joined", slot: "A" });
    expect(rejoin.state).toMatchObject({
      type: "state",
      state: { board: { O1: "A" } },
    });

    reconnected.close();
    second.close();
  });

  it("marks a disconnected opponent claimable after grace", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    first.close();
    await waitForMessageWhere(second, "matchStatus", (message) => {
      return message.connections.A === false;
    });
    await patchStoredRoom(roomCode, (room) => ({
      ...room,
      connections: {
        ...(room.connections as Record<string, unknown>),
        A: { connected: false, disconnectedAt: Date.now() - 60_000 },
      },
    }));

    await triggerRoomAlarm(roomCode);
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      claimableBy: "B",
      claimReason: "opponentAbandoned",
    });

    second.close();
  });

  it("rejects claim-win before eligibility", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    first.close();
    await waitForMessageWhere(second, "matchStatus", (message) => {
      return message.connections.A === false;
    });
    sendClaimWin(second, roomCode);

    await expect(waitForMessage(second, "error")).resolves.toMatchObject({
      type: "error",
      code: "notClaimable",
    });

    second.close();
  });

  it("lets the opponent claim a win after disconnect grace", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    first.close();
    await waitForMessageWhere(second, "matchStatus", (message) => {
      return message.connections.A === false;
    });
    await patchStoredRoom(roomCode, (room) => ({
      ...room,
      connections: {
        ...(room.connections as Record<string, unknown>),
        A: { connected: false, disconnectedAt: Date.now() - 60_000 },
      },
    }));
    await triggerRoomAlarm(roomCode);
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      claimableBy: "B",
      claimReason: "opponentAbandoned",
    });

    const statePromise = waitForMessage(second, "state");
    const endedPromise = waitForMessage(second, "matchEnded");
    sendClaimWin(second, roomCode);

    await expect(statePromise).resolves.toMatchObject({
      type: "state",
      state: { phase: "gameOver", winner: "B", endReason: "resignation" },
    });
    await expect(endedPromise).resolves.toMatchObject({
      type: "matchEnded",
      winner: "B",
      reason: "opponentAbandoned",
    });

    const reconnected = await connectRoom(roomCode);
    const rejoin = await joinAndWait(reconnected, roomCode, "guest-id-a");
    expect(rejoin.state).toMatchObject({
      type: "state",
      state: { phase: "gameOver", winner: "B" },
    });
    await expect(
      waitForMessage(reconnected, "matchEnded"),
    ).resolves.toMatchObject({
      type: "matchEnded",
      winner: "B",
      reason: "opponentAbandoned",
    });

    reconnected.close();
    second.close();
  });

  it("nudges idle players once and allows idle claim-win", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await patchStoredRoom(roomCode, (room) => ({
      ...room,
      turnStartedAt: Date.now() - 90_000,
      nudgedTurnAt: null,
      claimableBy: null,
      claimReason: null,
    }));

    await triggerRoomAlarm(roomCode);
    const nudgedRoom = await readStoredRoom(roomCode);
    if (!nudgedRoom) {
      throw new Error("Expected stored room after idle nudge alarm.");
    }
    expect(nudgedRoom).toMatchObject({
      nudgedTurnAt: nudgedRoom.turnStartedAt,
      claimableBy: null,
    });

    await patchStoredRoom(roomCode, (room) => ({
      ...room,
      turnStartedAt: Date.now() - 240_000,
    }));
    await triggerRoomAlarm(roomCode);
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      claimableBy: "B",
      claimReason: "opponentIdleTimeout",
    });

    const statePromise = waitForMessage(second, "state");
    const endedPromise = waitForMessage(second, "matchEnded");
    sendClaimWin(second, roomCode);

    await expect(statePromise).resolves.toMatchObject({
      type: "state",
      state: { phase: "gameOver", winner: "B", endReason: "resignation" },
    });
    await expect(endedPromise).resolves.toMatchObject({
      type: "matchEnded",
      winner: "B",
      reason: "opponentIdleTimeout",
    });

    first.close();
    second.close();
  });

  it("clears abandonment claimability when the opponent reconnects", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    first.close();
    await waitForMessageWhere(second, "matchStatus", (message) => {
      return message.connections.A === false;
    });
    await patchStoredRoom(roomCode, (room) => ({
      ...room,
      connections: {
        ...(room.connections as Record<string, unknown>),
        A: { connected: false, disconnectedAt: Date.now() - 60_000 },
      },
    }));
    await triggerRoomAlarm(roomCode);
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      claimableBy: "B",
      claimReason: "opponentAbandoned",
    });

    const reconnected = await connectRoom(roomCode);
    await joinAndWait(reconnected, roomCode, "guest-id-a");
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      connections: {
        A: { connected: true, disconnectedAt: null },
        B: { connected: true, disconnectedAt: null },
      },
      claimableBy: null,
      claimReason: null,
    });

    reconnected.close();
    second.close();
  });

  it("broadcasts resignation as a game-over state", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    const firstStatePromise = waitForMessage(first, "state");
    const secondStatePromise = waitForMessage(second, "state");
    sendAction(first, roomCode, { type: "resign", player: "A" });

    await expect(firstStatePromise).resolves.toMatchObject({
      type: "state",
      state: { phase: "gameOver", winner: "B", endReason: "resignation" },
    });
    await expect(secondStatePromise).resolves.toMatchObject({
      type: "state",
      state: { phase: "gameOver", winner: "B", endReason: "resignation" },
    });

    first.close();
    second.close();
  });

  it("rejects rematch votes while the match is still live", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");

    sendRematch(first, roomCode, "accept");

    await expect(waitForMessage(first, "error")).resolves.toMatchObject({
      code: "rematchUnavailable",
    });
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      matchNumber: 1,
      rematch: { A: null, B: null },
    });

    first.close();
    second.close();
  });

  it("rejects rematch votes from sockets without a seat", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);
    const observer = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await resignToGameOver(first, second, roomCode);

    sendRematch(observer, roomCode, "accept");

    await expect(waitForMessage(observer, "error")).resolves.toMatchObject({
      code: "notJoined",
    });
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      rematch: { A: null, B: null },
    });

    first.close();
    second.close();
    observer.close();
  });

  it("keeps the finished game until both seats accept a rematch", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await resignToGameOver(first, second, roomCode);

    const opponentRequest = waitForMessage(second, "rematchStatus");
    sendRematch(first, roomCode, "accept");

    await expect(opponentRequest).resolves.toMatchObject({
      matchNumber: 1,
      votes: { A: "accept", B: null },
    });
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      matchNumber: 1,
      rematch: { A: "accept", B: null },
    });

    // A retried request must not restart the game or re-broadcast, so the
    // opponent's next message is the pong it asks for.
    sendRematch(first, roomCode, "accept");
    await expect(waitForMessage(first, "rematchStatus")).resolves.toMatchObject(
      {
        matchNumber: 1,
        votes: { A: "accept", B: null },
      },
    );
    sendJson(second, { v: protocolVersion, type: "ping", nonce: "idempotent" });
    await expect(nextJson(second)).resolves.toMatchObject({
      type: "pong",
      nonce: "idempotent",
    });

    const stored = await readStoredRoom(roomCode);
    expect(stored).toMatchObject({ matchNumber: 1 });
    expect(deserialize(String(stored?.gameState)).phase).toBe("gameOver");

    first.close();
    second.close();
  });

  it("starts one fresh match when the second seat accepts", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await resignToGameOver(first, second, roomCode);

    await waitForRematchVotes(first, second, roomCode, "accept", {
      A: "accept",
      B: null,
    });

    const firstFresh = waitForMessage(first, "state");
    const secondFresh = waitForMessage(second, "state");
    const firstStatus = waitForMessage(second, "rematchStatus");
    sendRematch(second, roomCode, "accept");

    await expect(firstStatus).resolves.toMatchObject({
      matchNumber: 2,
      votes: { A: null, B: null },
    });
    for (const state of [await firstFresh, await secondFresh]) {
      expect(state.state).toEqual(createInitialState("B"));
      expect(state.state.winner).toBeNull();
      expect(state.state.endReason).toBeNull();
    }

    const stored = await readStoredRoom(roomCode);
    expect(stored).toMatchObject({
      matchNumber: 2,
      rematch: { A: null, B: null },
      claimableBy: null,
      claimReason: null,
      onlineEndReason: null,
      nudgedTurnAt: null,
      slots: { A: "guest:guest-id-a", B: "guest:guest-id-b" },
    });
    expect(stored?.gameState).toEqual(serialize(createInitialState("B")));
    expect(stored?.turnStartedAt).toEqual(expect.any(Number));

    first.close();
    second.close();
  });

  it("resolves crossed rematch requests as one mutual agreement", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await resignToGameOver(first, second, roomCode);

    const firstFresh = waitForMessage(first, "state");
    const secondFresh = waitForMessage(second, "state");
    sendRematch(first, roomCode, "accept");
    sendRematch(second, roomCode, "accept");

    expect((await firstFresh).state.phase).toBe("placement");
    expect((await secondFresh).state.phase).toBe("placement");
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      matchNumber: 2,
      rematch: { A: null, B: null },
    });

    first.close();
    second.close();
  });

  it("keeps the completed result when a seat declines", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await resignToGameOver(first, second, roomCode);
    await waitForRematchVotes(first, second, roomCode, "accept", {
      A: "accept",
      B: null,
    });

    const declined = waitForMessageWhere(
      first,
      "rematchStatus",
      (message) => message.votes.B !== null,
    );
    sendRematch(second, roomCode, "decline");

    await expect(declined).resolves.toMatchObject({
      matchNumber: 1,
      votes: { A: null, B: "decline" },
    });

    const stored = await readStoredRoom(roomCode);
    expect(stored).toMatchObject({ matchNumber: 1 });
    expect(deserialize(String(stored?.gameState))).toMatchObject({
      phase: "gameOver",
      winner: "B",
      endReason: "resignation",
    });

    first.close();
    second.close();
  });

  it("clears a pending rematch on disconnect and restores it on reconnect", async () => {
    const roomCode = await createRoom();
    const first = await connectRoom(roomCode);
    const second = await connectRoom(roomCode);

    await joinAndWait(first, roomCode, "guest-id-a");
    await joinAndWait(second, roomCode, "guest-id-b");
    await resignToGameOver(first, second, roomCode);
    await waitForRematchVotes(first, second, roomCode, "accept", {
      A: "accept",
      B: null,
    });

    const withdrawn = waitForMessageWhere(
      second,
      "rematchStatus",
      (message) => message.votes.A === null,
    );
    first.close();
    await expect(withdrawn).resolves.toMatchObject({
      matchNumber: 1,
      votes: { A: null, B: null },
    });

    // The opponent now asks, and the reconnecting seat has to see that request.
    sendRematch(second, roomCode, "accept");
    await expect(
      waitForMessage(second, "rematchStatus"),
    ).resolves.toMatchObject({ votes: { A: null, B: "accept" } });

    const reconnected = await connectRoom(roomCode);
    const restoredVotes = waitForMessage(reconnected, "rematchStatus");
    await joinAndWait(reconnected, roomCode, "guest-id-a");
    await expect(restoredVotes).resolves.toMatchObject({
      matchNumber: 1,
      votes: { A: null, B: "accept" },
    });

    const fresh = waitForMessage(reconnected, "state");
    sendRematch(reconnected, roomCode, "accept");
    expect((await fresh).state.phase).toBe("placement");

    reconnected.close();
    second.close();
  });

  it("clears online end state and replays two rematches for mixed identities", async () => {
    const roomCode = await createRoom();
    const account = await connectRoom(roomCode);
    const guest = await connectRoom(roomCode);
    const ticket = await mintTestTicket("join", roomCode, {
      userId: "private-user-id",
      usernameSnapshot: "ayaan_7",
    });

    await joinAndWait(account, roomCode, "account-device-a", undefined, ticket);
    await joinAndWait(guest, roomCode, "guest-id-b", "Cabdi");

    // End the first match through the resilience path so claim state exists.
    guest.close();
    await waitForMessageWhere(
      account,
      "matchStatus",
      (message) => message.connections.B === false,
    );
    await patchStoredRoom(roomCode, (room) => ({
      ...room,
      connections: {
        ...(room.connections as Record<string, unknown>),
        B: { connected: false, disconnectedAt: Date.now() - 60_000 },
      },
    }));
    await triggerRoomAlarm(roomCode);
    await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
      claimableBy: "A",
      claimReason: "opponentAbandoned",
    });

    const ended = waitForMessage(account, "matchEnded");
    sendClaimWin(account, roomCode);
    await expect(ended).resolves.toMatchObject({
      winner: "A",
      reason: "opponentAbandoned",
    });

    const rejoined = await connectRoom(roomCode);
    await joinAndWait(rejoined, roomCode, "guest-id-b", "Cabdi");

    for (const matchNumber of [2, 3]) {
      const fresh = waitForMessage(account, "state");
      sendRematch(account, roomCode, "accept");
      await waitForMessageWhere(
        rejoined,
        "rematchStatus",
        (message) => message.votes.A === "accept",
      );
      sendRematch(rejoined, roomCode, "accept");

      expect((await fresh).state).toEqual(
        createInitialState(matchNumber === 2 ? "B" : "A"),
      );
      await expect(readStoredRoom(roomCode)).resolves.toMatchObject({
        matchNumber,
        onlineEndReason: null,
        claimableBy: null,
        claimReason: null,
        rematch: { A: null, B: null },
        slots: { A: "account:private-user-id", B: "guest:guest-id-b" },
      });

      // End the fresh match so the next rematch can be negotiated.
      await resignToGameOver(account, rejoined, roomCode);
    }

    const presence = waitForMessage(account, "presence");
    sendJson(rejoined, joinRoom(roomCode, "guest-id-b", "Cabdi"));
    expect((await presence).players).toMatchObject({
      A: { kind: "account", username: "ayaan_7" },
      B: { kind: "guest", displayName: "Cabdi" },
    });

    account.close();
    guest.close();
    rejoined.close();
  });

  it("recovers a pending save after eviction and a lost D1 acknowledgement", async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
    const { roomCode, first, second } = await accountRoom();
    await placeFirst(first, second, roomCode);
    // Simulate an outage without changing the outbox or the match transaction.
    await testEnv.DB.prepare(
      "ALTER TABLE match_player RENAME TO match_player_offline",
    ).run();
    const pending = waitForMessageWhere(
      first,
      "matchStatus",
      (message) => message.save?.status === "pending",
    );
    await resignToGameOver(first, second, roomCode);
    await pending;
    await expect
      .poll(async () => (await loadOutbox(roomCode))?.attempts)
      .toBe(1);
    const entry = await loadOutbox(roomCode);
    if (!entry) throw new Error("Expected durable outbox entry");
    expect(entry).toMatchObject({
      status: "pending",
      stalledReason: null,
      lastError: "D1 ledger write failed.",
    });
    expect(entry.nextAttemptAt! - entry.firstAttemptAt!).toBe(5_000);
    await expect(
      testEnv.DB.prepare("SELECT count(*) AS n FROM match").first("n"),
    ).resolves.toBe(0);
    await testEnv.DB.prepare(
      "ALTER TABLE match_player_offline RENAME TO match_player",
    ).run();

    // D1 committed, but the room never received an acknowledgement.
    await expect(
      saveMatch(testEnv.DB, entry.payload, entry.payloadHash),
    ).resolves.toMatchObject({ status: "saved", existed: false });
    await evictDurableObject(roomStub(roomCode));
    const saved = waitForMessageWhere(
      first,
      "matchStatus",
      (message) => message.save?.status === "saved",
    );
    await makeSaveDue(roomCode, entry);
    await triggerRoomAlarm(roomCode);
    await expect(saved).resolves.toMatchObject({
      save: { matchId: entry.payload.id, matchNumber: 1, status: "saved" },
    });
    await expect(loadOutbox(roomCode)).resolves.toBeUndefined();
    await expect(
      testEnv.DB.prepare("SELECT count(*) AS n FROM match").first("n"),
    ).resolves.toBe(1);
    await expect(
      testEnv.DB.prepare("SELECT count(*) AS n FROM match_player").first("n"),
    ).resolves.toBe(2);
    first.close();
    second.close();
  });

  it("retains expired rooms with integrity conflicts until an operator discards", async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
    const { roomCode, first, second } = await accountRoom();
    const placed = await placeFirst(first, second, roomCode);
    expect(placed.state.board.O1).toBe("A");
    await testEnv.DB.prepare(
      "ALTER TABLE match_player RENAME TO match_player_offline",
    ).run();
    await resignToGameOver(first, second, roomCode);
    await expect
      .poll(async () => (await loadOutbox(roomCode))?.attempts)
      .toBe(1);
    const entry = await loadOutbox(roomCode);
    if (!entry) throw new Error("Expected durable outbox entry");
    await testEnv.DB.prepare(
      "ALTER TABLE match_player_offline RENAME TO match_player",
    ).run();
    const conflict = { ...entry.payload, id: "BBBBBBBBBBBBBBBBBBBB" };
    await saveMatch(testEnv.DB, conflict, await matchPayloadHash(conflict));
    await makeSaveDue(roomCode, entry);
    await patchStoredRoom(roomCode, (room) => ({ ...room, lastActivityAt: 0 }));
    await triggerRoomAlarm(roomCode);

    await expect(websocketResponse(roomCode)).resolves.toMatchObject({
      status: 404,
    });
    const result = await opsRequest(`/ops/unsaved?room=${roomCode}`);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    const listing = await result.json();
    expect(listing).toMatchObject({
      expired: true,
      entries: [
        {
          matchNumber: 1,
          matchId: entry.payload.id,
          status: "stalled",
          stalledReason: "integrity",
        },
      ],
    });
    expect(JSON.stringify(listing)).not.toContain("ledger-account");
    expect(JSON.stringify(listing)).not.toContain("P:O1");
    await runInDurableObject(roomStub(roomCode), async (_instance, state) => {
      await expect(state.storage.getAlarm()).resolves.toBeNull();
    });

    const body = {
      roomCode,
      matchNumber: 1,
      matchId: "CCCCCCCCCCCCCCCCCCCC",
      reason: "Discard test fixture.",
    };
    await expect(opsRequest("/ops/discard", body)).resolves.toMatchObject({
      status: 409,
    });
    await expect(
      opsRequest("/ops/discard", { ...body, matchId: entry.payload.id }),
    ).resolves.toMatchObject({ status: 200 });
    await expect(readStoredRoom(roomCode)).resolves.toBeUndefined();
    const list = await opsRequest("/ops/unsaved");
    await expect(list.json()).resolves.toMatchObject({ rooms: [] });
  });

  it("sends a pending terminal state on reconnect after the original broadcast is interrupted", async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
    const { roomCode, first, second } = await accountRoom();
    await placeFirst(first, second, roomCode);
    const stub = roomStub(roomCode);
    await runInDurableObject(stub, async (instance, state) => {
      const room = instance as unknown as {
        broadcastState(): void;
        broadcastMatchStatus(): void;
        attemptSave(): Promise<void>;
        webSocketMessage(socket: WebSocket, message: string): Promise<void>;
      };
      const suppressState = vi
        .spyOn(room, "broadcastState")
        .mockImplementationOnce(() => {});
      const suppressStatus = vi
        .spyOn(room, "broadcastMatchStatus")
        .mockImplementationOnce(() => {});
      const suppressSave = vi
        .spyOn(room, "attemptSave")
        .mockResolvedValueOnce(undefined);
      try {
        const socket = state
          .getWebSockets()
          .find((socket) => socket.deserializeAttachment()?.slot === "A");
        if (!socket) throw new Error("Expected an authorized socket");
        await room.webSocketMessage(
          socket,
          JSON.stringify({
            v: protocolVersion,
            type: "gameAction",
            roomCode,
            action: { type: "resign", player: "A" },
          }),
        );
        expect(suppressState).toHaveBeenCalledOnce();
        expect(suppressStatus).toHaveBeenCalledOnce();
        expect(suppressSave).toHaveBeenCalledOnce();
      } finally {
        suppressState.mockRestore();
        suppressStatus.mockRestore();
        suppressSave.mockRestore();
      }
    });
    const entry = await loadOutbox(roomCode);
    if (!entry) throw new Error("Expected durable outbox entry");
    expect(entry.attempts).toBe(0);
    await evictDurableObject(stub, { webSockets: "close" });
    const rejoined = await connectRoom(roomCode);
    const pending = waitForMessageWhere(
      rejoined,
      "matchStatus",
      (message) => message.save?.status === "pending",
    );
    const joined = await joinAndWait(
      rejoined,
      roomCode,
      "ledger-guest-a",
      undefined,
      await mintTestTicket("reconnect", roomCode, {
        userId: "ledger-account-a",
      }),
    );
    expect(joined.state.state.phase).toBe("gameOver");
    await pending;

    const saved = waitForMessageWhere(
      rejoined,
      "matchStatus",
      (message) => message.save?.status === "saved",
    );
    await makeSaveDue(roomCode, entry);
    await triggerRoomAlarm(roomCode);
    await expect(saved).resolves.toMatchObject({
      save: { matchId: entry.payload.id },
    });
    rejoined.close();
    second.close();
  });

  it("rejects stale mutations without changing the board", async () => {
    const { roomCode, first, second } = await accountRoom();
    for (const message of [
      {
        type: "gameAction",
        action: { type: "place", player: "A", point: "O1" },
      },
      { type: "claimWin" },
      { type: "rematch", vote: "accept" },
    ]) {
      const error = waitForMessage(first, "error");
      sendJson(first, {
        v: protocolVersion,
        roomCode,
        matchNumber: 2,
        ...message,
      });
      await expect(error).resolves.toMatchObject({ code: "staleMatch" });
    }
    expect((await readStoredRoom(roomCode))?.gameState).toBe(
      serialize(createInitialState("A")),
    );
    first.close();
    second.close();
  });

  it("keeps the ops API out of browser requests and checks the bearer", async () => {
    const url = "https://shaxda.test/ops/unsaved";
    const unauthorized = await SELF.fetch(url);
    expect(unauthorized.status).toBe(401);
    const preflight = await SELF.fetch(url, {
      method: "OPTIONS",
      headers: { Origin: "https://shaxda.test" },
    });
    expect(preflight.status).toBe(404);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const browser = await SELF.fetch(url, {
      headers: {
        Origin: "https://shaxda.test",
        Authorization: `Bearer ${testEnv.MATCH_OPS_TOKEN}`,
      },
    });
    expect(browser.status).toBe(403);
  });

  it("keeps an invalid replay for inspection and refuses manual retry", async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
    const { roomCode, first, second } = await accountRoom();
    await placeFirst(first, second, roomCode);
    await runInDurableObject(
      roomStub(roomCode),
      async (_instance, { storage }) => {
        await storage.put("log", { v: 1, matchNumber: 1, s: "A", a: ["P:O2"] });
      },
    );
    await resignToGameOver(first, second, roomCode);
    const entry = await loadOutbox(roomCode);
    expect(entry).toMatchObject({
      status: "stalled",
      stalledReason: "replayMismatch",
      attempts: 0,
      nextAttemptAt: null,
    });
    if (!entry) throw new Error("Expected replay mismatch entry");
    const response = await roomStub(roomCode).fetch(
      "https://shaxda.internal/internal/ops/retry",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          matchNumber: 1,
          matchId: entry.payload.id,
        }),
      },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "notRetryable" });
    await expect(
      testEnv.DB.prepare("SELECT count(*) AS n FROM match").first("n"),
    ).resolves.toBe(0);
    const discard = await opsRequest("/ops/discard", {
      roomCode,
      matchNumber: 1,
      matchId: entry.payload.id,
      reason: "Clear invalid replay fixture.",
    });
    expect(discard.status).toBe(200);
    first.close();
    second.close();
  });

  it.each([false, true])(
    "handles rooms created before H1 with play begun = %s",
    async (playBegan) => {
      await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
      const { roomCode, first, second } = await accountRoom();
      if (playBegan) await placeFirst(first, second, roomCode);
      await runInDurableObject(
        roomStub(roomCode),
        async (_instance, { storage }) => {
          const room = await storage.get<Record<string, unknown>>("room");
          if (!room) throw new Error("Room disappeared");
          for (const key of [
            "rated",
            "consent",
            "playBeganAt",
            "unsaved",
            "lastSave",
          ])
            delete room[key];
          await storage.put("room", room);
          await storage.delete("log");
        },
      );
      if (!playBegan) await placeFirst(first, second, roomCode);
      const saved = playBegan
        ? null
        : waitForMessageWhere(
            first,
            "matchStatus",
            (status) => status.save?.status === "saved",
          );
      await resignToGameOver(first, second, roomCode);
      await saved;
      await expect(
        testEnv.DB.prepare("SELECT count(*) AS n FROM match").first("n"),
      ).resolves.toBe(playBegan ? 0 : 1);
      first.close();
      second.close();
    },
  );

  it("cleans room storage when the alarm runs after idle expiry", async () => {
    const roomCode = await createRoom();
    const stub = roomStub(roomCode);

    await runInDurableObject(stub, async (_instance, state) => {
      const room = await state.storage.get<Record<string, unknown>>("room");
      expect(room).toBeDefined();
      await state.storage.put("room", {
        ...room,
        lastActivityAt: 0,
      });
      await state.storage.setAlarm(Date.now() + 1_000);
    });

    await expect(runDurableObjectAlarm(stub)).resolves.toBe(true);
    await runInDurableObject(stub, async (_instance, state) => {
      await expect(state.storage.get("room")).resolves.toBeUndefined();
    });
    await runInDurableObject(coordinatorStub(), async (_instance, state) => {
      const coordinator =
        await state.storage.get<Record<string, unknown>>("coordinator");
      expect(
        coordinator &&
          typeof coordinator === "object" &&
          "activeRooms" in coordinator
          ? (coordinator.activeRooms as Record<string, unknown>)[roomCode]
          : undefined,
      ).toBeUndefined();
    });

    const response = await websocketResponse(roomCode);
    expect(response.status).toBe(404);
  });
});

async function accountRoom() {
  const roomCode = await createRoom();
  const first = await connectRoom(roomCode);
  const second = await connectRoom(roomCode);
  await joinAndWait(
    first,
    roomCode,
    "ledger-guest-a",
    undefined,
    await mintTestTicket("join", roomCode, { userId: "ledger-account-a" }),
  );
  await joinAndWait(
    second,
    roomCode,
    "ledger-guest-b",
    undefined,
    await mintTestTicket("join", roomCode, {
      userId: "ledger-account-b",
      usernameSnapshot: "cabdi_8",
    }),
  );
  return { roomCode, first, second };
}

async function placeFirst(
  first: WebSocket,
  second: WebSocket,
  roomCode: string,
) {
  const placed = waitForMessage(second, "state");
  sendAction(first, roomCode, { type: "place", player: "A", point: "O1" });
  return placed;
}

async function loadOutbox(roomCode: string) {
  return runInDurableObject(roomStub(roomCode), (_instance, state) =>
    state.storage.get<OutboxEntry>("outbox:1"),
  );
}

async function makeSaveDue(roomCode: string, entry: OutboxEntry) {
  await runInDurableObject(
    roomStub(roomCode),
    async (_instance, { storage }) => {
      const room = await storage.get<{
        unsaved: Record<number, OutboxSummary>;
      }>("room");
      if (!room) throw new Error("Room disappeared");
      const nextAttemptAt = Date.now() - 1;
      const due = { ...entry, nextAttemptAt };
      await storage.put({
        room: { ...room, unsaved: { ...room.unsaved, 1: outboxSummary(due) } },
        "outbox:1": due,
      });
      await storage.setAlarm(Date.now() + 5_000);
    },
  );
}

function opsRequest(path: string, body?: Record<string, unknown>) {
  return SELF.fetch(`https://shaxda.test${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${testEnv.MATCH_OPS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createRoom(): Promise<string> {
  const response = await SELF.fetch("https://shaxda.test/rooms", {
    method: "POST",
  });
  const body = serverMessageSchema.parse(await response.json());
  if (body.type !== "roomCreated") {
    throw new Error("Expected roomCreated response.");
  }

  return body.roomCode;
}

async function initializeRoom(roomCode: string): Promise<void> {
  const response = await roomStub(roomCode).fetch(
    "https://shaxda.test/internal/rooms/init",
    {
      method: "POST",
      body: JSON.stringify({ roomCode }),
      headers: { "Content-Type": "application/json" },
    },
  );

  expect(response.status).toBe(200);
}

async function websocketResponse(roomCode: string): Promise<Response> {
  return SELF.fetch(`https://shaxda.test/rooms/${roomCode}/ws`, {
    headers: { Upgrade: "websocket" },
  });
}

async function connectRoom(roomCode: string): Promise<WebSocket> {
  const response = await websocketResponse(roomCode);
  expect(response.status).toBe(101);
  expect(response.webSocket).toBeDefined();

  const socket = response.webSocket;
  if (!socket) {
    throw new Error("Expected WebSocket response.");
  }

  socket.accept();
  return socket;
}

function sendJson(socket: WebSocket, message: unknown): void {
  socket.send(JSON.stringify(message));
}

function sendAction(
  socket: WebSocket,
  roomCode: string,
  action: GameAction,
): void {
  sendJson(socket, {
    v: protocolVersion,
    type: "gameAction",
    roomCode,
    action,
  });
}

function sendRematch(
  socket: WebSocket,
  roomCode: string,
  vote: "accept" | "decline",
): void {
  sendJson(socket, {
    v: protocolVersion,
    type: "rematch",
    roomCode,
    vote,
  });
}

async function resignToGameOver(
  first: WebSocket,
  second: WebSocket,
  roomCode: string,
): Promise<void> {
  const firstState = waitForMessage(first, "state");
  const secondState = waitForMessage(second, "state");
  sendAction(first, roomCode, { type: "resign", player: "A" });

  expect((await firstState).state.phase).toBe("gameOver");
  expect((await secondState).state.phase).toBe("gameOver");
}

async function waitForRematchVotes(
  voter: WebSocket,
  opponent: WebSocket,
  roomCode: string,
  vote: "accept" | "decline",
  expected: { A: string | null; B: string | null },
): Promise<void> {
  const broadcast = waitForMessage(opponent, "rematchStatus");
  sendRematch(voter, roomCode, vote);
  await expect(broadcast).resolves.toMatchObject({ votes: expected });
}

function sendClaimWin(socket: WebSocket, roomCode: string): void {
  sendJson(socket, {
    v: protocolVersion,
    type: "claimWin",
    roomCode,
  });
}

function joinRoom(
  roomCode: string,
  guestId: string,
  displayName?: string,
  identityTicket?: string,
): unknown {
  return {
    v: protocolVersion,
    type: "joinRoom",
    roomCode,
    guestId,
    ...(displayName ? { displayName } : {}),
    ...(identityTicket ? { identityTicket } : {}),
  };
}

async function joinAndWait(
  socket: WebSocket,
  roomCode: string,
  guestId: string,
  displayName?: string,
  identityTicket?: string,
): Promise<{
  joined: Extract<ServerMessage, { type: "joined" }>;
  presence: Extract<ServerMessage, { type: "presence" }>;
  state: Extract<ServerMessage, { type: "state" }>;
}> {
  sendJson(socket, joinRoom(roomCode, guestId, displayName, identityTicket));

  const joined = await waitForMessage(socket, "joined");
  const presence = await waitForMessage(socket, "presence");
  const state = await waitForMessage(socket, "state");

  return { joined, presence, state };
}

async function waitForJoinedOrError(
  socket: WebSocket,
): Promise<
  | Extract<ServerMessage, { type: "joined" }>
  | Extract<ServerMessage, { type: "error" }>
> {
  for (;;) {
    const message = serverMessageSchema.parse(await nextJson(socket));
    if (message.type === "joined" || message.type === "error") return message;
  }
}

function waitForClose(
  socket: WebSocket,
): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    socket.addEventListener(
      "close",
      (event) => resolve({ code: event.code, reason: event.reason }),
      { once: true },
    );
  });
}

// A 32-byte HMAC-SHA-256 signature encodes to 43 base64url characters whose last
// character carries only four significant bits, so it is one of just sixteen
// values. Rewriting that character to a fixed one leaves the ticket untouched
// about one time in sixteen. The leading character has no such constraint, so
// flipping it always produces a signature that fails verification.
function forgeTicketSignature(ticket: string): string {
  const [payload, signature] = ticket.split(".") as [string, string];
  return `${payload}.${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
}

let ticketSequence = 0;

async function mintTestTicket(
  action: TicketAction,
  roomCode?: string,
  overrides: Partial<{
    userId: string;
    usernameSnapshot: string;
    avatarMode: "initial" | "google";
    imageUrl: string | null;
  }> = {},
  now = Date.now(),
): Promise<string> {
  ticketSequence += 1;
  return mintIdentityTicket(
    {
      iss: "shaxda-web",
      aud: "shaxda-rooms",
      action,
      ...(roomCode === undefined ? {} : { roomCode }),
      userId: overrides.userId ?? "user-id-a",
      usernameSnapshot: overrides.usernameSnapshot ?? "ayaan_7",
      avatarMode: overrides.avatarMode ?? "initial",
      imageUrl: overrides.imageUrl ?? null,
      jti: `testticket${ticketSequence.toString().padStart(10, "0")}`,
    },
    testEnv.ONLINE_IDENTITY_SECRET,
    now,
  );
}

async function waitForMessage<Type extends ServerMessage["type"]>(
  socket: WebSocket,
  type: Type,
  timeoutMs = 1_000,
): Promise<Extract<ServerMessage, { type: Type }>> {
  for (;;) {
    const message = serverMessageSchema.parse(
      await nextJson(socket, timeoutMs),
    );
    if (message.type === type) {
      return message as Extract<ServerMessage, { type: Type }>;
    }
  }
}

async function waitForMessageWhere<Type extends ServerMessage["type"]>(
  socket: WebSocket,
  type: Type,
  predicate: (message: Extract<ServerMessage, { type: Type }>) => boolean,
  timeoutMs = 1_000,
): Promise<Extract<ServerMessage, { type: Type }>> {
  for (;;) {
    const message = await waitForMessage(socket, type, timeoutMs);
    if (predicate(message)) {
      return message;
    }
  }
}

function nextJson(socket: WebSocket, timeoutMs = 1_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", handleMessage);
      reject(new Error("Timed out waiting for WebSocket message."));
    }, timeoutMs);

    function handleMessage(event: MessageEvent): void {
      clearTimeout(timeout);
      socket.removeEventListener("message", handleMessage);
      resolve(JSON.parse(String(event.data)));
    }

    socket.addEventListener("message", handleMessage);
  });
}

function roomStub(roomCode: string): DurableObjectStub {
  return testEnv.MATCH_ROOM.get(testEnv.MATCH_ROOM.idFromName(roomCode));
}

function coordinatorStub(): DurableObjectStub {
  return testEnv.MATCH_COORDINATOR.get(
    testEnv.MATCH_COORDINATOR.idFromName("global"),
  );
}

async function triggerRoomAlarm(roomCode: string): Promise<void> {
  await runInDurableObject(roomStub(roomCode), async (instance) => {
    await (instance as { alarm(): Promise<void> }).alarm();
  });
}

async function replaceStoredGameState(
  roomCode: string,
  state: GameState,
): Promise<void> {
  await runInDurableObject(roomStub(roomCode), async (_instance, storage) => {
    const room = await storage.storage.get<Record<string, unknown>>("room");
    expect(room).toBeDefined();
    await storage.storage.put("room", {
      ...room,
      gameState: serialize(state),
    });
  });
}

async function patchStoredRoom(
  roomCode: string,
  patch: (room: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  await runInDurableObject(roomStub(roomCode), async (_instance, storage) => {
    const room = await storage.storage.get<Record<string, unknown>>("room");
    expect(room).toBeDefined();
    if (!room) {
      return;
    }

    await storage.storage.put("room", patch(room));
    await storage.storage.setAlarm(Date.now() + 1_000);
  });
}

async function readStoredRoom(
  roomCode: string,
): Promise<Record<string, unknown> | undefined> {
  let stored: Record<string, unknown> | undefined;
  await runInDurableObject(roomStub(roomCode), async (_instance, storage) => {
    stored = await storage.storage.get<Record<string, unknown>>("room");
  });

  return stored;
}

function firstPointOwnedBy(state: GameState, player: PlayerId): PointId {
  for (const [point, owner] of Object.entries(state.board)) {
    if (owner === player) {
      return point as PointId;
    }
  }

  throw new Error(`No point owned by player ${player}.`);
}

function roomCodeBytes(roomCode: string): Uint8Array {
  return Uint8Array.from(roomCode, (character) => {
    const index = ROOM_CODE_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error(`Unsupported room-code character: ${character}`);
    }

    return index;
  });
}
