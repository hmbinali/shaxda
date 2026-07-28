import type { PlayerId } from "@shaxda/game-engine";
import type { GameStatus } from "$lib/game/status";

export type SeatingInput =
  { orientation: "shared" } | { orientation: "solo"; viewer: PlayerId };

export interface Seating {
  top: PlayerId;
  bottom: PlayerId;
  rotateTop: boolean;
}

export type RailState =
  "acting" | "spaceMaking" | "blocked" | "winner" | "loser" | "waiting";

export type RailInstructionKey =
  "place" | "remove" | "move" | "capture" | "makeSpace";

export type OnlineNoticeSignal =
  | "opponentDisconnected"
  | "reconnecting"
  | "isIdlePlayer"
  | "canClaimWin"
  | "invalid"
  | "lastServerError";

export type NoticeOwner = "viewer" | "opponent" | "centre";

export function resolveSeating(input: SeatingInput): Seating {
  if (input.orientation === "shared") {
    return { top: "B", bottom: "A", rotateTop: true };
  }

  return {
    top: otherPlayer(input.viewer),
    bottom: input.viewer,
    rotateTop: false,
  };
}

export function railStateFor(status: GameStatus, player: PlayerId): RailState {
  if (status.phase === "gameOver") {
    return status.winner === null
      ? "waiting"
      : status.winner === player
        ? "winner"
        : "loser";
  }

  if (status.isSpaceMaking) {
    if (status.currentPlayer === player) {
      return "blocked";
    }
    if (status.actingPlayer === player) {
      return "spaceMaking";
    }
  }

  return status.actingPlayer === player ? "acting" : "waiting";
}

export function instructionKeyFor(
  status: GameStatus,
  player: PlayerId,
  seating: SeatingInput,
): RailInstructionKey | null {
  if (
    status.phase === "gameOver" ||
    (seating.orientation === "solo" && seating.viewer !== player) ||
    status.actingPlayer !== player
  ) {
    return null;
  }

  if (status.isSpaceMaking) {
    return "makeSpace";
  }

  switch (status.phase) {
    case "placement":
      return "place";
    case "initialRemoval":
      return "remove";
    case "movement":
      return "move";
    case "capture":
      return "capture";
  }
}

export function noticeOwnerFor(signal: OnlineNoticeSignal): NoticeOwner {
  switch (signal) {
    case "opponentDisconnected":
      return "opponent";
    case "canClaimWin":
      return "centre";
    case "reconnecting":
    case "isIdlePlayer":
    case "invalid":
    case "lastServerError":
      return "viewer";
  }
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A";
}
