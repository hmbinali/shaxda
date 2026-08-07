import { describe, expect, it } from "vitest";
import { gameFixtures, protocolVersion } from "@shaxda/shared";
import {
  applyAction,
  createInitialState,
  type GameAction,
  type GameState,
} from "@shaxda/game-engine";
import type { ServerMessage } from "@shaxda/shared";
import { createOnlineGameController } from "./onlineGame.svelte";
import type {
  OnlineConnectionStatus,
  OnlineGameClientCallbacks,
  JoinRoomOptions,
} from "./onlineGameClient";
import type { OnlineGameClient } from "./onlineGameClient";

describe("OnlineGameController", () => {
  it("gates interaction until connected, joined, and started", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    game.clickPoint("O1");

    expect(game.invalid?.reason).toBe("actionRejected");
    expect(client.actions).toHaveLength(0);
  });

  it("sends actions and waits for authoritative state", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    game.joinRoom("abcdefgh", "guest-id-a", "Ayaan");
    client.status("connected");
    client.message({
      v: protocolVersion,
      type: "joined",
      roomCode: "ABCDEFGH",
      guestId: "guest-id-a",
      slot: "A",
    });
    client.message({
      v: protocolVersion,
      type: "presence",
      roomCode: "ABCDEFGH",
      players: { A: { displayName: "Ayaan" }, B: { displayName: "Cabdi" } },
      started: true,
    });
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: gameFixtures.emptyBoard,
    });

    game.clickPoint("O1");

    expect(game.state.board.O1).toBeNull();
    expect(client.actions).toEqual([
      { type: "place", player: "A", point: "O1" },
    ]);

    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: {
        ...gameFixtures.emptyBoard,
        board: { ...gameFixtures.emptyBoard.board, O1: "A" },
        players: {
          ...gameFixtures.emptyBoard.players,
          A: { inHand: 11, captured: 0 },
        },
        currentPlayer: "B",
      },
    });

    expect(game.state.board.O1).toBe("A");
    expect(game.lastAction).toMatchObject({
      action: { type: "place", player: "A", point: "O1" },
    });
    expect(game.feedback?.cues).toEqual(["place"]);
  });

  it("keeps the board actionable for opponent-turn feedback", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: { ...gameFixtures.emptyBoard, currentPlayer: "B" },
    });

    expect(game.boardInteractive).toBe(true);
    expect(game.canInteract).toBe(false);
    game.clickPoint("O1");
    expect(game.invalid?.reason).toBe("notYourTurn");
    expect(game.feedback?.cues).toEqual(["invalid"]);
    expect(client.actions).toHaveLength(0);
  });

  it("infers an action from a remote state without a pending action", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: firstPlacementState(),
    });

    expect(game.lastAction).toMatchObject({
      action: { type: "place", player: "A", point: "O1" },
    });
    expect(game.feedback?.cues).toEqual(["place"]);
  });

  it("cancels online selection after an invalid destination and on request", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: gameFixtures.blockedPlayer,
    });

    game.clickPoint("O2");
    expect(game.selected).toBe("O2");

    game.clickPoint("O1");
    expect(game.selected).toBeNull();
    expect(game.invalid?.reason).toBe("illegalMove");

    game.clickPoint("O2");
    game.cancelSelection();
    expect(game.selected).toBeNull();
  });

  it("marks an inferred placement jare for announcement", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });
    const actions = [
      { type: "place", player: "A", point: "O1" },
      { type: "place", player: "B", point: "M1" },
      { type: "place", player: "A", point: "O2" },
      { type: "place", player: "B", point: "M3" },
      { type: "place", player: "A", point: "O3" },
    ] as const satisfies readonly GameAction[];

    joinStartedGame(game, client);

    for (const action of actions) {
      const result = applyAction(game.state, action);
      if (!result.ok) {
        throw new Error(result.error);
      }
      client.message({
        v: protocolVersion,
        type: "state",
        roomCode: "ABCDEFGH",
        state: result.state,
      });
    }

    expect(game.lastAction).toMatchObject({
      action: actions.at(-1),
      formedJare: true,
    });
    expect(game.feedback?.cues).toEqual(["place", "jare"]);
  });

  it("marks unmatched remote snapshots for a summarized announcement", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    const initialSyncNonce = game.stateSyncNonce;
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: gameFixtures.movement,
    });

    expect(game.lastAction).toBeNull();
    expect(game.stateSyncNonce).toBe(initialSyncNonce + 1);
  });

  it("surfaces server errors as invalid feedback", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    client.message({
      v: protocolVersion,
      type: "error",
      code: "notYourTurn",
      message: "It is not your turn.",
    });

    expect(game.lastServerError).toBe("notYourTurn");
    expect(game.invalid?.reason).toBe("actionRejected");
    expect(game.feedback?.cues).toEqual(["invalid"]);
  });

  it("tracks match status and sends claim-win", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    client.message({
      v: protocolVersion,
      type: "matchStatus",
      roomCode: "ABCDEFGH",
      connections: { A: true, B: false },
      idleSlot: null,
      claimableBy: "A",
      claimReason: "opponentAbandoned",
    });

    expect(game.opponentConnected).toBe(false);
    expect(game.canClaimWin).toBe(true);

    game.claimWin();

    expect(client.claims).toEqual(["ABCDEFGH"]);
  });

  it("tracks idle status, reconnecting, and online end reasons", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    client.status("reconnecting");
    client.message({
      v: protocolVersion,
      type: "matchStatus",
      roomCode: "ABCDEFGH",
      connections: { A: true, B: true },
      idleSlot: "A",
      claimableBy: null,
      claimReason: null,
    });
    client.message({
      v: protocolVersion,
      type: "matchEnded",
      roomCode: "ABCDEFGH",
      winner: "B",
      reason: "opponentIdleTimeout",
    });

    expect(game.connectionStatus).toBe("reconnecting");
    expect(game.isIdlePlayer).toBe(true);
    expect(game.onlineEndReason).toBe("opponentIdleTimeout");
  });

  it("does not apply rejected actions to later state updates", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    game.clickPoint("O1");

    expect(client.actions).toEqual([
      { type: "place", player: "A", point: "O1" },
    ]);

    client.message({
      v: protocolVersion,
      type: "error",
      code: "notYourTurn",
      message: "It is not your turn.",
    });
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: gameFixtures.emptyBoard,
    });

    expect(game.lastAction).toBeNull();
    expect(game.feedback?.cues).toEqual(["invalid"]);
  });

  it("rejects rematch votes until the server reports game over", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    game.requestRematch();

    expect(game.canRematch).toBe(false);
    expect(game.rematchStage).toBe("unavailable");
    expect(game.invalid?.reason).toBe("actionRejected");
    expect(client.rematchVotes).toEqual([]);

    endGame(client);
    game.requestRematch();

    expect(game.canRematch).toBe(true);
    expect(client.rematchVotes).toEqual(["accept"]);
    // The finished game stays on screen until the server confirms a new match.
    expect(game.state.phase).toBe("gameOver");
    expect(game.matchNumber).toBe(1);
  });

  it("blocks rematch votes while the connection is not live", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    endGame(client);
    client.status("reconnecting");
    game.requestRematch();

    expect(game.canRematch).toBe(false);
    expect(client.rematchVotes).toEqual([]);
  });

  it("tracks the negotiation and clears the finished game on a fresh match", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    endGame(client);
    client.message({
      v: protocolVersion,
      type: "matchEnded",
      roomCode: "ABCDEFGH",
      winner: "B",
      reason: "opponentAbandoned",
    });
    client.message(rematchStatus(1, { A: null, B: "accept" }));

    expect(game.rematchStage).toBe("opponentRequested");

    game.requestRematch();

    expect(client.rematchVotes).toEqual(["accept"]);
    expect(game.rematchStage).toBe("starting");

    client.message(rematchStatus(2, { A: null, B: null }));
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: createInitialState("A"),
    });

    expect(game.matchNumber).toBe(2);
    expect(game.state).toEqual(createInitialState("A"));
    expect(game.status.winner).toBeNull();
    expect(game.status.endReason).toBeNull();
    expect(game.lastAction).toBeNull();
    expect(game.selected).toBeNull();
    expect(game.onlineEndReason).toBeNull();
    expect(game.rematchStage).toBe("unavailable");
    expect(game.canInteract).toBe(true);
  });

  it("keeps the finished game after a decline and allows asking again", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    endGame(client);
    game.requestRematch();
    client.message(rematchStatus(1, { A: null, B: "decline" }));

    expect(game.rematchStage).toBe("declinedByOpponent");
    expect(game.state.phase).toBe("gameOver");
    expect(game.matchNumber).toBe(1);

    game.requestRematch();
    client.message(rematchStatus(1, { A: "accept", B: "decline" }));

    expect(client.rematchVotes).toEqual(["accept", "accept"]);
    expect(game.rematchStage).toBe("requested");

    game.declineRematch();
    client.message(rematchStatus(1, { A: "decline", B: null }));

    expect(client.rematchVotes).toEqual(["accept", "accept", "decline"]);
    expect(game.rematchStage).toBe("declinedByMe");
  });

  it("drops an optimistic starting state when the server rejects the vote", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    endGame(client);
    client.message(rematchStatus(1, { A: null, B: "accept" }));
    game.requestRematch();

    expect(game.rematchStage).toBe("starting");

    client.message({
      v: protocolVersion,
      type: "error",
      code: "rematchUnavailable",
      message: "A rematch is only available once the game is over.",
    });

    expect(game.rematchStage).toBe("opponentRequested");
    expect(game.lastServerError).toBe("rematchUnavailable");
  });

  it("resets displayed game state when joining and leaving rooms", () => {
    const client = new FakeClient();
    const game = createOnlineGameController({
      client: client as unknown as OnlineGameClient,
    });

    joinStartedGame(game, client);
    game.clickPoint("O1");
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ABCDEFGH",
      state: firstPlacementState(),
    });
    client.message({
      v: protocolVersion,
      type: "error",
      code: "notYourTurn",
      message: "It is not your turn.",
    });

    expect(game.state.board.O1).toBe("A");
    expect(game.lastAction).not.toBeNull();
    expect(game.feedback).not.toBeNull();

    game.joinRoom("jklmnpqr", "guest-id-a", "Ayaan");

    expect(client.joined?.roomCode).toBe("JKLMNPQR");
    expectDisplayedInitialState(game);

    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "JKLMNPQR",
      state: firstPlacementState(),
    });
    client.message({
      v: protocolVersion,
      type: "error",
      code: "notYourTurn",
      message: "It is not your turn.",
    });

    game.leave();

    expect(game.roomCode).toBeNull();
    expect(game.connectionStatus).toBe("idle");
    expectDisplayedInitialState(game);
  });
});

function joinStartedGame(
  game: ReturnType<typeof createOnlineGameController>,
  client: FakeClient,
): void {
  game.joinRoom("abcdefgh", "guest-id-a", "Ayaan");
  client.status("connected");
  client.message({
    v: protocolVersion,
    type: "joined",
    roomCode: "ABCDEFGH",
    guestId: "guest-id-a",
    slot: "A",
  });
  client.message({
    v: protocolVersion,
    type: "presence",
    roomCode: "ABCDEFGH",
    players: { A: { displayName: "Ayaan" }, B: { displayName: "Cabdi" } },
    started: true,
  });
  client.message({
    v: protocolVersion,
    type: "state",
    roomCode: "ABCDEFGH",
    state: gameFixtures.emptyBoard,
  });
}

function endGame(client: FakeClient): void {
  client.message({
    v: protocolVersion,
    type: "state",
    roomCode: "ABCDEFGH",
    state: { ...gameFixtures.win, winner: "B", endReason: "resignation" },
  });
}

function rematchStatus(
  matchNumber: number,
  votes: { A: "accept" | "decline" | null; B: "accept" | "decline" | null },
): ServerMessage {
  return {
    v: protocolVersion,
    type: "rematchStatus",
    roomCode: "ABCDEFGH",
    matchNumber,
    votes,
  };
}

function firstPlacementState(): GameState {
  return {
    ...gameFixtures.emptyBoard,
    board: { ...gameFixtures.emptyBoard.board, O1: "A" },
    players: {
      ...gameFixtures.emptyBoard.players,
      A: { inHand: 11, captured: 0 },
    },
    currentPlayer: "B",
  };
}

function expectDisplayedInitialState(
  game: ReturnType<typeof createOnlineGameController>,
): void {
  const initial = createInitialState("A");

  expect(game.state).toEqual(initial);
  expect(game.mySlot).toBeNull();
  expect(game.presence).toEqual({ A: null, B: null });
  expect(game.selected).toBeNull();
  expect(game.invalid).toBeNull();
  expect(game.lastAction).toBeNull();
  expect(game.feedback).toBeNull();
  expect(game.stateSyncNonce).toBe(0);
  expect(game.lastServerError).toBeNull();
  expect(game.matchNumber).toBe(1);
  expect(game.rematchVotes).toEqual({ A: null, B: null });
  expect(game.rematchStage).toBe("unavailable");
}

class FakeClient {
  callbacks: OnlineGameClientCallbacks = {};
  actions: GameAction[] = [];
  claims: (string | null)[] = [];
  rematchVotes: ("accept" | "decline")[] = [];
  joined: JoinRoomOptions | null = null;

  async createRoom(): Promise<string> {
    return "ABCDEFGH";
  }

  connect(options: JoinRoomOptions): void {
    this.joined = options;
  }

  sendGameAction(action: GameAction): boolean {
    this.actions.push(action);
    return true;
  }

  sendClaimWin(roomCode: string | null): boolean {
    this.claims.push(roomCode);
    return true;
  }

  sendRematchVote(vote: "accept" | "decline"): boolean {
    this.rematchVotes.push(vote);
    return true;
  }

  close(): void {
    this.joined = null;
  }

  setCallbacks(callbacks: OnlineGameClientCallbacks): void {
    this.callbacks = callbacks;
  }

  status(status: OnlineConnectionStatus): void {
    this.callbacks.onStatus?.(status);
  }

  message(message: ServerMessage): void {
    this.callbacks.onMessage?.(message);
  }
}
