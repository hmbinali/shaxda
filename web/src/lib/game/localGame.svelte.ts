import {
  applyAction,
  createInitialState,
  getActingPlayer,
  legalActions,
} from "@shaxda/game-engine";
import type {
  GameAction,
  GameEndReason,
  GameState,
  Phase,
  PlayerId,
  PointId,
} from "@shaxda/game-engine";
import {
  mapPointClick,
  type PointInteractionInvalidReason,
} from "./interaction";
import {
  clearSavedLocalGame,
  loadResumableLocalGame,
  saveLocalGame,
  type LocalGameStorage,
} from "./localGameStorage";

export interface LocalGameStatus {
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

export interface InvalidFeedback {
  reason: PointInteractionInvalidReason | "actionRejected";
  nonce: number;
}

export interface LocalGameControllerOptions {
  initialState?: GameState;
  storage?: LocalGameStorage | null;
  confirmNewGame?: () => boolean;
}

export class LocalGameController {
  state = $state<GameState>(createInitialState("A"));
  selected = $state<PointId | null>(null);
  invalid = $state<InvalidFeedback | null>(null);
  status = $derived(buildLocalGameStatus(this.state));

  readonly #storage: LocalGameStorage | null | undefined;
  readonly #confirmNewGame: () => boolean;
  #invalidNonce = 0;

  constructor(options: LocalGameControllerOptions = {}) {
    this.#storage = options.storage;
    this.#confirmNewGame =
      options.confirmNewGame ??
      (() => window.confirm("Ciyaar cusub ma bilaabaysaa?"));
    this.state =
      options.initialState ??
      loadResumableLocalGame(this.#storage) ??
      createInitialState("A");
  }

  clickPoint(point: PointId): void {
    const result = mapPointClick(this.state, this.selected, point);

    if (result.type === "select") {
      this.selected = result.selected;
      this.invalid = null;
      return;
    }

    if (result.type === "deselect") {
      this.selected = null;
      this.invalid = null;
      return;
    }

    if (result.type === "invalid") {
      this.markInvalid(result.reason);
      return;
    }

    this.apply(result.action);
  }

  resign(): void {
    const action = legalActions(this.state).find(
      (candidate): candidate is Extract<GameAction, { type: "resign" }> =>
        candidate.type === "resign",
    );

    if (action === undefined) {
      this.markInvalid("actionRejected");
      return;
    }

    this.apply(action);
  }

  startNewGame(): boolean {
    if (this.state.phase !== "gameOver" && !this.#confirmNewGame()) {
      return false;
    }

    this.state = createInitialState("A");
    this.selected = null;
    this.invalid = null;
    clearSavedLocalGame(this.#storage);
    return true;
  }

  private apply(action: GameAction): void {
    const result = applyAction(this.state, action);

    if (!result.ok) {
      this.markInvalid("actionRejected");
      return;
    }

    this.state = result.state;
    this.selected = null;
    this.invalid = null;

    if (this.state.phase === "gameOver") {
      clearSavedLocalGame(this.#storage);
    } else {
      saveLocalGame(this.state, this.#storage);
    }
  }

  private markInvalid(reason: InvalidFeedback["reason"]): void {
    this.invalid = { reason, nonce: (this.#invalidNonce += 1) };
  }
}

export function createLocalGameController(
  options?: LocalGameControllerOptions,
): LocalGameController {
  return new LocalGameController(options);
}

export function buildLocalGameStatus(state: GameState): LocalGameStatus {
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

function countPieces(state: GameState, player: PlayerId): number {
  return Object.values(state.board).filter((occupant) => occupant === player)
    .length;
}
