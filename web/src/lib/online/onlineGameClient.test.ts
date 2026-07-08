import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameFixtures, protocolVersion } from "@shaxda/shared";
import { OnlineCreateRoomError, OnlineGameClient } from "./onlineGameClient";

describe("OnlineGameClient", () => {
  beforeEach(() => {
    FakeWebSocket.sockets = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates rooms through the worker", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        v: protocolVersion,
        type: "roomCreated",
        roomCode: "ABCDEFGH",
      }),
    ) as unknown as typeof fetch;
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      fetchFn,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });

    await expect(client.createRoom()).resolves.toBe("ABCDEFGH");
    expect(fetchFn).toHaveBeenCalledWith("http://worker.test/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });

  it("sends optional Turnstile tokens when creating rooms", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        v: protocolVersion,
        type: "roomCreated",
        roomCode: "ABCDEFGH",
      }),
    ) as unknown as typeof fetch;
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      fetchFn,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });

    await client.createRoom("turnstile-token");

    expect(fetchFn).toHaveBeenCalledWith("http://worker.test/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken: "turnstile-token" }),
    });
  });

  it("maps create-room failure codes", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(
        { error: "rateLimited", code: "rateLimited" },
        { status: 429 },
      ),
    ) as unknown as typeof fetch;
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      fetchFn,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });

    await expect(client.createRoom()).rejects.toMatchObject({
      name: "OnlineCreateRoomError",
      code: "rateLimited",
    } satisfies Partial<OnlineCreateRoomError>);
  });

  it("sends join and game-action messages and parses inbound state", () => {
    const messages: unknown[] = [];
    const statuses: string[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      fetchFn: vi.fn() as unknown as typeof fetch,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onMessage: (message) => messages.push(message),
      onStatus: (status) => statuses.push(status),
    });

    client.connect({
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      displayName: " Ayaan ",
    });
    const socket = FakeWebSocket.latest();
    socket.open();

    expect(statuses).toEqual(["connecting", "connected"]);
    expect(JSON.parse(socket.sent[0] ?? "")).toEqual({
      v: protocolVersion,
      type: "joinRoom",
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      displayName: "Ayaan",
    });

    expect(
      client.sendGameAction({ type: "place", player: "A", point: "O1" }),
    ).toBe(true);
    expect(JSON.parse(socket.sent[1] ?? "")).toEqual({
      v: protocolVersion,
      type: "gameAction",
      roomCode: "ABCDEFGH",
      action: { type: "place", player: "A", point: "O1" },
    });

    socket.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: gameFixtures.emptyBoard,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "state", roomCode: "ABCDEFGH" });
  });

  it("ignores close events from sockets replaced by reconnects", () => {
    const statuses: string[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      fetchFn: vi.fn() as unknown as typeof fetch,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
    });

    client.connect({ roomCode: "ABCDEFGH", guestId: "guest-id-a" });
    const firstSocket = FakeWebSocket.latest();
    firstSocket.open();

    client.connect({ roomCode: "JKLMNPQR", guestId: "guest-id-a" });
    const secondSocket = FakeWebSocket.latest();
    secondSocket.open();
    firstSocket.dispatchEvent(new Event("close"));

    expect(statuses).toEqual([
      "connecting",
      "connected",
      "connecting",
      "connected",
    ]);
  });

  it("reconnects after unexpected close and resends join", () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      fetchFn: vi.fn() as unknown as typeof fetch,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
    });

    client.connect({
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      displayName: "Ayaan",
    });
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().close();

    expect(statuses).toEqual(["connecting", "connected", "reconnecting"]);

    vi.advanceTimersByTime(1_000);
    const reconnected = FakeWebSocket.latest();
    expect(FakeWebSocket.sockets).toHaveLength(2);
    reconnected.open();

    expect(JSON.parse(reconnected.sent[0] ?? "")).toEqual({
      v: protocolVersion,
      type: "joinRoom",
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      displayName: "Ayaan",
    });
    expect(statuses.at(-1)).toBe("connected");
  });

  it("does not reconnect after intentional close", () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      fetchFn: vi.fn() as unknown as typeof fetch,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
    });

    client.connect({ roomCode: "ABCDEFGH", guestId: "guest-id-a" });
    FakeWebSocket.latest().open();
    client.close();
    vi.advanceTimersByTime(10_000);

    expect(FakeWebSocket.sockets).toHaveLength(1);
    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("stops reconnecting after five failed attempts", () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const errors: string[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      fetchFn: vi.fn() as unknown as typeof fetch,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
      onError: (error) => errors.push(error.message),
    });

    client.connect({ roomCode: "ABCDEFGH", guestId: "guest-id-a" });
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().close();

    for (const delay of OnlineGameClient.reconnectDelaysMs) {
      vi.advanceTimersByTime(delay);
      FakeWebSocket.latest().close();
    }

    expect(statuses.at(-1)).toBe("error");
    expect(errors.at(-1)).toBe("WebSocket reconnect failed.");
    expect(FakeWebSocket.sockets).toHaveLength(6);
  });

  it("parses match status and match-ended messages", () => {
    const messages: unknown[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      fetchFn: vi.fn() as unknown as typeof fetch,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onMessage: (message) => messages.push(message),
    });

    client.connect({ roomCode: "ABCDEFGH", guestId: "guest-id-a" });
    const socket = FakeWebSocket.latest();
    socket.open();
    socket.message({
      v: protocolVersion,
      type: "matchStatus",
      roomCode: "ABCDEFGH",
      connections: { A: true, B: false },
      idleSlot: null,
      claimableBy: "A",
      claimReason: "opponentAbandoned",
    });
    socket.message({
      v: protocolVersion,
      type: "matchEnded",
      roomCode: "ABCDEFGH",
      winner: "A",
      reason: "opponentAbandoned",
    });

    expect(messages).toEqual([
      expect.objectContaining({ type: "matchStatus", claimableBy: "A" }),
      expect.objectContaining({
        type: "matchEnded",
        reason: "opponentAbandoned",
      }),
    ]);
  });

  it("sends claim-win messages", () => {
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      fetchFn: vi.fn() as unknown as typeof fetch,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });

    client.connect({ roomCode: "ABCDEFGH", guestId: "guest-id-a" });
    const socket = FakeWebSocket.latest();
    socket.open();

    expect(client.sendClaimWin()).toBe(true);
    expect(JSON.parse(socket.sent[1] ?? "")).toEqual({
      v: protocolVersion,
      type: "claimWin",
      roomCode: "ABCDEFGH",
    });
  });
});

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static sockets: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(readonly url: string) {
    super();
    FakeWebSocket.sockets.push(this);
  }

  static latest(): FakeWebSocket {
    const socket = FakeWebSocket.sockets.at(-1);
    if (!socket) {
      throw new Error("No fake socket was created.");
    }
    return socket;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  message(data: unknown): void {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(data) }),
    );
  }
}
