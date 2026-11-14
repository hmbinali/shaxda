import { randomBytes } from "node:crypto";
import { matchPayloadHash } from "../../../packages/shared/src/index";
import { sampleMatchPayloads } from "../../../packages/shared/src/match-fixtures";
import { executeE2eD1, sql } from "./auth";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function seedMatches(
  a: string,
  b: string,
  count: number,
  {
    rated = false,
    sample,
  }: { rated?: boolean; sample?: keyof typeof sampleMatchPayloads } = {},
) {
  const room = Array.from(randomBytes(8), (byte) => alphabet[byte % 32]).join(
    "",
  );
  const roomCreatedAt = Date.now();
  const ids: string[] = [];
  const statements: string[] = [];

  for (let index = 0; index < count; index++) {
    const fixture = sample
      ? sampleMatchPayloads[sample]
      : [
          sampleMatchPayloads.M1,
          sampleMatchPayloads.M9,
          sampleMatchPayloads.M5,
        ][index % 3]!;
    const id = Array.from(randomBytes(20), (byte) => alphabet[byte % 32]).join(
      "",
    );
    const matchNumber = index + 1;
    const endedAt = roomCreatedAt + matchNumber * 1000;
    const match = {
      ...fixture,
      id,
      roomCode: room,
      roomCreatedAt,
      matchNumber,
      rated: rated ? (1 as const) : (0 as const),
      consentPolicyV: rated ? 1 : null,
      startedAt: endedAt - 45_000,
      endedAt,
      players: [
        { ...fixture.players[0], userId: a },
        { ...fixture.players[1], userId: b },
      ] as typeof fixture.players,
    };
    const values = [
      match.id,
      match.roomCode,
      match.roomCreatedAt,
      match.matchNumber,
      match.mode,
      match.rated,
      match.consentPolicyV,
      match.rulesV,
      match.replayV,
      match.replay,
      match.startingSeat,
      match.firstAdvantageSeat,
      match.firstAdvantageBy,
      match.winnerSeat,
      match.endReason,
      match.onlineEndReason,
      match.actionCount,
      await matchPayloadHash(match),
      match.startedAt,
      match.endedAt,
    ];
    const literals = values.map((value) =>
      typeof value === "number" ? value : sql(value),
    );
    statements.push(`INSERT INTO match (
      id, room_code, room_created_at, match_number, mode, rated, consent_policy_v,
      rules_v, replay_v, replay, starting_seat, first_advantage_seat, first_advantage_by,
      winner_seat, end_reason, online_end_reason, action_count, payload_hash, started_at,
      ended_at
    ) VALUES (${literals.join(",")})`);
    for (const player of match.players) {
      statements.push(`INSERT INTO match_player (
        match_id, seat, user_id, result, pieces_left, captured, ended_at
      ) VALUES (${[
        sql(id),
        sql(player.seat),
        sql(player.userId),
        sql(player.result),
        player.piecesLeft,
        player.captured,
        endedAt,
      ].join(",")})`);
    }
    ids.push(id);
  }
  executeE2eD1(statements.join(";"));
  return {
    ids,
    cleanup() {
      const filter = ids.map(sql).join(",");
      executeE2eD1(
        `DELETE FROM match_player WHERE match_id IN (${filter}); DELETE FROM match WHERE id IN (${filter})`,
      );
    },
  };
}
