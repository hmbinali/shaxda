import type { D1Database } from "@cloudflare/workers-types";
import {
  REPLAY_VERSION,
  RULES_VERSION,
  summarizeReplay,
} from "@shaxda/game-engine";
import { parseStoredReplay } from "@shaxda/shared";
import { PAIR_CAP_WINDOW_MS, writesLedgerRow } from "@shaxda/shared/rated-play";
import {
  decideEvent,
  foldLedger,
  validateEvent,
  type LedgerEvent,
} from "../rating/fold";
import { EVENT_SELECT, PAIR_SELECT } from "../rating/queries";
import { readRatingSnapshot, verifyRebuild } from "../rating/rebuild";

export async function inspectMatch(db: D1Database, id: string) {
  const [matches, seats, decisions, numbers, invalidations, marks, audit] =
    await db.batch([
      db
        .prepare(
          `SELECT seq, id, room_code, room_created_at, match_number, mode, rated,
      consent_policy_v, rules_v, replay_v, length(CAST(replay AS BLOB)) AS replay_bytes,
      starting_seat, first_advantage_seat, first_advantage_by, winner_seat, end_reason,
      online_end_reason, action_count, stats_v, stats_status, stats_json, payload_hash,
      started_at, ended_at, saved_at FROM match WHERE id = ?`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT p.*, u.username, (u.id IS NULL) AS account_missing
      FROM match_player p LEFT JOIN user u ON u.id = p.user_id
      WHERE p.match_id = ? ORDER BY p.seat`,
        )
        .bind(id),
      db.prepare("SELECT * FROM match_rating WHERE match_id = ?").bind(id),
      db
        .prepare(
          "SELECT * FROM match_player_rating WHERE match_id = ? ORDER BY seat",
        )
        .bind(id),
      db
        .prepare(
          "SELECT * FROM rating_invalidation_log WHERE match_id = ? ORDER BY id DESC",
        )
        .bind(id),
      db
        .prepare("SELECT * FROM rating_correction_mark WHERE match_id = ?")
        .bind(id),
      db
        .prepare(
          "SELECT * FROM rating_admin_audit WHERE target = ? ORDER BY id DESC",
        )
        .bind(id),
    ]);
  if (!matches?.results.length) return null;
  return {
    match: matches.results[0],
    seats: seats!.results,
    decision: decisions!.results[0] ?? "pending",
    seatRatings: numbers!.results,
    invalidations: invalidations!.results,
    mark: marks!.results[0] ?? null,
    audit: audit!.results,
  };
}

interface ReplayRow {
  replay: string;
  rules_v: number;
  replay_v: number;
  starting_seat: string;
  action_count: number;
  first_advantage_seat: string | null;
  first_advantage_by: string | null;
  winner_seat: string | null;
  end_reason: string;
  online_end_reason: string | null;
}

interface ReplaySeat {
  seat: "A" | "B";
  result: string;
  pieces_left: number;
  captured: number;
}

export async function verifyReplay(
  db: D1Database,
  id: string,
): Promise<string | null> {
  const [match, players] = await db.batch([
    db
      .prepare(
        `SELECT replay, rules_v, replay_v, starting_seat, action_count,
      first_advantage_seat, first_advantage_by, winner_seat, end_reason, online_end_reason
      FROM match WHERE id = ?`,
      )
      .bind(id),
    db
      .prepare(
        "SELECT seat, result, pieces_left, captured FROM match_player WHERE match_id = ? ORDER BY seat",
      )
      .bind(id),
  ]);
  const row = match?.results[0] as ReplayRow | undefined;
  if (!row) return "unknownMatch";
  if (row.rules_v !== RULES_VERSION || row.replay_v !== REPLAY_VERSION)
    return "unsupportedVersion";
  try {
    const replay = parseStoredReplay(row.replay);
    const summary = summarizeReplay(replay);
    if (!summary.ok) return summary.error;
    const { state } = summary;
    if (state.phase !== "gameOver") return "phase";
    if (state.startingPlayer !== row.starting_seat) return "startingSeat";
    if (summary.actionCount !== row.action_count) return "actionCount";
    if (
      state.firstAdvantage !== row.first_advantage_seat ||
      summary.firstAdvantageBy !== row.first_advantage_by
    )
      return "firstAdvantage";
    if (state.winner !== row.winner_seat) return "winnerSeat";
    if (state.endReason !== row.end_reason) return "endReason";
    if (
      row.online_end_reason &&
      (row.end_reason !== "resignation" ||
        row.winner_seat === null ||
        replay.a.at(-1) !== (row.winner_seat === "A" ? "R:B" : "R:A"))
    )
      return "onlineEndReason";
    const seats = players!.results as ReplaySeat[];
    if (seats.length !== 2) return "seats";
    for (const { seat, result, pieces_left, captured } of seats) {
      if (
        result !==
        (state.winner === null
          ? "draw"
          : seat === state.winner
            ? "win"
            : "loss")
      )
        return `result:${seat}`;
      if (
        pieces_left !==
        Object.values(state.board).filter((owner) => owner === seat).length
      )
        return `piecesLeft:${seat}`;
      if (captured !== state.players[seat].captured) return `captured:${seat}`;
    }
    return null;
  } catch {
    return "invalidReplay";
  }
}

export async function inspectRating(db: D1Database, id: string, full: boolean) {
  const row = await db
    .prepare(`${EVENT_SELECT} WHERE m.id = ?`)
    .bind(id)
    .first<LedgerEvent>();
  if (!row) return null;
  const snapshot = await readRatingSnapshot(db);
  const prior = foldLedger(
    snapshot.ledger.filter((event) => event.seq < row.seq),
    snapshot,
  );
  const [a, b] = [row.a_id, row.b_id].map(
    (userId) => prior.players.find((p) => p.user_id === userId) ?? null,
  );
  const pair = await db
    .prepare(PAIR_SELECT)
    .bind(
      row.a_id,
      row.b_id,
      row.ended_at - PAIR_CAP_WINDOW_MS,
      row.ended_at,
      row.seq,
    )
    .all<{ ended_at: number; match_id: string; seq: number }>();
  const invalidated = snapshot.invalidations.has(id);
  const expected = decideEvent(row, {
    a: a ?? null,
    b: b ?? null,
    invalidated,
    pairProcessedEndedAt: pair.results.map((event) => event.ended_at),
    nextBoardKey: prior.players.length + 1,
    exclusions: snapshot.exclusions,
  });
  const drift = verifyRebuild(snapshot).diffs;
  return {
    invalidated,
    validation: invalidated ? null : validateEvent(row),
    rated: row.rated,
    pair: pair.results,
    expected,
    stored:
      snapshot.matches.find((decision) => decision.match_id === id) ??
      "pending",
    seats: snapshot.seats.filter((seat) => seat.match_id === id),
    firstDifference:
      drift.find((diff) =>
        full ? (diff.seq ?? Infinity) <= row.seq : diff.matchId === id,
      ) ?? null,
  };
}

export async function checkConsistency(db: D1Database, replays: boolean) {
  const snapshot = await readRatingSnapshot(db);
  const diff = verifyRebuild(snapshot);
  const issues: Record<string, unknown> = {};
  if (diff.diffs.length) issues.drift = diff.diffs[0];
  if (snapshot.state.maintenance) issues.maintenance = true;
  const [invalidated, projection, staged] = await db.batch([
    db
      .prepare(
        `SELECT m.id FROM match m JOIN match_rating r ON r.match_id = m.id
      LEFT JOIN rating_invalidation_current i ON i.match_id = m.id
      WHERE m.seq <= ? AND (i.match_id IS NOT NULL) IS NOT (r.rating_skip_reason IS 'invalidated') LIMIT 1`,
      )
      .bind(snapshot.state.cursor_seq),
    db.prepare(`SELECT p.user_id FROM player_rating p LEFT JOIN rating_account_exclusion e ON e.user_id = p.user_id
      WHERE p.excluded != COALESCE(e.excluded, 0) LIMIT 1`),
    db.prepare(`SELECT EXISTS(SELECT 1 FROM match_rating_next) OR EXISTS(SELECT 1 FROM match_player_rating_next)
      OR EXISTS(SELECT 1 FROM player_rating_next) AS staged`),
  ]);
  if (invalidated?.results.length) issues.invalidation = invalidated.results[0];
  if (projection?.results.length) issues.exclusion = projection.results[0];
  if ((staged?.results[0] as { staged: number } | undefined)?.staged)
    issues.staging = true;
  for (let cursor = 0; ;) {
    const { results } = await db
      .prepare(
        `${EVENT_SELECT}
      WHERE m.seq > ? ORDER BY m.seq LIMIT 500`,
      )
      .bind(cursor)
      .all<LedgerEvent>();
    for (const row of results) {
      const validate =
        row.a_id &&
        row.b_id &&
        row.a_id !== row.b_id &&
        writesLedgerRow({
          seatKinds: { A: "account", B: "account" },
          playBegan: true,
          endedBy: "action",
        });
      if (!validate && !issues.ledger) issues.ledger = row.id;
      if (replays && !issues.replay) {
        const problem = await verifyReplay(db, row.id);
        if (problem) issues.replay = { id: row.id, problem };
      }
    }
    const last = results.at(-1);
    if (!last) break;
    cursor = last.seq;
  }
  return {
    clean: Object.keys(issues).length === 0,
    issues,
    held: diff.rebuilt.matches
      .filter((r) => r.rating_status === "held")
      .map((r) => r.match_id),
  };
}
