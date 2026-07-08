import { beforeEach, describe, expect, it, vi } from "vitest";
import { gameFixtures, protocolVersion } from "@shaxda/shared";
import { OnlineGameClient } from "./onlineGameClient";

describe("OnlineGameClient", () => {
  beforeEach(() => {
    FakeWebSocket.sockets = [];
  });

  it("creates rooms through the worker", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        v: protocolVersion,
        type: "roomCreated",
        roomCode: "ROOM-1",
      }),
    ) as unknown as typeof fetch;
    const client = new OnlineGameClient({
      httpBase: "http://worker.test",
      fetchFn,
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    });

    await expect(client.createRoom()).resolves.toBe("ROOM-1");
    expect(fetchFn).toHaveBeenCalledWith("http://worker.test/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
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
      roomCode: "ROOM-1",
      guestId: "guest-id-a",
      displayName: " Ayaan ",
    });
    const socket = FakeWebSocket.latest();
    socket.open();

    expect(statuses).toEqual(["connecting", "connected"]);
    expect(JSON.parse(socket.sent[0] ?? "")).toEqual({
      v: protocolVersion,
      type: "joinRoom",
      roomCode: "ROOM-1",
      guestId: "guest-id-a",
      displayName: "Ayaan",
    });

    expect(
      client.sendGameAction({ type: "place", player: "A", point: "O1" }),
    ).toBe(true);
    expect(JSON.parse(socket.sent[1] ?? "")).toEqual({
      v: protocolVersion,
      type: "gameAction",
      roomCode: "ROOM-1",
      action: { type: "place", player: "A", point: "O1" },
    });

    socket.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ROOM-1",
      state: gameFixtures.emptyBoard,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "state", roomCode: "ROOM-1" });
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

    client.connect({ roomCode: "ROOM-1", guestId: "guest-id-a" });
    const firstSocket = FakeWebSocket.latest();
    firstSocket.open();

    client.connect({ roomCode: "ROOM-2", guestId: "guest-id-a" });
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
