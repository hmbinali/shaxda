import {
  env,
  reset,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { protocolVersion, serverMessageSchema } from "@shaxda/shared";

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

    sendJson(first, joinRoom(roomCode, "guest-id-a"));
    await expect(nextJson(first)).resolves.toMatchObject({
      type: "joined",
      guestId: "guest-id-a",
      slot: "A",
    });

    sendJson(second, joinRoom(roomCode, "guest-id-b"));
    await expect(nextJson(second)).resolves.toMatchObject({
      type: "joined",
      guestId: "guest-id-b",
      slot: "B",
    });

    sendJson(third, joinRoom(roomCode, "guest-id-c"));
    await expect(nextJson(third)).resolves.toMatchObject({
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

    sendJson(first, joinRoom(roomCode, "guest-id-a"));
    await expect(nextJson(first)).resolves.toMatchObject({
      type: "joined",
      slot: "A",
    });
    first.close();

    const reconnected = await connectRoom(roomCode);
    sendJson(reconnected, joinRoom(roomCode, "guest-id-a"));

    await expect(nextJson(reconnected)).resolves.toMatchObject({
      type: "joined",
      guestId: "guest-id-a",
      slot: "A",
    });

    reconnected.close();
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

    sendJson(first, joinRoom(roomCode, "guest-id-a"));
    await nextJson(first);
    sendJson(second, joinRoom(roomCode, "guest-id-b"));
    await nextJson(second);

    const firstBroadcast = nextJson(first);
    const secondBroadcast = nextJson(second);
    sendJson(first, {
      v: protocolVersion,
      type: "echo",
      roomCode,
      payload: "hello",
    });

    expect(serverMessageSchema.parse(await firstBroadcast)).toEqual({
      v: protocolVersion,
      type: "echoBroadcast",
      roomCode,
      fromGuestId: "guest-id-a",
      payload: "hello",
    });
    expect(serverMessageSchema.parse(await secondBroadcast)).toEqual({
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

    sendJson(first, joinRoom(roomCode, "guest-id-a"));
    await nextJson(first);
    sendJson(second, joinRoom(roomCode, "guest-id-b"));
    await nextJson(second);
    sendJson(rejected, joinRoom(roomCode, "guest-id-c"));
    await expect(nextJson(rejected)).resolves.toMatchObject({
      type: "error",
      code: "roomFull",
    });

    const firstBroadcast = nextJson(first);
    const secondBroadcast = nextJson(second);
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

function joinRoom(roomCode: string, guestId: string): unknown {
  return {
    v: protocolVersion,
    type: "joinRoom",
    roomCode,
    guestId,
  };
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

function roomCodeBytes(roomCode: string): Uint8Array {
  return Uint8Array.from(roomCode, (character) => {
    const index = ROOM_CODE_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error(`Unsupported room-code character: ${character}`);
    }

    return index;
  });
}
