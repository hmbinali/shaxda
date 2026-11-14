import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import {
  acquireMaintenance,
  publishRebuild,
  readRatingSnapshot,
  releaseMaintenance,
  stageRebuild,
  verifyRebuild,
  type RatingSnapshot,
} from "../rating/rebuild";
import { guard } from "../rating/queries";

export type Mutation =
  | "invalidate-match"
  | "rescind-invalidation"
  | "exclude-account"
  | "include-account"
  | "pause-ratings"
  | "resume-ratings"
  | "rebuild-ratings";
export type Environment = "local" | "preview" | "production";

export interface AdminRequest {
  command: Mutation;
  environment: Environment;
  databaseId: string;
  target: string | null;
  reason: string;
  actor: string;
}

type Outcome = "planned" | "applied" | "noop" | "rejected" | "failed";

const CLOCK = "CAST(unixepoch('subsecond') * 1000 AS INTEGER)";

export async function databaseTime(db: D1Database): Promise<number> {
  const now = await db.prepare(`SELECT ${CLOCK} AS now`).first<number>("now");
  if (now === null) throw new Error("D1 clock unavailable");
  return now;
}

function audit(
  db: D1Database,
  req: AdminRequest,
  outcome: Outcome,
  digest: string,
  high: number,
  detail: object,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO rating_admin_audit
      (at, environment, actor, command, target, reason, outcome, plan_digest, high_water_seq, detail)
    VALUES (${CLOCK}, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      req.environment,
      req.actor,
      req.command,
      req.target,
      req.reason,
      outcome,
      digest,
      high,
      JSON.stringify(detail),
    );
}

function exclusion(req: AdminRequest): 0 | 1 | null {
  if (req.command === "exclude-account") return 1;
  if (req.command === "include-account") return 0;
  return null;
}

function invalidation(req: AdminRequest): "invalidate" | "rescind" | null {
  if (req.command === "invalidate-match") return "invalidate";
  if (req.command === "rescind-invalidation") return "rescind";
  return null;
}

async function makePlan(
  db: D1Database,
  req: AdminRequest,
  snapshot: RatingSnapshot,
) {
  const {
    cursor_seq: high,
    policy_v: policyV,
    algorithm_v: algorithmV,
  } = snapshot.state;
  const target = req.target;
  const action = invalidation(req);
  const excluded = exclusion(req);
  const invalidations = new Set(snapshot.invalidations);
  let changed = true;
  if (target && action) {
    const rated = await db
      .prepare("SELECT rated FROM match WHERE id = ?")
      .bind(target)
      .first("rated");
    if (rated !== 1)
      throw new Error(rated === null ? "unknownMatch" : "friendlyMatch");
    changed = invalidations.has(target) !== (action === "invalidate");
    if (action === "invalidate") invalidations.add(target);
    else invalidations.delete(target);
  }
  if (excluded !== null && target)
    changed = Number(snapshot.exclusions.has(target)) !== excluded;
  if (req.command === "pause-ratings")
    changed = snapshot.state.maintenance === 0;
  if (req.command === "resume-ratings")
    changed = snapshot.state.maintenance === 1;
  const rebuild =
    action || req.command === "rebuild-ratings"
      ? verifyRebuild(snapshot, invalidations)
      : null;
  if (req.command === "rebuild-ratings") changed = !!rebuild?.diffs.length;
  const halves = {
    command: req.command,
    target,
    reason: req.reason,
    environment: req.environment,
    databaseId: req.databaseId,
    highWaterSeq: high,
    policyV,
    algorithmV,
    invalidationHead: snapshot.sourceHeads.invalidation,
    exclusionHead: snapshot.sourceHeads.audit,
    diff: rebuild?.diffs ?? [],
  };
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(halves)),
  );
  const digest = Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return { high, digest, changed, rebuild, action, excluded };
}

export async function planRatingAdmin(db: D1Database, req: AdminRequest) {
  const plan = await makePlan(db, req, await readRatingSnapshot(db));
  const outcome = plan.changed ? "planned" : "noop";
  await audit(db, req, outcome, plan.digest, plan.high, {
    counts: plan.rebuild?.counts,
  }).run();
  return {
    outcome,
    high: plan.high,
    digest: plan.digest,
    changed: plan.rebuild?.changed.length ?? 0,
    marked: plan.rebuild?.marked.length ?? 0,
    sample: plan.rebuild?.diffs.slice(0, 20) ?? [],
  };
}

function appliedAuditId() {
  return "(SELECT id FROM rating_admin_audit WHERE plan_digest = ? AND outcome = 'applied')";
}

function corrections(
  db: D1Database,
  req: AdminRequest,
  plan: Awaited<ReturnType<typeof makePlan>>,
  detail: object,
  snapshot: RatingSnapshot,
): D1PreparedStatement[] {
  const { digest, high, action, rebuild } = plan;
  if (!rebuild) throw new Error("Missing correction");
  const { policy_v, algorithm_v } = snapshot.state;
  return [
    audit(db, req, "applied", digest, high, detail),
    ...(action
      ? [
          db
            .prepare(
              `INSERT INTO rating_invalidation_log
      (match_id, action, reason, actor, audit_id, created_at)
      VALUES (?, ?, ?, ?, ${appliedAuditId()}, ${CLOCK})`,
            )
            .bind(req.target, action, req.reason, req.actor, digest),
        ]
      : []),
    db
      .prepare(
        `INSERT INTO rating_rebuild
      (published_at, audit_id, reason, high_water_seq, policy_v, algorithm_v, changed_events, marked_events)
      VALUES (${CLOCK}, ${appliedAuditId()}, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        digest,
        req.reason,
        high,
        policy_v,
        algorithm_v,
        rebuild.changed.length,
        rebuild.marked.length,
      ),
    ...Array.from(
      { length: Math.ceil(rebuild.marked.length / 10_000) },
      (_, i) =>
        db
          .prepare(
            `INSERT INTO rating_correction_mark (match_id, rebuild_id)
        SELECT value, (SELECT id FROM rating_rebuild WHERE audit_id = ${appliedAuditId()})
        FROM json_each(?) WHERE true
        ON CONFLICT (match_id) DO UPDATE SET rebuild_id = excluded.rebuild_id`,
          )
          .bind(
            digest,
            JSON.stringify(rebuild.marked.slice(i * 10_000, (i + 1) * 10_000)),
          ),
    ),
  ];
}

export async function applyRatingAdmin(
  db: D1Database,
  req: AdminRequest,
  digest: string,
  detail: { restorePoint?: string } = {},
  options: { afterStaging?: () => Promise<void>; waitMs?: number } = {},
) {
  const accepted = await db
    .prepare(
      `SELECT outcome, high_water_seq
    FROM rating_admin_audit WHERE plan_digest = ? AND environment = ?
     AND command = ? AND target IS ? AND reason = ?
     AND outcome IN ('planned', 'applied') ORDER BY id DESC LIMIT 1`,
    )
    .bind(digest, req.environment, req.command, req.target, req.reason)
    .first<{ outcome: Outcome; high_water_seq: number }>();
  const snapshot = await readRatingSnapshot(db);
  const high = snapshot.state.cursor_seq;
  async function finish(outcome: Outcome, code: string) {
    await audit(db, req, outcome, digest, high, { ...detail, code }).run();
    return { outcome, code };
  }
  if (!accepted) return finish("rejected", "unknownPlan");
  if (accepted.outcome === "applied") return finish("noop", "alreadyApplied");
  if (accepted.high_water_seq !== high)
    return finish("rejected", "staleHighWater");
  const plan = await makePlan(db, req, snapshot);
  if (plan.digest !== digest) return finish("rejected", "digestMismatch");
  if (req.environment !== "local" && !detail.restorePoint) {
    return finish("rejected", "missingRestorePoint");
  }

  const requestedExclusion = plan.excluded;
  if (requestedExclusion !== null) {
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO rating_fence VALUES ((
          SELECT maintenance = 0 AND cursor_seq = ?1 AND
            (SELECT COALESCE(MAX(id), 0) FROM rating_admin_audit WHERE outcome = 'applied') = ?2
          FROM rating_processor_state WHERE id = 1))`,
          )
          .bind(high, snapshot.sourceHeads.audit),
        audit(db, req, "applied", digest, high, detail),
        db
          .prepare(
            `INSERT INTO rating_account_exclusion (user_id, excluded, reason, audit_id, changed_at)
          VALUES (?, ?, ?, ${appliedAuditId()}, ${CLOCK})
          ON CONFLICT(user_id) DO UPDATE SET excluded = excluded.excluded,
            reason = excluded.reason, audit_id = excluded.audit_id, changed_at = excluded.changed_at`,
          )
          .bind(req.target, requestedExclusion, req.reason, digest),
        db
          .prepare("UPDATE player_rating SET excluded = ? WHERE user_id = ?")
          .bind(requestedExclusion, req.target),
        db.prepare("DELETE FROM rating_fence"),
      ]);
      return { outcome: "applied" as const };
    } catch {
      return finish("rejected", "maintenanceBusyOrPlanChanged");
    }
  }

  const token = crypto.randomUUID();
  const timeout = Date.now() + (options.waitMs ?? 120_000);
  while (!(await acquireMaintenance(db, token, high, await databaseTime(db)))) {
    const cursor = await db
      .prepare("SELECT cursor_seq FROM rating_processor_state WHERE id = 1")
      .first("cursor_seq");
    if (cursor !== high) return finish("rejected", "staleHighWater");
    if (Date.now() >= timeout) return finish("rejected", "maintenanceBusy");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  try {
    const paused = await readRatingSnapshot(db);
    const revised = await makePlan(db, req, paused);
    if (revised.digest !== digest) {
      await releaseMaintenance(
        db,
        token,
        high,
        await databaseTime(db),
        snapshot.state.maintenance === 1,
      );
      return finish("rejected", "digestMismatch");
    }
    const rebuild = revised.rebuild;
    if (rebuild) {
      // D1 issues the lease and publish timestamps. Chunk renewals use the
      // same monotonic process clock offset from that lease.
      const start = await databaseTime(db);
      const localStart = performance.now();
      await stageRebuild(
        db,
        paused,
        rebuild,
        token,
        () => start + Math.floor(performance.now() - localStart),
      );
      await options.afterStaging?.();
      await publishRebuild(db, {
        token,
        high,
        now: await databaseTime(db),
        counts: [
          rebuild.rebuilt.matches.length,
          rebuild.rebuilt.seats.length,
          rebuild.rebuilt.players.length,
        ],
        extra: corrections(
          db,
          req,
          revised,
          { ...detail, counts: rebuild.counts },
          paused,
        ),
      });
    } else {
      await releaseMaintenance(
        db,
        token,
        high,
        await databaseTime(db),
        req.command === "pause-ratings",
        [audit(db, req, "applied", digest, high, detail)],
      );
    }
    return { outcome: "applied" as const };
  } catch (error) {
    const current = await databaseTime(db);
    try {
      await releaseMaintenance(
        db,
        token,
        high,
        current,
        snapshot.state.maintenance === 1,
      );
    } catch {
      throw error;
    }
    return finish("failed", "publishFailed");
  }
}

export async function setLocalRatingMaintenance(
  db: D1Database,
  mode: "pause" | "resume",
) {
  const now = await databaseTime(db);
  const { state } = await readRatingSnapshot(db);
  const token = crypto.randomUUID();
  if (!(await acquireMaintenance(db, token, state.cursor_seq, now)))
    return false;
  await releaseMaintenance(
    db,
    token,
    state.cursor_seq,
    await databaseTime(db),
    mode === "pause",
  );
  return true;
}

export function assertMaintenanceFence(
  db: D1Database,
  token: string,
  now: number,
  high: number,
) {
  return guard(db, token, now, high, 1);
}

export {
  checkConsistency,
  inspectMatch,
  inspectRating,
  verifyReplay,
} from "./inspect";
export { readRatingSnapshot, verifyRebuild } from "../rating/rebuild";
