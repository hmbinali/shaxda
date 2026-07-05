import { completesJare } from "./jare";
import type { GameAction, GameState, PlayerId, PointId } from "./types";

export type ActionError =
  | "wrongPhase"
  | "notYourTurn"
  | "pointOccupied"
  | "pointEmpty"
  | "notOpponentPiece"
  | "notOwnPiece"
  | "notAdjacent"
  | "destinationOccupied"
  | "noPiecesInHand"
  | "unsupportedAction";

export type ActionResult =
  { ok: true; state: GameState } | { ok: false; error: ActionError };

export function otherPlayer(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A";
}

const fail = (error: ActionError): ActionResult => ({ ok: false, error });

export function applyAction(
  state: GameState,
  action: GameAction,
): ActionResult {
  switch (action.type) {
    case "place":
      return applyPlace(state, action.player, action.point);
    case "removeInitial":
      return applyRemoveInitial(state, action.player, action.point);
    case "move":
    case "capture":
    case "resign":
      return fail("unsupportedAction");
  }
}

function applyPlace(
  state: GameState,
  player: PlayerId,
  point: PointId,
): ActionResult {
  if (state.phase !== "placement") {
    return fail("wrongPhase");
  }
  if (player !== state.currentPlayer) {
    return fail("notYourTurn");
  }
  if (state.board[point] !== null) {
    return fail("pointOccupied");
  }
  if (state.players[player].inHand <= 0) {
    return fail("noPiecesInHand");
  }

  const board = { ...state.board, [point]: player };
  const players = {
    ...state.players,
    [player]: {
      ...state.players[player],
      inHand: state.players[player].inHand - 1,
    },
  };

  // A placement jare never removes pieces; it only decides first advantage,
  // and only the first one counts (docs/shaxda_game.md §9–§10).
  const firstAdvantage =
    state.firstAdvantage === null && completesJare(board, point, player)
      ? player
      : state.firstAdvantage;

  if (players.A.inHand === 0 && players.B.inHand === 0) {
    // No jare during placement → the non-starting player defended
    // successfully and gets first advantage (§10).
    const advantageHolder = firstAdvantage ?? otherPlayer(state.startingPlayer);

    return {
      ok: true,
      state: {
        ...state,
        board,
        players,
        firstAdvantage: advantageHolder,
        phase: "initialRemoval",
        currentPlayer: advantageHolder,
      },
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      board,
      players,
      firstAdvantage,
      currentPlayer: otherPlayer(player),
    },
  };
}

function applyRemoveInitial(
  state: GameState,
  player: PlayerId,
  point: PointId,
): ActionResult {
  if (state.phase !== "initialRemoval") {
    return fail("wrongPhase");
  }
  if (player !== state.currentPlayer) {
    return fail("notYourTurn");
  }

  const occupant = state.board[point];
  if (occupant === null) {
    return fail("pointEmpty");
  }
  if (occupant === player) {
    return fail("notOpponentPiece");
  }

  const board = { ...state.board, [point]: null };
  const piecesOnBoard = Object.values(board).filter(
    (owner) => owner !== null,
  ).length;

  if (piecesOnBoard === 22) {
    return {
      ok: true,
      state: {
        ...state,
        board,
        phase: "movement",
        currentPlayer: state.firstAdvantage ?? state.currentPlayer,
      },
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      board,
      currentPlayer: otherPlayer(player),
    },
  };
}
