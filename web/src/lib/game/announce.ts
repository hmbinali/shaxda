import { messages } from "@shaxda/i18n";
import type { GameAction, PlayerId } from "@shaxda/game-engine";
import type { GameStatus } from "./status";

export interface AnnouncedAction {
  action: GameAction;
  nonce: number;
  formedJare?: boolean;
}

type DescribedAction = Omit<AnnouncedAction, "nonce"> & {
  nonce?: number;
};

export type PlayerName = (player: PlayerId) => string;

const copy = messages.so.localGame;

export function buildAnnouncement(
  lastAction: DescribedAction | null,
  status: GameStatus,
  playerName: PlayerName,
): string {
  if (lastAction === null) {
    return buildStateSummary(status, playerName);
  }

  return joinAnnouncementParts([
    actionAnnouncement(lastAction, status, playerName),
    buildStatusAnnouncement(status, playerName),
  ]);
}

export function buildStateSummary(
  status: GameStatus,
  playerName: PlayerName,
): string {
  return joinAnnouncementParts([
    copy.announce.stateSynced,
    buildStatusAnnouncement(status, playerName),
  ]);
}

function actionAnnouncement(
  lastAction: DescribedAction,
  status: GameStatus,
  playerName: PlayerName,
): string {
  const { action, formedJare = false } = lastAction;
  const name = playerName(action.player);

  switch (action.type) {
    case "place":
      return joinAnnouncementParts([
        `${name} ${copy.announce.placed} ${action.point}.`,
        formedJare ? `${copy.announce.jareFormed}.` : "",
      ]);
    case "move":
      return joinAnnouncementParts([
        `${name} ${copy.announce.moved} ${action.from} ${copy.announce.movedTo} ${action.to}.`,
        formedJare || status.phase === "capture"
          ? `${copy.announce.jareFormed}.`
          : "",
      ]);
    case "capture":
      return `${name} ${copy.announce.captured} ${action.point}.`;
    case "removeInitial":
      return `${name} ${copy.announce.removedInitial} ${action.point}.`;
    case "resign":
      return `${name} ${copy.announce.resigned}.`;
  }
}

export function buildStatusAnnouncement(
  status: GameStatus,
  playerName: PlayerName,
): string {
  if (status.phase === "gameOver") {
    return status.winner === null
      ? copy.announce.draw
      : `${copy.announce.winner}: ${playerName(status.winner)}.`;
  }

  return joinAnnouncementParts([
    `${copy.announce.turnPrefix}: ${playerName(status.actingPlayer)}.`,
    `${copy.announce.phasePrefix}: ${copy.phases[status.phase]}.`,
    status.isSpaceMaking ? copy.announce.spaceMaking : "",
  ]);
}

function joinAnnouncementParts(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join(" ");
}
