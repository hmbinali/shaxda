import {
  env,
  reset,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serialize } from "@shaxda/game-engine";
import type {
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "@shaxda/game-engine";
import {
  a2ConformanceActionScripts,
  fullGameActionScripts,
  protocolVersion,
  serverMessageSchema,
} from "@shaxda/shared";
import type { ServerMessage } from "@shaxda/shared";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const testEnv = env as {
  MATCH_ROOM: DurableObjectNamespace;
};

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

    const response = await websocketResponse(roomCode);
    expect(response.status).toBe(404);
  });
});

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
): unknown {
  return {
    v: protocolVersion,
    type: "joinRoom",
    roomCode,
    guestId,
    ...(displayName ? { displayName } : {}),
  };
}

async function joinAndWait(
  socket: WebSocket,
  roomCode: string,
  guestId: string,
  displayName?: string,
): Promise<{
  joined: Extract<ServerMessage, { type: "joined" }>;
  presence: Extract<ServerMessage, { type: "presence" }>;
  state: Extract<ServerMessage, { type: "state" }>;
}> {
  sendJson(socket, joinRoom(roomCode, guestId, displayName));

  const joined = await waitForMessage(socket, "joined");
  const presence = await waitForMessage(socket, "presence");
  const state = await waitForMessage(socket, "state");

  return { joined, presence, state };
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
