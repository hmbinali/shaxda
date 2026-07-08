import { messages } from "@shaxda/i18n";
import { gameFixtures, protocolVersion } from "@shaxda/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/site/metadata", () => ({
  absoluteUrl: (path: string) => `https://shaxda.example${path}`,
  ogImagePath: "/og-image.png",
}));

import OnlineGamePage from "./+page.svelte";

const copy = messages.so.onlineGame;

describe("/online", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          v: protocolVersion,
          type: "roomCreated",
          roomCode: "ABCDEFGH",
        }),
      ),
    );
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    FakeWebSocket.sockets = [];
  });

  it("renders create and join controls", () => {
    render(OnlineGamePage);

    expect(
      screen.getByRole("heading", { name: copy.heading }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-room")).toHaveTextContent(
      copy.createRoom,
    );
    expect(screen.getByTestId("join-room")).toHaveTextContent(copy.joinRoom);
  });

  it("creates a room and shows the lobby", async () => {
    render(OnlineGamePage);

    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Ayaan" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("create-room")).toBeEnabled(),
    );
    await fireEvent.click(screen.getByTestId("create-room"));

    await waitFor(() =>
      expect(screen.getByTestId("online-lobby")).toHaveTextContent(
        copy.waiting,
      ),
    );
    expect(
      (screen.getByTestId("share-link") as HTMLInputElement).value,
    ).toContain("/online?room=ABCDEFGH");
    expect(FakeWebSocket.latest().url).toContain("/rooms/ABCDEFGH/ws");
  });

  it("shows specific create-room errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "rateLimited", code: "rateLimited" },
          { status: 429 },
        ),
      ),
    );
    render(OnlineGamePage);

    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Ayaan" },
    });
    await fireEvent.click(screen.getByTestId("create-room"));

    await waitFor(() =>
      expect(screen.getByTestId("online-feedback")).toHaveTextContent(
        copy.errors.rateLimited,
      ),
    );
  });

  it("shows loser-perspective copy after an online claim-win", async () => {
    render(OnlineGamePage);

    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Ayaan" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("create-room")).toBeEnabled(),
    );
    await fireEvent.click(screen.getByTestId("create-room"));
    await waitFor(() => expect(FakeWebSocket.sockets).toHaveLength(1));

    const socket = FakeWebSocket.latest();
    socket.open();
    socket.message({
      v: protocolVersion,
      type: "joined",
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      slot: "A",
    });
    socket.message({
      v: protocolVersion,
      type: "presence",
      roomCode: "ABCDEFGH",
      players: {
        A: { displayName: "Ayaan" },
        B: { displayName: "Bilan" },
      },
      started: true,
    });
    socket.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: {
        ...gameFixtures.win,
        winner: "B",
        endReason: "resignation",
      },
    });
    socket.message({
      v: protocolVersion,
      type: "matchEnded",
      roomCode: "ABCDEFGH",
      winner: "B",
      reason: "opponentAbandoned",
    });

    await waitFor(() =>
      expect(screen.getByTestId("online-game-result")).toHaveTextContent(
        copy.result.reasons.opponentAbandoned.loser,
      ),
    );
    expect(screen.getByTestId("online-game-result")).not.toHaveTextContent(
      copy.result.reasons.opponentAbandoned.winner,
    );
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
