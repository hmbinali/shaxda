import { describe, expect, it } from "vitest";
import { gameFixtures, protocolVersion } from "@shaxda/shared";
import {
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

    game.joinRoom("room-1", "guest-id-a", "Ayaan");
    client.status("connected");
    client.message({
      v: protocolVersion,
      type: "joined",
      roomCode: "ROOM-1",
      guestId: "guest-id-a",
      slot: "A",
    });
    client.message({
      v: protocolVersion,
      type: "presence",
      roomCode: "ROOM-1",
      players: { A: { displayName: "Ayaan" }, B: { displayName: "Cabdi" } },
      started: true,
    });
    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ROOM-1",
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
      roomCode: "ROOM-1",
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
      roomCode: "ROOM-1",
      connections: { A: true, B: false },
      idleSlot: null,
      claimableBy: "A",
      claimReason: "opponentAbandoned",
    });

    expect(game.opponentConnected).toBe(false);
    expect(game.canClaimWin).toBe(true);

    game.claimWin();

    expect(client.claims).toEqual(["ROOM-1"]);
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
      roomCode: "ROOM-1",
      connections: { A: true, B: true },
      idleSlot: "A",
      claimableBy: null,
      claimReason: null,
    });
    client.message({
      v: protocolVersion,
      type: "matchEnded",
      roomCode: "ROOM-1",
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
      roomCode: "ROOM-1",
      state: gameFixtures.emptyBoard,
    });

    expect(game.lastAction).toBeNull();
    expect(game.feedback?.cues).toEqual(["invalid"]);
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
      roomCode: "ROOM-1",
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

    game.joinRoom("room-2", "guest-id-a", "Ayaan");

    expect(client.joined?.roomCode).toBe("ROOM-2");
    expectDisplayedInitialState(game);

    client.message({
      v: protocolVersion,
      type: "state",
      roomCode: "ROOM-2",
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
  game.joinRoom("room-1", "guest-id-a", "Ayaan");
  client.status("connected");
  client.message({
    v: protocolVersion,
    type: "joined",
    roomCode: "ROOM-1",
    guestId: "guest-id-a",
    slot: "A",
  });
  client.message({
    v: protocolVersion,
    type: "presence",
    roomCode: "ROOM-1",
    players: { A: { displayName: "Ayaan" }, B: { displayName: "Cabdi" } },
    started: true,
  });
  client.message({
    v: protocolVersion,
    type: "state",
    roomCode: "ROOM-1",
    state: gameFixtures.emptyBoard,
  });
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
  expect(game.lastServerError).toBeNull();
}

class FakeClient {
  callbacks: OnlineGameClientCallbacks = {};
  actions: GameAction[] = [];
  claims: (string | null)[] = [];
  joined: JoinRoomOptions | null = null;

  async createRoom(): Promise<string> {
    return "ROOM-1";
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
