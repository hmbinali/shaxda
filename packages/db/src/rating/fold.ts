import { REPLAY_VERSION, RULES_VERSION } from "@shaxda/game-engine";
import {
  DEFAULTS,
  effectiveRd,
  eligibleUntil,
  RATING_ALGORITHM_V,
  RatingInputError,
  RatingMathError,
  updateMatch,
  type Score,
  type State,
} from "@shaxda/rating";
import {
  PAIR_CAP_WINDOW_MS,
  RATING_POLICY_V,
  ratingSkipReason,
  writesLedgerRow,
} from "@shaxda/shared/rated-play";

type Seat = "A" | "B";
type Result = "win" | "loss" | "draw";
type SkipReason = NonNullable<ReturnType<typeof ratingSkipReason>>;

export interface LedgerEvent {
  seq: number;
  id: string;
  mode: string;
  rated: number;
  consent_policy_v: number | null;
  rules_v: number;
  replay_v: number;
  action_count: number;
  end_reason: string;
  online_end_reason: string | null;
  winner_seat: string | null;
  ended_at: number;
  a_id: string | null;
  b_id: string | null;
  a_result: string | null;
  b_result: string | null;
}

export interface MatchRating {
  match_id: string;
  seq: number;
  rating_status: "processed" | "skipped" | "held";
  rating_skip_reason: SkipReason | null;
  rating_policy_v: number;
  rating_algorithm_v: number | null;
}

export interface SeatRating {
  match_id: string;
  seat: Seat;
  rating_before: number;
  rating_after: number;
  rd_before: number;
  rd_after: number;
  volatility_before: number;
  volatility_after: number;
  rating_delta: number;
}

export interface PlayerRating extends State {
  user_id: string;
  board_key: number;
  rated_games: number;
  rated_wins: number;
  rated_losses: number;
  rated_draws: number;
  streak_kind: Result;
  streak_len: number;
  best_win_streak: number;
  form: string;
  peak_rating: number;
  peak_seq: number;
  last_rated_at: number;
  eligible_until: number;
  last_seq: number;
  excluded: number;
}

export function ledgerRowFollowsWritePolicy(row: LedgerEvent): boolean {
  // H1 counts the final resignation in the compact log. Two actions
  // establish that there was play before that terminal action.
  return (
    row.a_id !== row.b_id &&
    writesLedgerRow({
      seatKinds: {
        A: row.a_id ? "account" : undefined,
        B: row.b_id ? "account" : undefined,
      },
      playBegan: row.action_count > (row.end_reason === "resignation" ? 1 : 0),
      endedBy: row.online_end_reason === null ? "action" : "claim",
    })
  );
}

export function validateEvent(
  row: LedgerEvent,
):
  | "seats"
  | "results"
  | "consent"
  | "rulesVersion"
  | "replayVersion"
  | "playBegan"
  | null {
  if (!row.a_id || !row.b_id || row.a_id === row.b_id) return "seats";
  if (
    (row.winner_seat !== null &&
      row.winner_seat !== "A" &&
      row.winner_seat !== "B") ||
    row.a_result !== resultFor(row.winner_seat, "A") ||
    row.b_result !== resultFor(row.winner_seat, "B")
  ) {
    return "results";
  }
  const friendly =
    row.rated === 0 && row.mode === "invite" && row.consent_policy_v === null;
  const rated =
    row.rated === 1 &&
    (row.mode === "invite" || row.mode === "quick") &&
    row.consent_policy_v === 1;
  if (!friendly && !rated) return "consent";
  if (row.rules_v !== RULES_VERSION) return "rulesVersion";
  if (row.replay_v !== REPLAY_VERSION) return "replayVersion";
  return ledgerRowFollowsWritePolicy(row) ? null : "playBegan";
}

function resultFor(winner: string | null, seat: Seat): Result {
  return winner === null ? "draw" : winner === seat ? "win" : "loss";
}

export function preEventState(
  prior: PlayerRating | null,
  endedAt: number,
): State {
  return prior
    ? {
        rating: prior.rating,
        rd: effectiveRd(prior, prior.last_rated_at, endedAt),
        volatility: prior.volatility,
      }
    : DEFAULTS;
}

function seatRating(
  id: string,
  seat: Seat,
  before: State,
  after: State,
): SeatRating {
  return {
    match_id: id,
    seat,
    rating_before: before.rating,
    rating_after: after.rating,
    rd_before: before.rd,
    rd_after: after.rd,
    volatility_before: before.volatility,
    volatility_after: after.volatility,
    rating_delta: after.rating - before.rating,
  };
}

function record(
  row: LedgerEvent,
  id: string,
  result: Result,
  after: State,
  prior: PlayerRating | null,
  boardKey: number,
  excluded: boolean,
): PlayerRating {
  const streakLength = prior?.streak_kind === result ? prior.streak_len + 1 : 1;
  const newPeak = !prior || after.rating > prior.peak_rating;
  const lastRatedAt = Math.max(
    prior?.last_rated_at ?? row.ended_at,
    row.ended_at,
  );
  return {
    user_id: id,
    board_key: prior?.board_key ?? boardKey,
    ...after,
    rated_games: (prior?.rated_games ?? 0) + 1,
    rated_wins: (prior?.rated_wins ?? 0) + Number(result === "win"),
    rated_losses: (prior?.rated_losses ?? 0) + Number(result === "loss"),
    rated_draws: (prior?.rated_draws ?? 0) + Number(result === "draw"),
    streak_kind: result,
    streak_len: streakLength,
    best_win_streak: Math.max(
      prior?.best_win_streak ?? 0,
      result === "win" ? streakLength : 0,
    ),
    form: ((prior?.form ?? "") + result[0]!.toUpperCase()).slice(-5),
    peak_rating: newPeak ? after.rating : prior.peak_rating,
    peak_seq: newPeak ? row.seq : prior.peak_seq,
    last_rated_at: lastRatedAt,
    eligible_until: eligibleUntil(after, lastRatedAt),
    last_seq: row.seq,
    excluded: prior?.excluded ?? Number(excluded),
  };
}

interface DecisionInputs {
  invalidated: boolean;
  pairProcessedEndedAt: readonly number[];
  a: PlayerRating | null;
  b: PlayerRating | null;
  nextBoardKey: number;
  exclusions: ReadonlySet<string>;
}

export interface Decision {
  match: MatchRating;
  seats: SeatRating[];
  players: PlayerRating[];
  heldCode?: string;
}

export function decideEvent(row: LedgerEvent, input: DecisionInputs): Decision {
  const policy = {
    rated: row.rated === 1,
    invalidated: input.invalidated,
    endedAt: row.ended_at,
    pairProcessedEndedAt: input.pairProcessedEndedAt,
  };
  const match: MatchRating = {
    match_id: row.id,
    seq: row.seq,
    rating_status: "skipped",
    rating_skip_reason: null,
    rating_policy_v: RATING_POLICY_V,
    rating_algorithm_v: null,
  };

  if (policy.invalidated) {
    match.rating_skip_reason = ratingSkipReason(policy);
    return { match, seats: [], players: [] };
  }
  const heldCode = validateEvent(row);
  if (heldCode) {
    match.rating_status = "held";
    return { match, seats: [], players: [], heldCode };
  }
  match.rating_skip_reason = ratingSkipReason(policy);
  if (match.rating_skip_reason) return { match, seats: [], players: [] };

  try {
    const aId = row.a_id!;
    const bId = row.b_id!;
    const a = preEventState(input.a, row.ended_at);
    const b = preEventState(input.b, row.ended_at);
    const score: Score =
      row.winner_seat === null ? 0.5 : row.winner_seat === "A" ? 1 : 0;
    const after = updateMatch(a, b, score);
    const players = [
      record(
        row,
        aId,
        resultFor(row.winner_seat, "A"),
        after.a,
        input.a,
        input.nextBoardKey,
        input.exclusions.has(aId),
      ),
      record(
        row,
        bId,
        resultFor(row.winner_seat, "B"),
        after.b,
        input.b,
        input.nextBoardKey + Number(input.a === null),
        input.exclusions.has(bId),
      ),
    ];
    return {
      match: {
        ...match,
        rating_status: "processed",
        rating_algorithm_v: RATING_ALGORITHM_V,
      },
      seats: [
        seatRating(row.id, "A", a, after.a),
        seatRating(row.id, "B", b, after.b),
      ],
      players,
    };
  } catch (error) {
    if (!(
      error instanceof RatingMathError || error instanceof RatingInputError
    ))
      throw error;
    match.rating_status = "held";
    return { match, seats: [], players: [], heldCode: error.name };
  }
}

function firstAfter(times: readonly number[], time: number): number {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (times[mid]! <= time) low = mid + 1;
    else high = mid;
  }
  return low;
}

export interface RatingSources {
  invalidations: ReadonlySet<string>;
  exclusions: ReadonlySet<string>;
}

export function foldLedger(
  rows: Iterable<LedgerEvent>,
  sources: RatingSources,
) {
  const matches: MatchRating[] = [];
  const seats: SeatRating[] = [];
  const players = new Map<string, PlayerRating>();
  const pairTimes = new Map<string, number[]>();
  let previousSeq = 0;
  for (const row of rows) {
    if (row.seq <= previousSeq)
      throw new Error("Ledger must be in sequence order");
    previousSeq = row.seq;
    const pairKey = JSON.stringify([row.a_id, row.b_id].sort());
    const times = pairTimes.get(pairKey) ?? [];
    const upper = firstAfter(times, row.ended_at);
    const lower = firstAfter(times, row.ended_at - PAIR_CAP_WINDOW_MS);
    const decision = decideEvent(row, {
      invalidated: sources.invalidations.has(row.id),
      pairProcessedEndedAt: times.slice(lower, upper),
      a: row.a_id === null ? null : (players.get(row.a_id) ?? null),
      b: row.b_id === null ? null : (players.get(row.b_id) ?? null),
      nextBoardKey: players.size + 1,
      exclusions: sources.exclusions,
    });
    matches.push(decision.match);
    seats.push(...decision.seats);
    if (decision.match.rating_status === "processed") {
      times.splice(upper, 0, row.ended_at);
      pairTimes.set(pairKey, times);
      for (const player of decision.players)
        players.set(player.user_id, player);
    }
  }
  return { matches, seats, players: [...players.values()] };
}
