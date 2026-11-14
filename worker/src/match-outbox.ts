import {
  REPLAY_VERSION,
  RULES_VERSION,
  serialize,
  summarizeReplay,
} from "@shaxda/game-engine";
import type {
  CompactReplay,
  GameEndReason,
  GameState,
  PlayerId,
} from "@shaxda/game-engine";
import {
  matchPayloadHash,
  matchPayloadSchema,
  parseStoredReplay,
} from "@shaxda/shared";
import type { MatchPayload } from "@shaxda/shared";
import { generateMatchId } from "./room-code";

export type MatchLog = CompactReplay & { matchNumber: number };
export type StalledReason = "integrity" | "retriesExhausted" | "replayMismatch";
export type OutboxSummary = {
  status: "pending" | "stalled";
  attempts: number;
  nextAttemptAt: number | null;
};
export type OutboxEntry = OutboxSummary & {
  payload: MatchPayload;
  payloadHash: string;
  firstAttemptAt: number | null;
  lastError: string | null;
  stalledReason: StalledReason | null;
};

export const RETRY_DELAYS = [
  5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000,
] as const;
const RETRY_WINDOW = 72 * 3_600_000;
export function nextAutomaticAttempt(
  firstAttemptAt: number,
  now: number,
  attempts: number,
): number | null {
  const delay =
    RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)] ??
    RETRY_DELAYS[0];
  const next = now + delay;
  return attempts >= 77 || next > firstAttemptAt + RETRY_WINDOW ? null : next;
}

export const MAX_UNSAVED = 3;
export const outboxKey = (matchNumber: number) => `outbox:${matchNumber}`;

export function outboxSummary({
  status,
  attempts,
  nextAttemptAt,
}: OutboxEntry): OutboxSummary {
  return { status, attempts, nextAttemptAt };
}

type MatchFacts = Pick<
  MatchPayload,
  | "roomCode"
  | "roomCreatedAt"
  | "mode"
  | "rated"
  | "consentPolicyV"
  | "startedAt"
  | "endedAt"
  | "onlineEndReason"
> & { userIds: Record<PlayerId, string> };

export async function createOutboxEntry(
  log: MatchLog,
  state: GameState & { endReason: GameEndReason },
  facts: MatchFacts,
): Promise<OutboxEntry> {
  const replay = JSON.stringify({ v: log.v, s: log.s, a: log.a });
  let firstAdvantageBy: MatchPayload["firstAdvantageBy"] = null;
  let lastError: string | null = null;
  let actionIndex: number | null = null;
  try {
    const summary = summarizeReplay(parseStoredReplay(replay));
    if (!summary.ok) {
      lastError = summary.error;
      actionIndex = summary.actionIndex;
    } else if (serialize(summary.state) !== serialize(state)) {
      lastError = "Replay does not reconstruct the final game state.";
    } else {
      firstAdvantageBy = summary.firstAdvantageBy;
    }
  } catch {
    lastError = "Stored replay is invalid.";
  }

  const { userIds, ...columns } = facts;
  const pieces = { A: 0, B: 0 };
  for (const player of Object.values(state.board))
    if (player !== null) pieces[player]++;
  const stats = deriveStatistics();
  const player = <Seat extends PlayerId>(seat: Seat) => ({
    seat,
    userId: userIds[seat],
    result:
      state.winner === null
        ? ("draw" as const)
        : state.winner === seat
          ? ("win" as const)
          : ("loss" as const),
    piecesLeft: pieces[seat],
    captured: state.players[seat].captured,
  });
  const payload: MatchPayload = {
    ...columns,
    id: generateMatchId(),
    matchNumber: log.matchNumber,
    rulesV: RULES_VERSION,
    replayV: REPLAY_VERSION,
    replay,
    startingSeat: log.s,
    firstAdvantageSeat: state.firstAdvantage,
    firstAdvantageBy,
    winnerSeat: state.winner,
    endReason: state.endReason,
    actionCount: log.a.length,
    ...stats,
    players: [player("A"), player("B")],
  };
  if (!lastError && !matchPayloadSchema.safeParse(payload).success)
    lastError = "Match payload is invalid.";
  if (lastError) {
    payload.firstAdvantageBy = null;
    console.error("matchReplayMismatch", {
      roomCode: payload.roomCode,
      matchNumber: payload.matchNumber,
      actionIndex,
      error: lastError,
    });
  }
  return {
    payload,
    payloadHash: await matchPayloadHash(payload),
    status: lastError ? "stalled" : "pending",
    attempts: 0,
    firstAttemptAt: null,
    nextAttemptAt: lastError ? null : facts.endedAt + RETRY_DELAYS[0],
    lastError,
    stalledReason: lastError ? "replayMismatch" : null,
  };
}

type Statistics = Pick<MatchPayload, "statsV" | "statsStatus" | "statsJson">;

export function deriveStatistics(derive?: {
  version: number;
  run: () => string;
}): Statistics {
  if (!derive) return { statsV: null, statsStatus: "none", statsJson: null };
  try {
    return {
      statsV: derive.version,
      statsStatus: "ok",
      statsJson: derive.run(),
    };
  } catch {
    return { statsV: derive.version, statsStatus: "error", statsJson: null };
  }
}
