import { RATING_ALGORITHM_V } from "@shaxda/rating";
import { PAIR_CAP_WINDOW_MS, RATING_POLICY_V } from "@shaxda/shared/rated-play";
import {
  decideEvent,
  type Decision,
  type LedgerEvent,
  type PlayerRating,
} from "./fold";
import {
  guard,
  PAIR_SELECT,
  pendingEvents,
  type ProcessorState,
} from "./queries";

const LEASE_MS = 60_000;
const MIN_REMAINING_MS = 15_000;
const MAX_DECISIONS = 25;

interface Options {
  now?: () => number;
  budget?: number;
}

type QueueState = ProcessorState & { pending: number | null };

async function readDecision(
  db: D1Database,
  row: LedgerEvent,
): Promise<Decision> {
  const [invalidated, current, recent] = await db.batch([
    db
      .prepare(
        "SELECT match_id FROM rating_invalidation_current WHERE match_id = ?",
      )
      .bind(row.id),
    db
      .prepare("SELECT * FROM player_rating WHERE user_id IN (?, ?)")
      .bind(row.a_id, row.b_id),
    db
      .prepare(PAIR_SELECT)
      .bind(
        row.a_id,
        row.b_id,
        row.ended_at - PAIR_CAP_WINDOW_MS,
        row.ended_at,
        row.seq,
      ),
  ]);
  const players = current?.results as unknown as PlayerRating[];
  return decideEvent(row, {
    invalidated: !!invalidated?.results.length,
    a: players.find((p) => p.user_id === row.a_id) ?? null,
    b: players.find((p) => p.user_id === row.b_id) ?? null,
    pairProcessedEndedAt: (
      (recent?.results ?? []) as { ended_at: number }[]
    ).map((r) => r.ended_at),
    // A new board key and its exclusion are assigned in the statement, from
    // live data, so a concurrent exclusion cannot be overwritten.
    nextBoardKey: 0,
    exclusions: new Set(),
  });
}

function writePlayer(db: D1Database, p: PlayerRating): D1PreparedStatement {
  return db
    .prepare(
      `
    INSERT INTO player_rating (
      user_id, board_key, rating, rd, volatility, rated_games, rated_wins,
      rated_losses, rated_draws, streak_kind, streak_len, best_win_streak,
      form, peak_rating, peak_seq, last_rated_at, eligible_until, last_seq, excluded
    ) VALUES (
      ?1, COALESCE((SELECT board_key FROM player_rating WHERE user_id = ?1),
                   (SELECT COALESCE(MAX(board_key), 0) + 1 FROM player_rating)),
      ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
      COALESCE((SELECT excluded FROM rating_account_exclusion WHERE user_id = ?1), 0)
    ) ON CONFLICT (user_id) DO UPDATE SET
      rating = excluded.rating, rd = excluded.rd, volatility = excluded.volatility,
      rated_games = excluded.rated_games, rated_wins = excluded.rated_wins,
      rated_losses = excluded.rated_losses, rated_draws = excluded.rated_draws,
      streak_kind = excluded.streak_kind, streak_len = excluded.streak_len,
      best_win_streak = excluded.best_win_streak, form = excluded.form,
      peak_rating = excluded.peak_rating, peak_seq = excluded.peak_seq,
      last_rated_at = excluded.last_rated_at, eligible_until = excluded.eligible_until,
      last_seq = excluded.last_seq`,
    )
    .bind(
      p.user_id,
      p.rating,
      p.rd,
      p.volatility,
      p.rated_games,
      p.rated_wins,
      p.rated_losses,
      p.rated_draws,
      p.streak_kind,
      p.streak_len,
      p.best_win_streak,
      p.form,
      p.peak_rating,
      p.peak_seq,
      p.last_rated_at,
      p.eligible_until,
      p.last_seq,
    );
}

export function decisionWrites(
  db: D1Database,
  decision: Decision,
  now: number,
): D1PreparedStatement[] {
  const m = decision.match;
  return [
    db
      .prepare(
        `
      INSERT INTO match_rating (
        match_id, seq, rating_status, rating_skip_reason, rating_policy_v,
        rating_algorithm_v, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        m.match_id,
        m.seq,
        m.rating_status,
        m.rating_skip_reason,
        m.rating_policy_v,
        m.rating_algorithm_v,
        now,
      ),
    ...decision.seats.map((s) =>
      db
        .prepare(
          `
      INSERT INTO match_player_rating VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          s.match_id,
          s.seat,
          s.rating_before,
          s.rating_after,
          s.rd_before,
          s.rd_after,
          s.volatility_before,
          s.volatility_after,
          s.rating_delta,
        ),
    ),
    ...decision.players.map((p) => writePlayer(db, p)),
  ];
}

export async function processPendingRatings(
  db: D1Database,
  options: Options = {},
): Promise<number> {
  const now = options.now ?? Date.now;
  const budget = Math.min(MAX_DECISIONS, options.budget ?? MAX_DECISIONS);
  let decided = 0;
  for (let pass = 0; pass < 2 && decided < budget; pass++) {
    const state = await db
      .prepare(
        `
      SELECT s.*, (SELECT seq FROM match WHERE seq > s.cursor_seq ORDER BY seq LIMIT 1) AS pending
        FROM rating_processor_state s WHERE id = 1`,
      )
      .first<QueueState>();
    if (!state || state.maintenance) break;
    if (
      state.policy_v !== RATING_POLICY_V ||
      state.algorithm_v !== RATING_ALGORITHM_V
    ) {
      console.error("ratingVersionMismatch");
      break;
    }
    if (state.pending === null) break;
    const token = crypto.randomUUID();
    const acquiredAt = now();
    const expiresAt = acquiredAt + LEASE_MS;
    const lease = await db
      .prepare(
        `
      UPDATE rating_processor_state SET lease_token = ?1, lease_expires_at = ?2
       WHERE id = 1 AND maintenance = 0 AND (lease_token IS NULL OR lease_expires_at <= ?3)
         AND cursor_seq = ?4 AND policy_v = ?5 AND algorithm_v = ?6`,
      )
      .bind(
        token,
        expiresAt,
        acquiredAt,
        state.cursor_seq,
        RATING_POLICY_V,
        RATING_ALGORITHM_V,
      )
      .run();
    if (lease.meta.changes !== 1) break;
    let cursor = state.cursor_seq;
    let current: LedgerEvent | undefined;
    try {
      const { results } = await pendingEvents(db, cursor, budget - decided);
      for (current of results) {
        if (expiresAt - now() < MIN_REMAINING_MS) break;
        const decision = await readDecision(db, current);
        const decidedAt = now();
        await db.batch([
          guard(db, token, decidedAt, cursor, 0),
          ...decisionWrites(db, decision, decidedAt),
          db
            .prepare(
              "UPDATE rating_processor_state SET cursor_seq = ?, updated_at = ? WHERE id = 1",
            )
            .bind(current.seq, decidedAt),
          db.prepare("DELETE FROM rating_fence"),
        ]);
        cursor = current.seq;
        decided++;
        if (decision.heldCode) {
          console.error("ratingHeld", {
            seq: current.seq,
            matchId: current.id,
            code: decision.heldCode,
          });
        }
      }
    } catch (error) {
      const constraint = /\b(?:rating_fence_guard|rating_fence\.ok)\b/;
      const name =
        error instanceof Error && constraint.test(error.message)
          ? "ratingFenceRejected"
          : "ratingBatchFailed";
      console.error(name, { seq: current?.seq, matchId: current?.id });
      break;
    } finally {
      try {
        await db
          .prepare(
            `
          UPDATE rating_processor_state SET lease_token = NULL, lease_expires_at = NULL
           WHERE id = 1 AND lease_token = ?`,
          )
          .bind(token)
          .run();
      } catch {
        console.error("ratingLeaseReleaseFailed");
      }
    }
  }
  return decided;
}
