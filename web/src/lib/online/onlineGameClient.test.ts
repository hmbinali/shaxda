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

  it("sends an identity ticket when creating a room", async () => {
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

    await client.createRoom(undefined, "payload.signature");
    expect(fetchFn).toHaveBeenCalledWith("http://worker.test/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityTicket: "payload.signature" }),
    });
  });

  it("mints join and reconnect tickets per socket", async () => {
    vi.useFakeTimers();
    const requestTicket = vi
      .fn()
      .mockResolvedValueOnce(`${"a".repeat(24)}.${"b".repeat(43)}`)
      .mockResolvedValueOnce(`${"c".repeat(24)}.${"d".repeat(43)}`);
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    client.connect({
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      requestTicket,
    });
    const first = FakeWebSocket.latest();
    first.open();
    await vi.runAllTicks();
    expect(requestTicket).toHaveBeenNthCalledWith(1, "join", "ABCDEFGH");
    expect(JSON.parse(first.sent[0] ?? "")).toMatchObject({
      identityTicket: `${"a".repeat(24)}.${"b".repeat(43)}`,
    });

    first.close();
    vi.advanceTimersByTime(1_000);
    const second = FakeWebSocket.latest();
    second.open();
    await vi.runAllTicks();
    expect(requestTicket).toHaveBeenNthCalledWith(2, "reconnect", "ABCDEFGH");
    expect(JSON.parse(second.sent[0] ?? "")).toMatchObject({
      identityTicket: `${"c".repeat(24)}.${"d".repeat(43)}`,
    });
  });

  it("does not join or reconnect after ticket minting fails", async () => {
    vi.useFakeTimers();
    const errors: string[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onError: (error) => errors.push(error.message),
    });
    client.connect({
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      requestTicket: async () => {
        throw new Error("mint failed");
      },
    });
    const socket = FakeWebSocket.latest();
    socket.open();
    await vi.runAllTicks();
    vi.advanceTimersByTime(30_000);
    expect(socket.sent).toEqual([]);
    expect(FakeWebSocket.sockets).toHaveLength(1);
    expect(errors).toEqual(["mint failed"]);
  });

  it("sends nothing when closed while ticket minting is pending", async () => {
    let resolveTicket: ((ticket: string) => void) | undefined;
    const pending = new Promise<string>((resolve) => {
      resolveTicket = resolve;
    });
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    client.connect({
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      requestTicket: async () => pending,
    });
    const socket = FakeWebSocket.latest();
    socket.open();
    client.close();
    resolveTicket?.(`${"a".repeat(24)}.${"b".repeat(43)}`);
    await Promise.resolve();
    expect(socket.sent).toEqual([]);
  });

  it("reports connected only after a minted join reaches the socket", async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    let resolveTicket: ((ticket: string) => void) | undefined;
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
    });
    client.connect({
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      requestTicket: async () =>
        new Promise<string>((resolve) => {
          resolveTicket = resolve;
        }),
    });
    const first = FakeWebSocket.latest();
    first.open();
    await vi.runAllTicks();
    expect(statuses).toEqual(["connecting"]);
    expect(first.sent).toEqual([]);

    resolveTicket?.(`${"a".repeat(24)}.${"b".repeat(43)}`);
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses).toEqual(["connecting", "connected"]);
    expect(first.sent).toHaveLength(1);

    first.close();
    vi.advanceTimersByTime(1_000);
    const second = FakeWebSocket.latest();
    second.open();
    await vi.runAllTicks();
    expect(statuses.at(-1)).toBe("reconnecting");
    expect(second.sent).toEqual([]);

    resolveTicket?.(`${"c".repeat(24)}.${"d".repeat(43)}`);
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)).toBe("connected");
    expect(second.sent).toHaveLength(1);
  });

  it("treats account replacement as intentional", () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onStatus: (status) => statuses.push(status),
    });
    client.connect({ roomCode: "ABCDEFGH", guestId: "guest-id-a" });
    const socket = FakeWebSocket.latest();
    socket.open();
    socket.close(4001, "replaced");
    vi.advanceTimersByTime(30_000);
    expect(statuses.at(-1)).toBe("replaced");
    expect(FakeWebSocket.sockets).toHaveLength(1);
  });

  it("retries a missing reconnect seat once with a join ticket", async () => {
    vi.useFakeTimers();
    const requestTicket = vi
      .fn()
      .mockResolvedValue(`${"a".repeat(24)}.${"b".repeat(43)}`);
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      wsBase: "ws://worker.test",
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });
    client.connect({
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      requestTicket,
    });
    const first = FakeWebSocket.latest();
    first.open();
    await vi.runAllTicks();
    first.close();
    vi.advanceTimersByTime(1_000);
    const reconnect = FakeWebSocket.latest();
    reconnect.open();
    await vi.runAllTicks();
    reconnect.message({
      v: protocolVersion,
      type: "error",
      code: "identityScope",
      message: "No seat",
    });
    await vi.runAllTicks();
    expect(requestTicket.mock.calls.map((call) => call[0])).toEqual([
      "join",
      "reconnect",
      "join",
    ]);
    expect(reconnect.sent).toHaveLength(2);
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

  close(code = 1000, reason = ""): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close", { code, reason }));
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
