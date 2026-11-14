import type { MatchPayload } from "@shaxda/shared";

export type SaveMatchResult =
  | { status: "saved"; matchId: string; existed: boolean }
  | { status: "conflict" }
  | { status: "failed"; error: unknown };

export async function saveMatch(
  db: D1Database,
  p: MatchPayload,
  payloadHash: string,
): Promise<SaveMatchResult> {
  try {
    const playerInsert = db.prepare(
      `INSERT INTO match_player
        (match_id, seat, user_id, result, pieces_left, captured, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO match (
          id, room_code, room_created_at, match_number, mode, rated, consent_policy_v,
          rules_v, replay_v, replay, starting_seat, first_advantage_seat, first_advantage_by,
          winner_seat, end_reason, online_end_reason, action_count, stats_v, stats_status,
          stats_json, payload_hash, started_at, ended_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          p.id,
          p.roomCode,
          p.roomCreatedAt,
          p.matchNumber,
          p.mode,
          p.rated,
          p.consentPolicyV,
          p.rulesV,
          p.replayV,
          p.replay,
          p.startingSeat,
          p.firstAdvantageSeat,
          p.firstAdvantageBy,
          p.winnerSeat,
          p.endReason,
          p.onlineEndReason,
          p.actionCount,
          p.statsV,
          p.statsStatus,
          p.statsJson,
          payloadHash,
          p.startedAt,
          p.endedAt,
        ),
      ...p.players.map(({ seat, userId, result, piecesLeft, captured }) =>
        playerInsert.bind(
          p.id,
          seat,
          userId,
          result,
          piecesLeft,
          captured,
          p.endedAt,
        ),
      ),
    ]);
    if (results.some((result) => !result.success))
      throw new Error("D1 batch failed.");
    return { status: "saved", matchId: p.id, existed: false };
  } catch (error) {
    try {
      const prior = await db
        .prepare(
          `SELECT id, payload_hash FROM match
         WHERE room_code = ? AND room_created_at = ? AND match_number = ?`,
        )
        .bind(p.roomCode, p.roomCreatedAt, p.matchNumber)
        .first<{ id: string; payload_hash: string }>();
      if (prior) {
        return prior.payload_hash === payloadHash
          ? { status: "saved", matchId: prior.id, existed: true }
          : { status: "conflict" };
      }
    } catch (lookupError) {
      return { status: "failed", error: lookupError };
    }
    return { status: "failed", error };
  }
}
