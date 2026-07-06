import { ADJACENCY, POINT_IDS } from "./board";
import { completesJare, formsNewJare } from "./jare";
import { getLegalMoves, getSpaceMakingMoves, hasLegalMoves } from "./moves";
import type {
  BoardOccupancy,
  GameAction,
  GameEndReason,
  GameState,
  PlayerId,
  PointId,
} from "./types";

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
  | "alreadyRemovedInitial"
  | "notSpaceMaking"
  | "unsupportedAction";

export type ActionResult =
  { ok: true; state: GameState } | { ok: false; error: ActionError };

export function otherPlayer(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A";
}

export function getActingPlayer(state: GameState): PlayerId {
  if (
    state.phase === "movement" &&
    !hasLegalMoves(state, state.currentPlayer)
  ) {
    return otherPlayer(state.currentPlayer);
  }

  return state.currentPlayer;
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
      return applyMove(state, action.player, action.from, action.to);
    case "capture":
      return applyCapture(state, action.player, action.point);
    case "resign":
      return applyResign(state, action.player);
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
        pendingCapture: null,
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
      pendingCapture: null,
    },
  };
}

function applyMove(
  state: GameState,
  player: PlayerId,
  from: PointId,
  to: PointId,
): ActionResult {
  if (state.phase !== "movement") {
    return fail("wrongPhase");
  }

  const currentPlayerBlocked = !hasLegalMoves(state, state.currentPlayer);
  const spaceMakingFor =
    currentPlayerBlocked && player === otherPlayer(state.currentPlayer)
      ? state.currentPlayer
      : null;

  if (!currentPlayerBlocked && player !== state.currentPlayer) {
    return fail("notYourTurn");
  }
  if (currentPlayerBlocked && spaceMakingFor === null) {
    return fail("notYourTurn");
  }
  if (state.board[from] !== player) {
    return fail("notOwnPiece");
  }
  if (!(ADJACENCY[from] as readonly PointId[]).includes(to)) {
    return fail("notAdjacent");
  }
  if (state.board[to] !== null) {
    return fail("destinationOccupied");
  }
  if (
    spaceMakingFor !== null &&
    !getSpaceMakingMoves(state, spaceMakingFor).some(
      (move) => move.from === from && move.to === to,
    )
  ) {
    return fail("notSpaceMaking");
  }

  const board = {
    ...state.board,
    [from]: null,
    [to]: player,
  };

  if (spaceMakingFor !== null) {
    return {
      ok: true,
      state: finalizeMovementTurn(
        {
          ...state,
          board,
          phase: "movement",
          pendingCapture: null,
        },
        spaceMakingFor,
        { turnCompleted: true },
      ),
    };
  }

  const hasPendingCapture = formsNewJare(state.board, board, to, player);

  if (!hasPendingCapture) {
    return {
      ok: true,
      state: finalizeMovementTurn(
        {
          ...state,
          board,
          phase: "movement",
          pendingCapture: null,
        },
        otherPlayer(player),
        { turnCompleted: true },
      ),
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      board,
      phase: "capture",
      currentPlayer: player,
      pendingCapture: { player, formedAt: to },
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
  if (state.initialRemoval.removedBy[player]) {
    return fail("alreadyRemovedInitial");
  }

  const board = { ...state.board, [point]: null };
  const initialRemoval = {
    removedBy: {
      ...state.initialRemoval.removedBy,
      [player]: true,
    },
  };

  if (initialRemoval.removedBy.A && initialRemoval.removedBy.B) {
    return {
      ok: true,
      state: finalizeMovementTurn(
        {
          ...state,
          board,
          initialRemoval,
          phase: "movement",
          pendingCapture: null,
        },
        state.firstAdvantage ?? state.currentPlayer,
      ),
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      board,
      initialRemoval,
      currentPlayer: otherPlayer(player),
      pendingCapture: null,
    },
  };
}

function applyCapture(
  state: GameState,
  player: PlayerId,
  point: PointId,
): ActionResult {
  if (state.phase !== "capture" || state.pendingCapture === null) {
    return fail("wrongPhase");
  }
  if (
    player !== state.currentPlayer ||
    player !== state.pendingCapture.player
  ) {
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
  const opponent = otherPlayer(player);
  const players = {
    ...state.players,
    [player]: {
      ...state.players[player],
      captured: state.players[player].captured + 1,
    },
  };
  const opponentPieces = countPieces(board, opponent);
  const endReason = getCaptureEndReason(opponentPieces);

  if (endReason !== null) {
    return {
      ok: true,
      state: {
        ...state,
        board,
        players,
        phase: "gameOver",
        currentPlayer: player,
        pendingCapture: null,
        draw: {
          turnsSinceCapture: 0,
          repeatedPositions: {},
        },
        winner: player,
        endReason,
      },
    };
  }

  return {
    ok: true,
    state: finalizeMovementTurn(
      {
        ...state,
        board,
        players,
        phase: "movement",
        pendingCapture: null,
      },
      opponent,
      { captured: true, turnCompleted: true },
    ),
  };
}

function applyResign(state: GameState, player: PlayerId): ActionResult {
  if (state.phase === "gameOver") {
    return fail("wrongPhase");
  }

  return {
    ok: true,
    state: {
      ...state,
      phase: "gameOver",
      currentPlayer: otherPlayer(player),
      pendingCapture: null,
      winner: otherPlayer(player),
      endReason: "resignation",
    },
  };
}

function countPieces(board: BoardOccupancy, player: PlayerId): number {
  return Object.values(board).filter((owner) => owner === player).length;
}

function getCaptureEndReason(pieceCount: number): GameEndReason | null {
  if (pieceCount === 0) {
    return "opponentCapturedAll";
  }
  if (pieceCount < 3) {
    return "opponentBelowThree";
  }
  return null;
}

interface FinalizeMovementOptions {
  captured?: boolean;
  turnCompleted?: boolean;
}

function finalizeMovementTurn(
  state: GameState,
  nextPlayer: PlayerId,
  options: FinalizeMovementOptions = {},
): GameState {
  const draw = options.captured
    ? {
        turnsSinceCapture: 0,
        repeatedPositions: {},
      }
    : {
        turnsSinceCapture: options.turnCompleted
          ? state.draw.turnsSinceCapture + 1
          : state.draw.turnsSinceCapture,
        repeatedPositions: { ...state.draw.repeatedPositions },
      };

  const movementState: GameState = {
    ...state,
    phase: "movement",
    currentPlayer: nextPlayer,
    pendingCapture: null,
    draw,
    winner: null,
    endReason: null,
  };
  const key = movementPositionKey(movementState);
  const repeatedPositions = {
    ...movementState.draw.repeatedPositions,
    [key]: (movementState.draw.repeatedPositions[key] ?? 0) + 1,
  };
  const withRepetition: GameState = {
    ...movementState,
    draw: {
      ...movementState.draw,
      repeatedPositions,
    },
  };

  if ((repeatedPositions[key] ?? 0) >= 3) {
    return endDraw(withRepetition, "drawTermination");
  }

  if (withRepetition.draw.turnsSinceCapture >= 80) {
    return endDraw(withRepetition, "drawTermination");
  }

  if (hasLegalMoves(withRepetition, nextPlayer)) {
    return withRepetition;
  }

  const opponent = otherPlayer(nextPlayer);
  if (getLegalMoves(withRepetition, opponent).length === 0) {
    return endDraw(withRepetition, "bothBlocked");
  }

  if (getSpaceMakingMoves(withRepetition, nextPlayer).length === 0) {
    return endDraw(withRepetition, "forcedJareSpaceMaking");
  }

  return withRepetition;
}

function movementPositionKey(state: GameState): string {
  const board = POINT_IDS.map((point) => state.board[point] ?? "-").join("");

  return `${state.phase}|${state.pendingCapture === null ? "none" : "capture"}|${state.currentPlayer}|${board}`;
}

function endDraw(state: GameState, endReason: GameEndReason): GameState {
  return {
    ...state,
    phase: "gameOver",
    pendingCapture: null,
    winner: null,
    endReason,
  };
}
