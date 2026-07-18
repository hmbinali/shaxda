import { createInitialState, getActingPlayer } from "@shaxda/game-engine";
import type {
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "@shaxda/game-engine";
import type { ServerMessage } from "@shaxda/shared";
import {
  mapPointClick,
  type PointInteractionInvalidReason,
} from "$lib/game/interaction";
import {
  buildGameStatus,
  classifyActionFeedback,
  type GameStatus,
} from "$lib/game/status";
import type { SoundCue } from "$lib/audio/sound";
import { inferOpponentAction } from "./inferAction";
import {
  OnlineGameClient,
  type OnlineConnectionStatus,
} from "./onlineGameClient";

export type OnlinePresence = Extract<
  ServerMessage,
  { type: "presence" }
>["players"];
export type OnlineMatchEndReason = Extract<
  ServerMessage,
  { type: "matchEnded" }
>["reason"];

export interface InvalidFeedback {
  reason: PointInteractionInvalidReason | "actionRejected";
  nonce: number;
}

export interface OnlineGameFeedback {
  cues: readonly SoundCue[];
  nonce: number;
}

export interface ActionFeedback {
  action: GameAction;
  nonce: number;
  formedJare: boolean;
}

export interface OnlineGameControllerOptions {
  client?: OnlineGameClient;
}

export class OnlineGameController {
  state = $state<GameState>(createInitialState("A"));
  roomCode = $state<string | null>(null);
  mySlot = $state<PlayerId | null>(null);
  presence = $state<OnlinePresence>({ A: null, B: null });
  connectionStatus = $state<OnlineConnectionStatus>("idle");
  connections = $state<Record<PlayerId, boolean>>({ A: false, B: false });
  idleSlot = $state<PlayerId | null>(null);
  claimableBy = $state<PlayerId | null>(null);
  claimReason = $state<OnlineMatchEndReason | null>(null);
  onlineEndReason = $state<OnlineMatchEndReason | null>(null);
  selected = $state<PointId | null>(null);
  invalid = $state<InvalidFeedback | null>(null);
  invalidNonce = $state(0);
  lastAction = $state<ActionFeedback | null>(null);
  feedback = $state<OnlineGameFeedback | null>(null);
  stateSyncNonce = $state(0);
  lastServerError = $state<string | null>(null);
  status = $derived(buildGameStatus(this.state));
  started = $derived(this.presence.A !== null && this.presence.B !== null);
  opponentConnected = $derived(
    this.mySlot === null ? null : this.connections[otherSlot(this.mySlot)],
  );
  isIdlePlayer = $derived(
    this.mySlot !== null && this.idleSlot === this.mySlot,
  );
  canClaimWin = $derived(
    this.connectionStatus === "connected" &&
      this.mySlot !== null &&
      this.claimableBy === this.mySlot &&
      this.state.phase !== "gameOver",
  );
  canInteract = $derived(
    this.connectionStatus === "connected" &&
      this.started &&
      this.mySlot !== null &&
      this.state.phase !== "gameOver" &&
      getActingPlayer(this.state) === this.mySlot,
  );

  readonly #client: OnlineGameClient;
  #invalidNonce = 0;
  #feedbackNonce = 0;
  #actionNonce = 0;
  #pendingAction: GameAction | null = null;

  constructor(options: OnlineGameControllerOptions = {}) {
    this.#client = options.client ?? new OnlineGameClient();
    this.#client.setCallbacks({
      onStatus: (status) => {
        this.connectionStatus = status;
      },
      onMessage: (message) => {
        this.handleMessage(message);
      },
      onError: (error) => {
        this.lastServerError = error.message;
        this.markInvalid("actionRejected");
      },
    });
  }

  async createRoom(
    guestId: string,
    displayName: string,
    turnstileToken?: string,
  ): Promise<string> {
    const roomCode = await this.#client.createRoom(turnstileToken);
    this.joinRoom(roomCode, guestId, displayName);
    return roomCode;
  }

  joinRoom(roomCode: string, guestId: string, displayName: string): void {
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    this.roomCode = normalizedRoomCode;
    this.resetDisplayedRoomState();
    this.#client.connect({
      roomCode: normalizedRoomCode,
      guestId,
      displayName,
    });
  }

  clickPoint(point: PointId): void {
    if (!this.canInteract) {
      this.markInvalid("actionRejected");
      return;
    }

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

    this.sendAction(result.action);
  }

  resign(): void {
    if (!this.mySlot || this.state.phase === "gameOver") {
      this.markInvalid("actionRejected");
      return;
    }

    this.sendAction({ type: "resign", player: this.mySlot });
  }

  claimWin(): void {
    if (!this.canClaimWin) {
      this.markInvalid("actionRejected");
      return;
    }

    const sent = this.#client.sendClaimWin(this.roomCode);
    if (!sent) {
      this.markInvalid("actionRejected");
    }
  }

  leave(): void {
    this.#client.close();
    this.roomCode = null;
    this.connectionStatus = "idle";
    this.resetDisplayedRoomState();
  }

  private sendAction(action: GameAction): void {
    const sent = this.#client.sendGameAction(action);
    if (!sent) {
      this.markInvalid("actionRejected");
      return;
    }

    this.#pendingAction = action;
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case "joined":
        this.mySlot = message.slot;
        return;
      case "presence":
        this.presence = message.players;
        return;
      case "state":
        this.receiveState(message.state);
        return;
      case "matchStatus":
        this.connections = message.connections;
        this.idleSlot = message.idleSlot;
        this.claimableBy = message.claimableBy;
        this.claimReason = message.claimReason;
        return;
      case "matchEnded":
        this.onlineEndReason = message.reason;
        return;
      case "error":
        this.#pendingAction = null;
        this.lastServerError = message.code;
        this.markInvalid("actionRejected");
        return;
      case "roomCreated":
      case "echoBroadcast":
      case "pong":
        return;
    }
  }

  private receiveState(nextState: GameState): void {
    const previousState = this.state;
    const pendingAction = this.#pendingAction;
    const action =
      pendingAction ?? inferOpponentAction(previousState, nextState);
    this.state = nextState;
    this.selected = null;
    this.invalid = null;
    this.lastServerError = null;
    if (nextState.phase !== "gameOver") {
      this.onlineEndReason = null;
    }

    if (action !== null) {
      const cues = classifyActionFeedback(previousState, action, nextState);
      this.lastAction = {
        action,
        nonce: (this.#actionNonce += 1),
        formedJare: cues.includes("jare"),
      };
      this.emitFeedback(cues);
      if (pendingAction !== null) {
        this.#pendingAction = null;
      }
      return;
    }

    this.stateSyncNonce += 1;

    if (previousState.phase !== "gameOver" && nextState.phase === "gameOver") {
      this.emitFeedback(["win"]);
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

  private resetDisplayedRoomState(): void {
    this.state = createInitialState("A");
    this.mySlot = null;
    this.presence = { A: null, B: null };
    this.connections = { A: false, B: false };
    this.idleSlot = null;
    this.claimableBy = null;
    this.claimReason = null;
    this.onlineEndReason = null;
    this.selected = null;
    this.invalid = null;
    this.lastAction = null;
    this.feedback = null;
    this.stateSyncNonce = 0;
    this.lastServerError = null;
    this.#pendingAction = null;
  }
}

export function createOnlineGameController(
  options?: OnlineGameControllerOptions,
): OnlineGameController {
  return new OnlineGameController(options);
}

export type OnlineGameStatus = GameStatus;

function otherSlot(slot: PlayerId): PlayerId {
  return slot === "A" ? "B" : "A";
}
