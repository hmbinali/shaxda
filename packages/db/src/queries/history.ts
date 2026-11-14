import type { D1Database } from "@cloudflare/workers-types";
import type {
  HistoryCursor,
  HistoryFilter,
  MatchPayload,
} from "@shaxda/shared";
import {
  ACTIVE_PUBLIC_USER,
  toPublicProfile,
  type PublicProfile,
} from "./public-profile";

type Seat = MatchPayload["startingSeat"];
type Result = MatchPayload["players"][number]["result"];

type ProfileIdentity =
  | { profile_id: string; username: string }
  | { profile_id: string | null; username: null };

type JoinedProfile = ProfileIdentity & {
  avatar_mode: string | null;
  image: string | null;
};

type HistoryMatchRow = {
  id: string;
  mode: MatchPayload["mode"];
  rated: MatchPayload["rated"];
  end_reason: MatchPayload["endReason"];
  online_end_reason: MatchPayload["onlineEndReason"];
  started_at: number;
  ended_at: number;
  rating_status: "processed" | "held" | "skipped" | null;
  rating_skip_reason: "friendly" | "pairCap" | "invalidated" | null;
  rating_corrected: 0 | 1;
};

type HistoryPageRow = HistoryMatchRow &
  JoinedProfile & {
    result: Result;
    pieces_left: number;
    opponent_pieces_left: number;
  };

type MatchDetailRow = HistoryMatchRow &
  JoinedProfile & {
    user_id: string;
    seat: Seat;
    result: Result;
    pieces_left: number;
    captured: number;
    starting_seat: Seat;
    first_advantage_seat: MatchPayload["firstAdvantageSeat"];
    first_advantage_by: MatchPayload["firstAdvantageBy"];
    winner_seat: MatchPayload["winnerSeat"];
    action_count: number;
  };

type HistoryPageOptions = {
  userId: string;
  filter: HistoryFilter;
  cursor: HistoryCursor | null;
  limit?: number;
};

type HistoryTotals = {
  games: number;
  wins: number;
  losses: number;
  draws: number;
};

export type HistorySummary = HistoryTotals & { recent: Result[] };

const filters = {
  all: ["", null],
  wins: ["AND mp.result = ?", "win"],
  losses: ["AND mp.result = ?", "loss"],
  draws: ["AND mp.result = ?", "draw"],
  rated: ["AND m.rated = ?", 1],
  friendly: ["AND m.rated = ?", 0],
} as const satisfies Record<
  HistoryFilter,
  readonly [string, string | number | null]
>;

function isNeutralAccount(
  row: JoinedProfile,
): row is Extract<JoinedProfile, { username: null }> {
  return row.username === null;
}

function profileFor(row: JoinedProfile): PublicProfile | null {
  if (isNeutralAccount(row)) return null;
  const { profile_id, username, avatar_mode, image } = row;
  return toPublicProfile(profile_id, username, avatar_mode, image);
}

function matchFields(row: HistoryMatchRow) {
  const { rating_status: status, rating_skip_reason: reason } = row;
  const ratingDecision =
    status === "processed" || status === "held"
      ? { status }
      : status === "skipped" && reason !== null
        ? { status, reason }
        : null;
  return {
    id: row.id,
    mode: row.mode,
    rated: row.rated === 1,
    endReason: row.end_reason,
    onlineEndReason: row.online_end_reason,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    ratingDecision,
    ratingCorrected: row.rating_corrected === 1,
  };
}

export async function readHistoryPage(
  db: D1Database,
  { userId, filter, cursor, limit = 20 }: HistoryPageOptions,
) {
  const [filterSql, value] = filters[filter];
  const args: (string | number)[] = [userId];
  if (value !== null) args.push(value);
  if (cursor !== null) args.push(cursor.endedAt, cursor.matchId);
  args.push(limit + 1);

  const { results } = await db
    .prepare(
      `SELECT m.id, m.mode, m.rated, m.end_reason, m.online_end_reason, m.started_at,
       mp.ended_at, mp.result, mp.pieces_left, op.pieces_left AS opponent_pieces_left,
       u.id AS profile_id, u.username, u.avatar_mode, u.image,
       mr.rating_status, mr.rating_skip_reason, (rc.match_id IS NOT NULL) AS rating_corrected
     FROM match_player AS mp
     CROSS JOIN match AS m ON m.id = mp.match_id
     CROSS JOIN match_player AS op ON op.match_id = mp.match_id
       AND op.seat = CASE mp.seat WHEN 'A' THEN 'B' ELSE 'A' END
     LEFT JOIN user AS u ON u.id = op.user_id AND ${ACTIVE_PUBLIC_USER}
     LEFT JOIN match_rating AS mr ON m.rated = 1 AND mr.match_id = m.id
     LEFT JOIN rating_correction_mark AS rc ON m.rated = 1 AND rc.match_id = m.id
     WHERE mp.user_id = ? ${filterSql}
       ${cursor === null ? "" : "AND (mp.ended_at, mp.match_id) < (?, ?)"}
     ORDER BY mp.ended_at DESC, mp.match_id DESC LIMIT ?`,
    )
    .bind(...args)
    .all<HistoryPageRow>();

  const page = results.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page.map((row) => ({
      ...matchFields(row),
      result: row.result,
      piecesLeft: row.pieces_left,
      opponentPiecesLeft: row.opponent_pieces_left,
      opponent: profileFor(row),
    })),
    nextCursor:
      results.length > limit && last
        ? { endedAt: last.ended_at, matchId: last.id }
        : null,
  };
}

export async function readHistorySummary(
  db: D1Database,
  userId: string,
): Promise<HistorySummary> {
  const [totals, form] = await Promise.all([
    db
      .prepare(
        `SELECT count(*) AS games,
         count(CASE WHEN result = 'win' THEN 1 END) AS wins,
         count(CASE WHEN result = 'loss' THEN 1 END) AS losses,
         count(CASE WHEN result = 'draw' THEN 1 END) AS draws
       FROM match_player WHERE user_id = ?`,
      )
      .bind(userId)
      .first<HistoryTotals>(),
    db
      .prepare(
        `SELECT result FROM match_player WHERE user_id = ?
       ORDER BY ended_at DESC, match_id DESC LIMIT 20`,
      )
      .bind(userId)
      .all<{ result: Result }>(),
  ]);

  if (totals === null) throw new Error("History totals are unavailable.");
  return { ...totals, recent: form.results.map(({ result }) => result) };
}

export async function readMatchForViewer(
  db: D1Database,
  matchId: string,
  viewerUserId: string | null,
) {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.mode, m.rated, m.starting_seat, m.first_advantage_seat,
       m.first_advantage_by, m.winner_seat, m.end_reason, m.online_end_reason,
       m.action_count, m.started_at, m.ended_at, mp.seat, mp.user_id,
       mp.result, mp.pieces_left, mp.captured, u.id AS profile_id,
       u.username, u.avatar_mode, u.image,
       mr.rating_status, mr.rating_skip_reason, (rc.match_id IS NOT NULL) AS rating_corrected
     FROM match AS m CROSS JOIN match_player AS mp ON mp.match_id = m.id
     LEFT JOIN user AS u ON u.id = mp.user_id AND ${ACTIVE_PUBLIC_USER}
     LEFT JOIN match_rating AS mr ON m.rated = 1 AND mr.match_id = m.id
     LEFT JOIN rating_correction_mark AS rc ON m.rated = 1 AND rc.match_id = m.id
     WHERE m.id = ?`,
    )
    .bind(matchId)
    .all<MatchDetailRow>();

  const a = results.find((row) => row.seat === "A");
  const b = results.find((row) => row.seat === "B");
  if (results.length !== 2 || !a || !b) return { kind: "missing" } as const;

  const viewerSeat =
    results.find((row) => row.user_id === viewerUserId)?.seat ?? null;
  if (a.rated !== 1 && viewerSeat === null) return { kind: "missing" } as const;

  function player(row: MatchDetailRow) {
    return {
      profile: profileFor(row),
      result: row.result,
      piecesLeft: row.pieces_left,
      captured: row.captured,
    };
  }

  return {
    kind: "found",
    viewerSeat,
    match: {
      ...matchFields(a),
      startingSeat: a.starting_seat,
      firstAdvantageSeat: a.first_advantage_seat,
      firstAdvantageBy: a.first_advantage_by,
      winnerSeat: a.winner_seat,
      actionCount: a.action_count,
      players: { A: player(a), B: player(b) },
    },
  } as const;
}

export function readMatchReplay(db: D1Database, matchId: string) {
  return db
    .prepare("SELECT rules_v, replay_v, replay FROM match WHERE id = ?")
    .bind(matchId)
    .first<{ rules_v: number; replay_v: number; replay: string }>();
}
