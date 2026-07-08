import {
  applyAction,
  createInitialState,
  legalActions,
} from "@shaxda/game-engine";
import type { SoundCue } from "$lib/audio/sound";
import type { GameAction, GameState, PointId } from "@shaxda/game-engine";
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
import {
  buildGameStatus,
  classifyActionFeedback,
  type GameStatus,
} from "./status";

export type LocalGameStatus = GameStatus;

export interface InvalidFeedback {
  reason: PointInteractionInvalidReason | "actionRejected";
  nonce: number;
}

export interface LocalGameFeedback {
  cues: readonly SoundCue[];
  nonce: number;
}

export interface ActionFeedback {
  action: GameAction;
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
  invalidNonce = $state(0);
  lastAction = $state<ActionFeedback | null>(null);
  feedback = $state<LocalGameFeedback | null>(null);
  status = $derived(buildGameStatus(this.state));

  readonly #storage: LocalGameStorage | null | undefined;
  readonly #confirmNewGame: () => boolean;
  #invalidNonce = 0;
  #feedbackNonce = 0;
  #actionNonce = 0;

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
    this.invalidNonce = 0;
    this.lastAction = null;
    this.feedback = null;
    this.#invalidNonce = 0;
    this.#actionNonce = 0;
    this.#feedbackNonce = 0;
    clearSavedLocalGame(this.#storage);
    return true;
  }

  private apply(action: GameAction): void {
    const previousState = this.state;
    const result = applyAction(this.state, action);

    if (!result.ok) {
      this.markInvalid("actionRejected");
      return;
    }

    this.state = result.state;
    this.selected = null;
    this.invalid = null;
    this.lastAction = { action, nonce: (this.#actionNonce += 1) };
    this.emitFeedback(
      classifyActionFeedback(previousState, action, this.state),
    );

    if (this.state.phase === "gameOver") {
      clearSavedLocalGame(this.#storage);
    } else {
      saveLocalGame(this.state, this.#storage);
    }
  }

  private markInvalid(reason: InvalidFeedback["reason"]): void {
    this.invalidNonce = this.#invalidNonce += 1;
    this.invalid = { reason, nonce: this.invalidNonce };
    this.emitFeedback(["invalid"]);
  }

  private emitFeedback(cues: readonly SoundCue[]): void {
    this.feedback = { cues, nonce: (this.#feedbackNonce += 1) };
  }
}

export function createLocalGameController(
  options?: LocalGameControllerOptions,
): LocalGameController {
  return new LocalGameController(options);
}
