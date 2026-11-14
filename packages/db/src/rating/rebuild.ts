import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { RATING_ALGORITHM_V } from "@shaxda/rating";
import { RATING_POLICY_V } from "@shaxda/shared/rated-play";
import {
  foldLedger,
  type LedgerEvent,
  type MatchRating,
  type PlayerRating,
  type SeatRating,
} from "./fold";
import { EVENT_SELECT, guard, type ProcessorState } from "./queries";

const MATCHES = "match_rating";
const SEATS = "match_player_rating";
const PLAYERS = "player_rating";
const TABLES = [MATCHES, SEATS, PLAYERS] as const;
type StoredMatch = MatchRating & { decided_at: number };
type Table = (typeof TABLES)[number];
type Rows = Record<string, string | number | null>;

export interface RatingSnapshot {
  state: ProcessorState;
  ledger: LedgerEvent[];
  invalidations: Set<string>;
  exclusions: Set<string>;
  sourceHeads: { invalidation: number; audit: number };
  matches: StoredMatch[];
  seats: SeatRating[];
  players: PlayerRating[];
  pending: { count: number; oldest: number | null };
}

interface SnapshotState extends ProcessorState {
  invalidation_head: number;
  audit_head: number;
}

const SOURCE_STATE = `
  SELECT s.*,
     (SELECT COALESCE(MAX(id), 0) FROM rating_invalidation_log) AS invalidation_head,
     (SELECT COALESCE(MAX(id), 0) FROM rating_admin_audit
       WHERE outcome = 'applied') AS audit_head
    FROM rating_processor_state s WHERE id = 1`;

export async function readRatingSnapshot(
  db: D1Database,
): Promise<RatingSnapshot> {
  const [stateRows, playerRows, exclusionRows, invalidationRows] =
    await db.batch([
      db.prepare(SOURCE_STATE),
      db.prepare("SELECT * FROM player_rating ORDER BY board_key"),
      db.prepare(
        "SELECT user_id FROM rating_account_exclusion WHERE excluded = 1",
      ),
      db.prepare("SELECT match_id FROM rating_invalidation_current"),
    ]);
  const state = stateRows?.results[0] as unknown as SnapshotState | undefined;
  if (!state) throw new Error("Missing rating processor state");
  const high = state.cursor_seq;
  const ledger: LedgerEvent[] = [];
  const matches: StoredMatch[] = [];
  const seats: SeatRating[] = [];
  const pageSize = 500;
  for (let cursor = 0; cursor < high;) {
    const page = await db
      .prepare(
        `${EVENT_SELECT}
       WHERE m.seq > ? AND m.seq <= ? ORDER BY m.seq LIMIT ?`,
      )
      .bind(cursor, high, pageSize)
      .all<LedgerEvent>();
    const last = page.results.at(-1);
    if (!last) break;
    ledger.push(...page.results);
    const [storedMatches, storedSeats] = await db.batch([
      db
        .prepare(
          "SELECT * FROM match_rating WHERE seq > ? AND seq <= ? ORDER BY seq",
        )
        .bind(cursor, last.seq),
      db
        .prepare(
          `SELECT s.* FROM match m JOIN match_player_rating s ON s.match_id = m.id
          WHERE m.seq > ? AND m.seq <= ? ORDER BY m.seq, s.seat`,
        )
        .bind(cursor, last.seq),
    ]);
    matches.push(...(storedMatches!.results as unknown as StoredMatch[]));
    seats.push(...(storedSeats!.results as unknown as SeatRating[]));
    cursor = last.seq;
  }

  const [endRows, pendingRows, extraRows, extraSeats] = await db.batch([
    db.prepare(SOURCE_STATE),
    db
      .prepare(
        "SELECT COUNT(*) AS count, MIN(saved_at) AS oldest FROM match WHERE seq > ?",
      )
      .bind(high),
    db
      .prepare("SELECT * FROM match_rating WHERE seq > ? ORDER BY seq LIMIT 1")
      .bind(high),
    db
      .prepare(
        `SELECT r.* FROM match m JOIN match_player_rating r ON r.match_id = m.id
      WHERE m.seq > ? ORDER BY m.seq, r.seat LIMIT 1`,
      )
      .bind(high),
  ]);
  const end = endRows?.results[0] as unknown as SnapshotState | undefined;
  if (
    !end ||
    state.cursor_seq !== end.cursor_seq ||
    state.invalidation_head !== end.invalidation_head ||
    state.audit_head !== end.audit_head ||
    state.policy_v !== end.policy_v ||
    state.algorithm_v !== end.algorithm_v ||
    state.maintenance !== end.maintenance
  ) {
    throw new Error("Rating state changed during the read");
  }
  // Include an unexpected decision above the cursor in the verification diff.
  matches.push(...(extraRows!.results as unknown as StoredMatch[]));
  seats.push(...(extraSeats!.results as unknown as SeatRating[]));
  return {
    state,
    ledger,
    matches,
    seats,
    players: playerRows!.results as unknown as PlayerRating[],
    invalidations: new Set(
      (invalidationRows!.results as { match_id: string }[]).map(
        ({ match_id }) => match_id,
      ),
    ),
    exclusions: new Set(
      (exclusionRows!.results as { user_id: string }[]).map(
        ({ user_id }) => user_id,
      ),
    ),
    sourceHeads: {
      invalidation: state.invalidation_head,
      audit: state.audit_head,
    },
    pending: pendingRows!.results[0] as unknown as RatingSnapshot["pending"],
  };
}

export interface Difference {
  table: Table;
  key: string;
  seq: number | null;
  matchId: string | null;
  column: string;
  live: string | number | null | Rows;
  rebuilt: string | number | null | Rows;
}

const ROW_KEYS: Record<Table, (row: Rows) => string> = {
  match_rating: (row) => String(row.match_id),
  match_player_rating: (row) => `${row.match_id}/${row.seat}`,
  player_rating: (row) => String(row.user_id),
};

export function verifyRebuild(
  snapshot: RatingSnapshot,
  invalidations = snapshot.invalidations,
  versions = {
    policy: snapshot.state.policy_v,
    algorithm: snapshot.state.algorithm_v,
  },
) {
  if (
    versions.policy !== RATING_POLICY_V ||
    versions.algorithm !== RATING_ALGORITHM_V
  ) {
    throw new Error("Unsupported rating policy or algorithm version");
  }
  const rebuilt = foldLedger(snapshot.ledger, {
    invalidations,
    exclusions: snapshot.exclusions,
  });
  const diffs: Difference[] = [];
  const changed = new Set<string>();
  const marked = new Set<string>();
  const sequence = new Map(snapshot.ledger.map((row) => [row.id, row.seq]));
  for (const row of snapshot.matches) {
    if (!sequence.has(row.match_id)) sequence.set(row.match_id, row.seq);
  }
  const counts = { match_rating: 0, match_player_rating: 0, player_rating: 0 };
  function compare(
    table: Table,
    liveRows: readonly object[],
    rebuiltRows: readonly object[],
  ) {
    const keyOf = ROW_KEYS[table];
    const live = new Map(
      liveRows.map((row) => [keyOf(row as Rows), row as Rows]),
    );
    const next = new Map(
      rebuiltRows.map((row) => [keyOf(row as Rows), row as Rows]),
    );
    for (const key of new Set([...next.keys(), ...live.keys()])) {
      const before = live.get(key);
      const after = next.get(key);
      const row = (after ?? before)!;
      const matchId = (row.match_id as string | undefined) ?? null;
      const seq = matchId
        ? (sequence.get(matchId) ?? Number(row.seq ?? 0))
        : Number(row.last_seq);
      const start = diffs.length;
      if (!before || !after) {
        diffs.push({
          table,
          key,
          matchId,
          seq,
          column: "row",
          live: before ?? null,
          rebuilt: after ?? null,
        });
        if (matchId) marked.add(matchId);
      } else {
        for (const [column, value] of Object.entries(after)) {
          if (column === "decided_at" || Object.is(before[column], value))
            continue;
          diffs.push({
            table,
            key,
            matchId,
            seq,
            column,
            live: before[column] ?? null,
            rebuilt: value,
          });
          if (
            matchId &&
            (column === "rating_status" ||
              column === "rating_skip_reason" ||
              ((column === "rating_before" || column === "rating_after") &&
                Math.round(Number(before[column])) !==
                  Math.round(Number(value))))
          ) {
            marked.add(matchId);
          }
        }
      }
      if (start !== diffs.length) {
        counts[table]++;
        if (matchId) changed.add(matchId);
      }
    }
  }
  // Exclude the storage timestamp even when a live row is missing from the rebuild.
  compare(
    MATCHES,
    snapshot.matches.map(({ decided_at, ...row }) => {
      void decided_at;
      return row;
    }),
    rebuilt.matches,
  );
  compare(SEATS, snapshot.seats, rebuilt.seats);
  compare(PLAYERS, snapshot.players, rebuilt.players);
  return { rebuilt, diffs, counts, changed: [...changed], marked: [...marked] };
}

export async function acquireMaintenance(
  db: D1Database,
  token: string,
  high: number,
  now: number,
): Promise<0 | 1 | null> {
  const [before, lease] = await db.batch([
    db.prepare("SELECT maintenance FROM rating_processor_state WHERE id = 1"),
    db
      .prepare(
        `
      UPDATE rating_processor_state
         SET lease_token = ?, lease_expires_at = ?, maintenance = 1, updated_at = ?
       WHERE id = 1 AND cursor_seq = ? AND (lease_token IS NULL OR lease_expires_at <= ?)
    `,
      )
      .bind(token, now + 60_000, now, high, now),
  ]);
  if (lease?.meta.changes !== 1) return null;
  const state = before?.results[0] as Pick<ProcessorState, "maintenance">;
  return state.maintenance === 1 ? 1 : 0;
}

function clearNext(db: D1Database) {
  return TABLES.map((table) => db.prepare(`DELETE FROM ${table}_next`));
}

export async function releaseMaintenance(
  db: D1Database,
  token: string,
  high: number,
  now: number,
  keepPaused: boolean,
  extra: D1PreparedStatement[] = [],
) {
  await db.batch([
    guard(db, token, now, high, 1),
    ...clearNext(db),
    ...extra,
    db
      .prepare(
        `UPDATE rating_processor_state SET maintenance = ?, updated_at = ?,
      lease_token = NULL, lease_expires_at = NULL WHERE id = 1`,
      )
      .bind(Number(keepPaused), now),
    db.prepare("DELETE FROM rating_fence"),
  ]);
}

export async function stageRebuild(
  db: D1Database,
  snapshot: RatingSnapshot,
  diff: ReturnType<typeof verifyRebuild>,
  token: string,
  now: () => number,
): Promise<void> {
  const { rebuilt } = diff;
  const { cursor_seq: high } = snapshot.state;
  const changed = new Set(
    diff.diffs.filter((d) => d.table === MATCHES).map((d) => d.matchId),
  );
  const previousTimes = new Map(
    snapshot.matches.map((row) => [row.match_id, row.decided_at]),
  );
  const tables: readonly { table: Table; rows: readonly object[] }[] = [
    {
      table: MATCHES,
      rows: rebuilt.matches.map((row) => ({
        ...row,
        decided_at: changed.has(row.match_id)
          ? 0
          : (previousTimes.get(row.match_id) ?? 0),
      })),
    },
    { table: SEATS, rows: rebuilt.seats },
    { table: PLAYERS, rows: rebuilt.players },
  ];
  for (const { table, rows } of tables) {
    const staged = await verifiedPrefix(db, table, rows);
    if (staged === null) {
      await db.batch([
        guard(db, token, now(), high, 1),
        db.prepare(`DELETE FROM ${table}_next`),
        db.prepare("DELETE FROM rating_fence"),
      ]);
    }
    for (let i = staged ?? 0; i < rows.length; i += 100) {
      const instant = now();
      const inserts = rows.slice(i, i + 100).map((row) => {
        const values = Object.values(row);
        return db
          .prepare(
            `INSERT INTO ${table}_next (${Object.keys(row).join(",")})
          VALUES (${values.map(() => "?").join(",")})`,
          )
          .bind(...values);
      });
      await db.batch([
        guard(db, token, instant, high, 1),
        ...inserts,
        db
          .prepare(
            "UPDATE rating_processor_state SET lease_expires_at = ? WHERE id = 1",
          )
          .bind(instant + 60_000),
        db.prepare("DELETE FROM rating_fence"),
      ]);
    }
  }
}

// Shadow insertion order is the checkpoint. Verify the prefix against the
// newly folded plan before resuming, including when a prior operator staged
// a different correction at the same high-water mark.
async function verifiedPrefix(
  db: D1Database,
  table: Table,
  rebuilt: readonly object[],
): Promise<number | null> {
  let checkpoint = 0;
  for (;;) {
    const page = await db
      .prepare(
        `SELECT rowid AS staging_row, * FROM ${table}_next
      WHERE rowid > ? ORDER BY rowid LIMIT 500`,
      )
      .bind(checkpoint)
      .all<Rows>();
    for (const { staging_row: index, ...row } of page.results) {
      if (index !== checkpoint + 1 || checkpoint >= rebuilt.length) return null;
      const expected = rebuilt[checkpoint] as Rows;
      if (
        !Object.keys(expected).every((column) =>
          Object.is(row[column], expected[column]),
        )
      ) {
        return null;
      }
      checkpoint++;
    }
    if (page.results.length < 500) return checkpoint;
  }
}

export async function publishRebuild(
  db: D1Database,
  options: {
    token: string;
    high: number;
    now: number;
    counts: readonly [number, number, number];
    extra?: D1PreparedStatement[];
  },
) {
  const { token, high, now, counts, extra = [] } = options;
  await db.batch([
    guard(db, token, now, high, 1),
    db
      .prepare(
        `INSERT INTO rating_fence (ok) SELECT
        (SELECT COUNT(*) FROM match_rating_next) = ?1
    AND (SELECT COUNT(*) FROM match_player_rating_next) = ?2
    AND (SELECT COUNT(*) FROM player_rating_next) = ?3`,
      )
      .bind(...counts),
    ...extra,
    db
      .prepare(
        "UPDATE match_rating_next SET decided_at = ? WHERE decided_at = 0",
      )
      .bind(now),
    ...TABLES.flatMap((table) => [
      db.prepare(`DELETE FROM ${table}`),
      db.prepare(`INSERT INTO ${table} SELECT * FROM ${table}_next`),
    ]),
    ...clearNext(db),
    db
      .prepare(
        `UPDATE rating_processor_state SET maintenance = 0, updated_at = ?,
        lease_token = NULL, lease_expires_at = NULL, policy_v = ?, algorithm_v = ?
      WHERE id = 1`,
      )
      .bind(now, RATING_POLICY_V, RATING_ALGORITHM_V),
    db.prepare("DELETE FROM rating_fence"),
  ]);
}
