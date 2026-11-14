import type { MatchRating, SeatRating } from "./fold";

interface MatchStatus {
  rated: number;
  rating_status: MatchRating["rating_status"] | null;
  rating_skip_reason: MatchRating["rating_skip_reason"];
  maintenance: number | null;
  corrected: number;
}

function displayedSeat(s: SeatRating) {
  const before = Math.round(s.rating_before);
  const after = Math.round(s.rating_after);
  return {
    before,
    after,
    delta: after - before,
    provisional: s.rd_after > 110,
  };
}

export async function readMatchRating(
  db: D1Database,
  id: string,
  viewerId: string | null,
) {
  const [matches, seats] = await db.batch([
    db
      .prepare(
        `
      SELECT m.rated, r.rating_status, r.rating_skip_reason, s.maintenance,
             (c.match_id IS NOT NULL) AS corrected
        FROM match m
        LEFT JOIN match_rating r ON r.match_id = m.id
        LEFT JOIN rating_processor_state s ON s.id = 1
        LEFT JOIN rating_correction_mark c ON c.match_id = m.id
       WHERE m.id = ?1 AND (m.rated = 1 OR EXISTS (
         SELECT 1 FROM match_player p WHERE p.match_id = m.id AND p.user_id = ?2
       ))`,
      )
      .bind(id, viewerId),
    db
      .prepare(
        `
      SELECT r.* FROM match m JOIN match_player_rating r ON r.match_id = m.id
       WHERE m.id = ?1 AND (m.rated = 1 OR EXISTS (
         SELECT 1 FROM match_player p WHERE p.match_id = m.id AND p.user_id = ?2
       )) ORDER BY r.seat`,
      )
      .bind(id, viewerId),
  ]);
  const row = matches!.results[0] as MatchStatus | undefined;
  if (!row) return null;
  const [a, b] = seats!.results as SeatRating[];
  return {
    status: row.rating_status ?? "pending",
    reason: row.rating_skip_reason,
    updating: row.maintenance === 1,
    corrected:
      row.rated === 1 &&
      row.corrected === 1 &&
      row.rating_skip_reason !== "invalidated",
    seats:
      row.rating_status === "processed" && a && b
        ? { A: displayedSeat(a), B: displayedSeat(b) }
        : null,
  };
}
