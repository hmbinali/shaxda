import type { LedgerEvent } from "./fold";

export const EVENT_SELECT = `
  SELECT m.seq, m.id, m.mode, m.rated, m.consent_policy_v, m.rules_v,
         m.replay_v, m.winner_seat, m.ended_at,
         a.user_id AS a_id, b.user_id AS b_id,
         a.result AS a_result, b.result AS b_result
    FROM match m
    LEFT JOIN match_player a ON a.match_id = m.id AND a.seat = 'A'
    LEFT JOIN match_player b ON b.match_id = m.id AND b.seat = 'B'`;

export const PAIR_SELECT = `
  SELECT r.seq, a.match_id, a.ended_at
    FROM match_player a INDEXED BY match_player_owner_idx
    JOIN match_player b ON b.match_id = a.match_id AND b.user_id = ?2
    JOIN match_rating r ON r.match_id = a.match_id
   WHERE a.user_id = ?1 AND a.ended_at > ?3 AND a.ended_at <= ?4
     AND r.seq < ?5 AND r.rating_status = 'processed'`;

export interface ProcessorState {
  cursor_seq: number;
  lease_token: string | null;
  lease_expires_at: number | null;
  maintenance: number;
  policy_v: number;
  algorithm_v: number;
}

export function pendingEvents(db: D1Database, cursor: number, limit: number) {
  return db
    .prepare(`${EVENT_SELECT} WHERE m.seq > ? ORDER BY m.seq LIMIT ?`)
    .bind(cursor, limit)
    .all<LedgerEvent>();
}

export function guard(
  db: D1Database,
  token: string,
  now: number,
  cursor: number,
  maintenance: 0 | 1,
): D1PreparedStatement {
  return db
    .prepare(
      `
    INSERT INTO rating_fence (ok) VALUES ((
      SELECT lease_token = ?1 AND lease_expires_at > ?2
         AND cursor_seq = ?3 AND maintenance = ?4
        FROM rating_processor_state WHERE id = 1
    ))`,
    )
    .bind(token, now, cursor, maintenance);
}
