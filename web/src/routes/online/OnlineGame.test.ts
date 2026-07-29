import { messages } from "@shaxda/i18n";
import { gameFixtures, protocolVersion } from "@shaxda/shared";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShellHarness from "$lib/shell/AppShellHarness.svelte";

vi.mock("$lib/site/metadata", () => ({
  absoluteUrl: (path: string) => `https://shaxda.example${path}`,
  ogImagePath: "/og-image.png",
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  replaceState: vi.fn(),
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
    renderOnlineGame();

    expect(
      screen.getByRole("heading", { name: copy.heading }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-room")).toHaveTextContent(
      copy.createRoom,
    );
    expect(screen.getByTestId("join-room")).toHaveTextContent(copy.joinRoom);
    expect(
      within(screen.getByTestId("app-top-bar")).getAllByRole("button"),
    ).toHaveLength(3);
  });

  it("creates a room and shows the lobby", async () => {
    renderOnlineGame();

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
    expect(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: messages.so.localGame.controls.exit,
      }),
    ).toBeVisible();

    await fireEvent.click(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: messages.so.localGame.controls.exit,
      }),
    );
    await fireEvent.click(
      screen.getByRole("button", {
        name: messages.so.localGame.tabletop.confirm,
      }),
    );

    expect(FakeWebSocket.latest().readyState).toBe(FakeWebSocket.CLOSED);
    await waitFor(() =>
      expect(screen.getByTestId("create-room")).toBeVisible(),
    );
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
    renderOnlineGame();

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
    renderOnlineGame();

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
    expect(screen.getByTestId("game-announcer")).toHaveTextContent(
      `${messages.so.localGame.announce.winner}: Bilan`,
    );
    expect(screen.getByTestId("online-game-result")).not.toHaveTextContent(
      copy.result.reasons.opponentAbandoned.winner,
    );
    expect(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: messages.so.localGame.controls.exit,
      }),
    ).toBeVisible();
  });

  it("seats a player B viewer at the bottom without rotating or remapping colour", async () => {
    renderOnlineGame();

    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Bilan" },
    });
    await fireEvent.click(screen.getByTestId("create-room"));
    await waitFor(() => expect(FakeWebSocket.sockets).toHaveLength(1));

    const socket = FakeWebSocket.latest();
    socket.open();
    socket.message({
      v: protocolVersion,
      type: "joined",
      roomCode: "ABCDEFGH",
      guestId: "guest-id-b",
      slot: "B",
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
      state: gameFixtures.midPlacement,
    });

    await waitFor(() =>
      expect(screen.getByTestId("online-board")).toBeVisible(),
    );
    const rails = screen.getAllByTestId(/^player-rail-/);
    expect(rails.map((rail) => rail.dataset.player)).toEqual(["A", "B"]);
    expect(screen.getByTestId("player-rail-A")).toHaveAttribute(
      "data-rotated",
      "false",
    );
    expect(screen.getByTestId("player-rail-B")).toHaveAttribute(
      "data-rotated",
      "false",
    );
    expect(screen.getByTestId("player-rail-A")).toHaveTextContent(
      messages.so.localGame.tabletop.states.opponentActing,
    );
    expect(screen.getByTestId("player-rail-A")).not.toHaveTextContent(
      messages.so.localGame.tabletop.states.acting,
    );
    expect(document.querySelector('[data-occupant="B"]')).toBeInTheDocument();
    expect(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: messages.so.localGame.controls.resign,
      }),
    ).toBeVisible();
    expect(
      within(screen.getByTestId("app-top-bar")).queryByRole("button", {
        name: messages.so.localGame.controls.exit,
      }),
    ).not.toBeInTheDocument();
  });

  it("places connection notices with their owner and keeps claim-win actionable at centre", async () => {
    renderOnlineGame();

    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Ayaan" },
    });
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
      state: gameFixtures.midPlacement,
    });
    socket.message({
      v: protocolVersion,
      type: "matchStatus",
      roomCode: "ABCDEFGH",
      connections: { A: true, B: false },
      idleSlot: null,
      claimableBy: "A",
      claimReason: "opponentAbandoned",
    });

    await waitFor(() =>
      expect(screen.getByTestId("online-board")).toBeVisible(),
    );
    expect(
      within(screen.getByTestId("player-rail-B")).getByText(
        copy.notices.opponentDisconnected,
      ),
    ).toBeVisible();
    expect(
      within(screen.getByTestId("player-rail-A")).queryByText(
        copy.notices.opponentDisconnected,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.claimWin })).toBeVisible();

    socket.close();

    await waitFor(() =>
      expect(
        within(screen.getByTestId("player-rail-A")).getByText(
          copy.notices.reconnecting,
        ),
      ).toBeVisible(),
    );
  });
});

function renderOnlineGame() {
  return render(AppShellHarness, { component: OnlineGamePage });
}

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
