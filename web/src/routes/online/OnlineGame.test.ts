import { messages, siteContent } from "@shaxda/i18n";
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

import { replaceState } from "$app/navigation";
import OnlineGamePage from "./+page.svelte";

const copy = messages.so.onlineGame;
const topBarCopy = siteContent.so.topBar;

describe("/online", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/online");
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/api/online/identity")
          ? Response.json({ status: "signedOut" })
          : Response.json({
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
    vi.unstubAllEnvs();
    Reflect.deleteProperty(window, "turnstile");
    window.history.replaceState({}, "", "/");
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
      screen.queryByText(messages.so.localGame.phaseLabel),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("app-top-bar")).queryAllByRole("button"),
    ).toHaveLength(0);
  });

  it("renders a complete account identity without a guest-name field", async () => {
    const ticket = `${"a".repeat(24)}.${"b".repeat(43)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/online/identity")) {
          return init?.method === "POST"
            ? Response.json({ ticket, expiresAt: Date.now() + 90_000 })
            : Response.json({
                status: "complete",
                account: {
                  username: "ayaan_7",
                  avatar: {
                    mode: "initial",
                    imageUrl: null,
                    color: "#332016",
                    initial: "A",
                  },
                },
              });
        }
        return Response.json({
          v: protocolVersion,
          type: "roomCreated",
          roomCode: "ABCDEFGH",
        });
      }),
    );
    renderOnlineGame();

    expect(
      await screen.findByTestId("online-account-identity"),
    ).toHaveTextContent("@ayaan_7");
    expect(screen.queryByLabelText(copy.nameLabel)).not.toBeInTheDocument();
    await fireEvent.click(screen.getByTestId("create-room"));
    await waitFor(() => expect(FakeWebSocket.sockets).toHaveLength(1));
    expect(roomCreateRequests()).toHaveLength(1);
  });

  it("keeps guest play available for an incomplete account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ status: "incomplete" })),
    );
    renderOnlineGame();

    expect(await screen.findByText(copy.identity.incomplete)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: copy.identity.completeRegistration,
      }),
    ).toHaveAttribute("href", "/register?returnTo=%2Fonline");
    expect(screen.getByLabelText(copy.nameLabel)).toBeVisible();
  });

  it("requires explicit guest continuation when identity status is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    renderOnlineGame();

    expect(await screen.findByText(copy.identity.unavailable)).toBeVisible();
    expect(screen.getByTestId("create-room")).toBeDisabled();
    expect(screen.queryByLabelText(copy.nameLabel)).not.toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole("button", { name: copy.identity.continueAsGuest }),
    );
    expect(screen.getByLabelText(copy.nameLabel)).toBeVisible();
    expect(screen.getByTestId("create-room")).toBeEnabled();
  });

  it("does not auto-join an invite while identity status is loading", async () => {
    window.localStorage.setItem("shaxda:guest-name:v1", "Ayaan");
    window.history.replaceState({}, "", "/online?room=ROOM1234");
    let resolveStatus: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          await new Promise<Response>((resolve) => {
            resolveStatus = resolve;
          }),
      ),
    );
    renderOnlineGame();

    expect(screen.getByTestId("join-room")).toBeDisabled();
    expect(FakeWebSocket.sockets).toHaveLength(0);
    resolveStatus?.(Response.json({ status: "signedOut" }));
    await waitFor(() => expect(FakeWebSocket.sockets).toHaveLength(1));
  });

  it("joins on Enter when an invite code is present", async () => {
    window.history.replaceState({}, "", "/online?room=ROOM1234");
    renderOnlineGame();
    await waitForGuestForm();

    const name = screen.getByLabelText(copy.nameLabel);
    await fireEvent.input(name, { target: { value: "Ayaan" } });
    await fireEvent.submit(name.closest("form")!);

    await waitFor(() => expect(FakeWebSocket.sockets).toHaveLength(1));
    expect(FakeWebSocket.latest().url).toContain("/rooms/ROOM1234/ws");
    expect(roomCreateRequests()).toHaveLength(0);
  });

  it("creates on Enter when the code is empty", async () => {
    renderOnlineGame();
    await waitForGuestForm();
    const name = screen.getByLabelText(copy.nameLabel);
    await fireEvent.input(name, { target: { value: "Ayaan" } });
    await fireEvent.submit(name.closest("form")!);

    await waitFor(() => expect(roomCreateRequests()).toHaveLength(1));
    expect(FakeWebSocket.latest().url).toContain("/rooms/ABCDEFGH/ws");
  });

  it("keeps Create and Join tied to their labels", async () => {
    const first = renderOnlineGame();
    await waitForGuestForm();
    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Ayaan" },
    });
    await fireEvent.input(screen.getByLabelText(copy.roomCodeLabel), {
      target: { value: "ROOM1234" },
    });
    await fireEvent.click(screen.getByTestId("create-room"));

    await waitFor(() => expect(roomCreateRequests()).toHaveLength(1));
    expect(FakeWebSocket.latest().url).toContain("/rooms/ABCDEFGH/ws");

    first.unmount();
    FakeWebSocket.sockets = [];
    vi.mocked(fetch).mockClear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/online");
    renderOnlineGame();
    await waitForGuestForm();
    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Bilan" },
    });
    await fireEvent.input(screen.getByLabelText(copy.roomCodeLabel), {
      target: { value: "ROOM5678" },
    });
    await fireEvent.click(screen.getByTestId("join-room"));

    expect(FakeWebSocket.latest().url).toContain("/rooms/ROOM5678/ws");
    expect(roomCreateRequests()).toHaveLength(0);
  });

  it("shows a useful empty-name error and focuses the field", async () => {
    renderOnlineGame();
    await waitForGuestForm();

    await fireEvent.click(screen.getByTestId("create-room"));

    expect(screen.getByTestId("online-feedback")).toHaveTextContent(
      copy.errors.nameRequired,
    );
    expect(screen.getByLabelText(copy.nameLabel)).toHaveFocus();
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
        copy.connection.connecting,
      ),
    );
    expect(
      (screen.getByTestId("share-link") as HTMLInputElement).value,
    ).toContain("/online?room=ABCDEFGH");
    expect(FakeWebSocket.latest().url).toContain("/rooms/ABCDEFGH/ws");
    await fireEvent.click(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: topBarCopy.menuLabel,
      }),
    );
    await fireEvent.click(
      screen.getByRole("menuitem", {
        name: messages.so.localGame.controls.leaveRoom,
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

  it("removes and recreates Turnstile when the room form returns", async () => {
    vi.stubEnv("PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    const renderWidget = vi.fn(
      (_container: HTMLElement, options: { callback(token: string): void }) => {
        options.callback(`token-${renderWidget.mock.calls.length}`);
        return `widget-${renderWidget.mock.calls.length}`;
      },
    );
    const removeWidget = vi.fn();
    window.turnstile = {
      render: renderWidget,
      reset: vi.fn(),
      remove: removeWidget,
    };
    renderOnlineGame();

    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Ayaan" },
    });
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("create-room")).toBeEnabled(),
    );
    await fireEvent.click(screen.getByTestId("create-room"));
    await waitFor(() => expect(removeWidget).toHaveBeenCalledWith("widget-1"));

    await fireEvent.click(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: topBarCopy.menuLabel,
      }),
    );
    await fireEvent.click(
      screen.getByRole("menuitem", {
        name: messages.so.localGame.controls.leaveRoom,
      }),
    );
    await fireEvent.click(
      screen.getByRole("button", {
        name: messages.so.localGame.tabletop.confirm,
      }),
    );

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledTimes(1);
  });

  it("shows specific create-room errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/api/online/identity")
          ? Response.json({ status: "signedOut" })
          : Response.json(
              { error: "rateLimited", code: "rateLimited" },
              { status: 429 },
            ),
      ),
    );
    renderOnlineGame();
    await waitForGuestForm();

    await fireEvent.input(screen.getByLabelText(copy.nameLabel), {
      target: { value: "Ayaan" },
    });
    await fireEvent.click(screen.getByTestId("create-room"));

    await waitFor(() =>
      expect(screen.getByTestId("online-feedback")).toHaveTextContent(
        copy.errors.rateLimited,
      ),
    );

    const firstNotice = screen.getByTestId("online-feedback");
    await waitFor(() =>
      expect(screen.getByTestId("create-room")).toBeEnabled(),
    );
    await fireEvent.click(screen.getByTestId("create-room"));
    await waitFor(() => expect(roomCreateRequests()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getByTestId("online-feedback")).not.toBe(firstNotice),
    );
    expect(screen.getByTestId("online-feedback")).toHaveTextContent(
      copy.errors.rateLimited,
    );
  });

  it("re-announces identical in-game server errors and clears lobby errors when play starts", async () => {
    renderOnlineGame();
    await waitForGuestForm();
    await fireEvent.click(screen.getByTestId("create-room"));
    expect(screen.getByTestId("online-feedback")).toHaveTextContent(
      copy.errors.nameRequired,
    );
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

    await waitFor(() =>
      expect(screen.getByTestId("online-board")).toBeVisible(),
    );
    expect(screen.queryByTestId("online-feedback")).not.toBeInTheDocument();

    const error = {
      v: protocolVersion,
      type: "error" as const,
      code: "notYourTurn",
      message: "It is not your turn.",
    };
    socket.message(error);
    const firstToast = await screen.findByTestId("online-feedback");
    const firstNonce = firstToast.dataset.feedbackNonce;
    socket.message(error);
    await waitFor(() =>
      expect(
        screen.getByTestId("online-feedback").dataset.feedbackNonce,
      ).not.toBe(firstNonce),
    );
    expect(screen.getByTestId("online-feedback")).toHaveTextContent(
      copy.errors.notYourTurn,
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
    expect(screen.getAllByTestId("game-result-panel")).toHaveLength(1);
    expect(screen.getByTestId("online-game-result")).toHaveAttribute(
      "role",
      "dialog",
    );
    expect(screen.getByTestId("online-game-result")).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByTestId("online-rematch")).toHaveFocus();
    expect(screen.getByTestId("online-new-match")).toHaveTextContent(
      copy.newRoom,
    );
    expect(
      within(screen.getByTestId("app-top-bar")).queryByRole("button", {
        name: messages.so.localGame.controls.newGame,
      }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('[data-point-id="O1"]')).not.toHaveAttribute(
      "role",
    );
    expect(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: topBarCopy.menuLabel,
      }),
    ).toBeVisible();
    expect(screen.getByTestId("app-top-bar")).toHaveProperty("inert", true);
  });

  it("seats a player B viewer at the bottom without rotating or remapping colour", async () => {
    renderOnlineGame();
    await waitForGuestForm();

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
    expect(screen.queryByTestId("game-details-panel")).not.toBeInTheDocument();
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
    await fireEvent.click(document.querySelector('[data-point-id="M2"]')!);
    expect(await screen.findByTestId("online-feedback")).toHaveTextContent(
      copy.invalid.notYourTurn,
    );
    await fireEvent.click(
      within(screen.getByTestId("app-top-bar")).getByRole("button", {
        name: topBarCopy.menuLabel,
      }),
    );
    expect(
      screen.getByRole("menuitem", {
        name: messages.so.localGame.controls.resign,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", {
        name: messages.so.localGame.controls.leaveRoom,
      }),
    ).toBeVisible();
  });

  it("negotiates a rematch from the result overlay and waits for the server", async () => {
    const socket = await startFinishedGame();

    await fireEvent.click(screen.getByTestId("online-rematch"));

    expect(sentRematchVotes(socket)).toEqual(["accept"]);
    // The finished game must stay on screen until the server confirms.
    expect(screen.getByTestId("online-game-result")).toBeInTheDocument();

    socket.message(rematchStatusMessage(1, { A: "accept", B: null }));
    await waitFor(() =>
      expect(screen.getByTestId("online-game-result-notice")).toHaveTextContent(
        copy.rematch.notices.requested,
      ),
    );
    expect(screen.queryByTestId("online-rematch")).not.toBeInTheDocument();

    socket.message(rematchStatusMessage(1, { A: null, B: "decline" }));
    await waitFor(() =>
      expect(screen.getByTestId("online-game-result-notice")).toHaveTextContent(
        copy.rematch.notices.declinedByOpponent,
      ),
    );
    expect(screen.getByTestId("online-rematch")).toHaveTextContent(
      copy.rematch.request,
    );

    socket.message(rematchStatusMessage(1, { A: null, B: "accept" }));
    await waitFor(() =>
      expect(screen.getByTestId("online-game-result-notice")).toHaveTextContent(
        copy.rematch.notices.opponentRequested,
      ),
    );
    expect(screen.getByTestId("online-rematch")).toHaveTextContent(
      copy.rematch.accept,
    );
    expect(screen.getByTestId("online-rematch-decline")).toBeVisible();

    await fireEvent.click(screen.getByTestId("online-rematch"));
    expect(sentRematchVotes(socket)).toEqual(["accept", "accept"]);
    await waitFor(() =>
      expect(screen.getByTestId("online-game-result-notice")).toHaveTextContent(
        copy.rematch.notices.starting,
      ),
    );

    socket.message(rematchStatusMessage(2, { A: null, B: null }));
    socket.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: gameFixtures.emptyBoard,
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId("online-game-result"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("online-board")).toBeVisible();
    expect(document.querySelector('[data-point-id="O1"]')).toHaveAttribute(
      "role",
      "button",
    );
  });

  it("declines a rematch and keeps the completed result", async () => {
    const socket = await startFinishedGame();
    socket.message(rematchStatusMessage(1, { A: null, B: "accept" }));

    await waitFor(() =>
      expect(screen.getByTestId("online-rematch-decline")).toBeVisible(),
    );
    await fireEvent.click(screen.getByTestId("online-rematch-decline"));

    expect(sentRematchVotes(socket)).toEqual(["decline"]);

    socket.message(rematchStatusMessage(1, { A: "decline", B: null }));
    await waitFor(() =>
      expect(screen.getByTestId("online-game-result-notice")).toHaveTextContent(
        copy.rematch.notices.declinedByMe,
      ),
    );
    expect(screen.getByTestId("online-game-result")).toHaveTextContent(
      `${messages.so.localGame.result.winnerLabel}: Bilan`,
    );
  });

  it("returns to a clean lobby on new match without rejoining the room", async () => {
    const socket = await startFinishedGame();

    await fireEvent.click(screen.getByTestId("online-new-match"));

    await waitFor(() =>
      expect(screen.getByTestId("online-page")).toBeVisible(),
    );
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    expect(replaceState).toHaveBeenLastCalledWith("/online", {});
    expect(screen.getByLabelText(copy.roomCodeLabel)).toHaveValue("");
    expect(screen.getByTestId("create-room")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("app-top-bar")).queryAllByRole("button"),
    ).toHaveLength(0);
    expect(FakeWebSocket.sockets).toHaveLength(1);
  });

  it("places connection notices with their owner and keeps claim-win actionable at centre", async () => {
    renderOnlineGame();
    await waitForGuestForm();

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
    const centralPoint = document.querySelector<HTMLElement>(
      '[data-point-id="M2"]',
    );
    expect(centralPoint).toHaveAttribute("role", "button");
    await fireEvent.click(centralPoint!);
    expect(
      socket.sent.some((message) => message.includes('"point":"M2"')),
    ).toBe(true);

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

async function startFinishedGame(): Promise<FakeWebSocket> {
  renderOnlineGame();
  await waitForGuestForm();
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
    players: { A: { displayName: "Ayaan" }, B: { displayName: "Bilan" } },
    started: true,
  });
  socket.message({
    v: protocolVersion,
    type: "state",
    roomCode: "ABCDEFGH",
    state: { ...gameFixtures.win, winner: "B", endReason: "resignation" },
  });

  await screen.findByTestId("online-game-result");
  return socket;
}

function rematchStatusMessage(
  matchNumber: number,
  votes: { A: string | null; B: string | null },
): unknown {
  return {
    v: protocolVersion,
    type: "rematchStatus",
    roomCode: "ABCDEFGH",
    matchNumber,
    votes,
  };
}

function sentRematchVotes(socket: FakeWebSocket): string[] {
  return socket.sent
    .map((message) => JSON.parse(message) as { type: string; vote?: string })
    .filter((message) => message.type === "rematch")
    .map((message) => String(message.vote));
}

function renderOnlineGame() {
  return render(AppShellHarness, {
    component: OnlineGamePage,
    pathname: "/online",
  });
}

async function waitForGuestForm(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId("create-room")).toBeEnabled());
}

function roomCreateRequests(): unknown[][] {
  return vi.mocked(fetch).mock.calls.filter(([input, init]) => {
    return String(input).endsWith("/rooms") && init?.method === "POST";
  });
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
