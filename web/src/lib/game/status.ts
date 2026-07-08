import {
  completesJare,
  getActingPlayer,
  type GameAction,
  type GameEndReason,
  type GameState,
  type Phase,
  type PlayerId,
} from "@shaxda/game-engine";
import type { SoundCue } from "$lib/audio/sound";

export interface GameStatus {
  phase: Phase;
  currentPlayer: PlayerId;
  actingPlayer: PlayerId;
  isSpaceMaking: boolean;
  firstAdvantage: PlayerId | null;
  winner: PlayerId | null;
  endReason: GameEndReason | null;
  players: Record<
    PlayerId,
    { inHand: number; captured: number; onBoard: number }
  >;
  turnsSinceCapture: number;
}

export function buildGameStatus(state: GameState): GameStatus {
  return {
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    actingPlayer: getActingPlayer(state),
    isSpaceMaking:
      state.phase === "movement" &&
      getActingPlayer(state) !== state.currentPlayer,
    firstAdvantage: state.firstAdvantage,
    winner: state.winner,
    endReason: state.endReason,
    players: {
      A: {
        inHand: state.players.A.inHand,
        captured: state.players.A.captured,
        onBoard: countPieces(state, "A"),
      },
      B: {
        inHand: state.players.B.inHand,
        captured: state.players.B.captured,
        onBoard: countPieces(state, "B"),
      },
    },
    turnsSinceCapture: state.draw.turnsSinceCapture,
  };
}

export function classifyActionFeedback(
  previousState: GameState,
  action: GameAction,
  nextState: GameState,
): readonly SoundCue[] {
  switch (action.type) {
    case "place":
      return didCreateFirstPlacementJare(previousState, action, nextState)
        ? ["place", "jare"]
        : ["place"];
    case "removeInitial":
      return ["capture"];
    case "move":
      return nextState.phase === "capture" &&
        nextState.pendingCapture?.player === action.player
        ? ["move", "jare"]
        : ["move"];
    case "capture":
      return nextState.phase === "gameOver" && nextState.winner !== null
        ? ["capture", "win"]
        : ["capture"];
    case "resign":
      return nextState.winner === null ? [] : ["win"];
  }
}

function countPieces(state: GameState, player: PlayerId): number {
  return Object.values(state.board).filter((occupant) => occupant === player)
    .length;
}

function didCreateFirstPlacementJare(
  previousState: GameState,
  action: Extract<GameAction, { type: "place" }>,
  nextState: GameState,
): boolean {
  return (
    previousState.phase === "placement" &&
    previousState.firstAdvantage === null &&
    nextState.firstAdvantage === action.player &&
    completesJare(nextState.board, action.point, action.player)
  );
}
