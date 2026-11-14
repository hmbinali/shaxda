import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { z } from "zod";
import { getPlatformProxy } from "wrangler";
import {
  applyRatingAdmin,
  checkConsistency,
  databaseTime,
  inspectMatch,
  inspectRating,
  planRatingAdmin,
  readRatingSnapshot,
  setLocalRatingMaintenance,
  verifyRebuild,
  verifyReplay,
} from "@shaxda/db/rating-admin";
import { matchIdSchema, usernameSchema } from "@shaxda/shared";
import {
  acquireMaintenance,
  publishRebuild,
  stageRebuild,
} from "@shaxda/db/rating-rebuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const web = resolve(root, "web");
const dbs = {
  local: ["shaxda-db", "b84cc232-ddbd-437d-acd0-0fa0d77e12b0"],
  preview: ["shaxda-db-preview", "5a84ac83-8387-4b68-b831-28ec450cd922"],
  production: ["shaxda-db", "b84cc232-ddbd-437d-acd0-0fa0d77e12b0"],
};
const matchReads = ["inspect-match", "verify-replay", "inspect-rating"];
const matchWrites = ["invalidate-match", "rescind-invalidation"];
const accountCommands = ["exclude-account", "include-account"];
const readCommands = [...matchReads, "check-consistency"];
const writes = [
  ...matchWrites,
  ...accountCommands,
  "pause-ratings",
  "resume-ratings",
  "rebuild-ratings",
];

function run(program, args) {
  return execFileSync(program, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
const output = (result) => console.log(JSON.stringify(result, null, 2));

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const rebuild = mode === "rebuild";
  const args = rest[0] === "--" ? rest.slice(1) : rest;
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      database: { type: "string" },
      reason: { type: "string" },
      apply: { type: rebuild ? "boolean" : "string" },
      pause: { type: "boolean" },
      resume: { type: "boolean" },
      "user-id": { type: "string" },
      username: { type: "string" },
      "confirm-database": { type: "string" },
      full: { type: "boolean" },
      "no-replays": { type: "boolean" },
    },
  });
  const environment = z
    .enum(["local", "preview", "production"])
    .parse(values.database);
  const [database, databaseId] = dbs[environment];
  if (mode !== "rebuild" && mode !== "admin")
    throw new Error("Unknown ratings tool");
  const [command, id, ...extra] = positionals;
  const read =
    readCommands.includes(command) ||
    (command === "rebuild-ratings" && values.reason === undefined);
  const allowedFlags = rebuild
    ? ["database", "pause", "resume", "apply"]
    : [
        "database",
        ...(writes.includes(command)
          ? ["reason", "apply", "confirm-database"]
          : []),
        ...(accountCommands.includes(command) ? ["username", "user-id"] : []),
        ...(command === "inspect-rating" ? ["full"] : []),
        ...(command === "check-consistency" ? ["no-replays"] : []),
      ];
  if (
    extra.length ||
    !Object.keys(values).every((flag) => allowedFlags.includes(flag))
  ) {
    throw new Error("Invalid command arguments");
  }
  let target = null;
  let reason = null;
  if (rebuild) {
    if (
      positionals.length ||
      [values.apply, values.pause, values.resume].filter(Boolean).length > 1
    ) {
      throw new Error("Use at most one of --apply, --pause, or --resume");
    }
    if (
      environment !== "local" &&
      (values.apply || values.pause || values.resume)
    ) {
      throw new Error("Use rating:admin for audited remote changes");
    }
  } else {
    if (!read && !writes.includes(command))
      throw new Error("Unknown rating admin command");
    if ([...matchReads, ...matchWrites].includes(command))
      target = matchIdSchema.parse(id);
    else if (id !== undefined)
      throw new Error("Unexpected positional argument");
    if (!read)
      reason = z
        .string()
        .min(3)
        .max(500)
        .regex(/^[^\p{C}]+$/u)
        .parse(values.reason);
    if (values.apply !== undefined) {
      z.string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(values.apply);
      if (read) throw new Error("An apply needs the same reason as the plan");
      if (
        environment === "production" &&
        values["confirm-database"] !== database
      ) {
        throw new Error(
          "Confirm the production database with --confirm-database shaxda-db",
        );
      }
    }
    if (accountCommands.includes(command)) {
      if (
        (values["user-id"] === undefined) ===
        (values.username === undefined)
      ) {
        throw new Error("Use exactly one of --user-id or --username");
      }
      if (values["user-id"] !== undefined) {
        target = z
          .string()
          .min(1)
          .max(128)
          .regex(/^[A-Za-z0-9_.:-]+$/)
          .parse(values["user-id"]);
      }
      if (values.username !== undefined) usernameSchema.parse(values.username);
    }
  }

  const configPath = fileURLToPath(
    new URL(`./wrangler.${environment}.jsonc`, import.meta.url),
  );
  console.log(
    `${environment} · ${configPath} · ${database} · ${databaseId} · ${values.apply ? "apply" : read || (rebuild && !values.pause && !values.resume) ? "read" : "plan"}`,
  );
  const remote = environment !== "local";
  const wrangler = (args) =>
    run("pnpm", ["--dir", web, "exec", "wrangler", ...args]);
  let identity = "local";
  if (remote) {
    const who = wrangler(["whoami", "--json", "--config", configPath]);
    const info = JSON.parse(who);
    if (!info.loggedIn) throw new Error("Wrangler login required");
    const credential = info.email ?? info.tokenType ?? info.authType;
    const account = info.accounts?.[0]?.id ?? info.account?.id;
    if (!credential || (!info.email && !account))
      throw new Error("Wrangler identity unavailable");
    identity = info.email ?? `${credential} ${account}`;
  }
  // Wrangler 4.107 falls back to .dev.vars when envFiles is an empty array.
  // An explicitly named empty binding file also avoids process-env overrides.
  process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "true";
  process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV = "false";
  const proxy = await getPlatformProxy({
    configPath,
    envFiles: ["bindings.env"],
    remoteBindings: remote,
    persist: remote ? false : { path: resolve(web, ".wrangler/state/v3") },
  });
  try {
    const { DB: db } = proxy.env;
    if (rebuild) {
      if (values.pause || values.resume)
        return (await setLocalRatingMaintenance(
          db,
          values.pause ? "pause" : "resume",
        ))
          ? 0
          : 2;
      const snapshot = await readRatingSnapshot(db);
      const diff = verifyRebuild(snapshot);
      const status = {};
      for (const row of diff.rebuilt.matches) {
        const key = row.rating_skip_reason ?? row.rating_status;
        status[key] = (status[key] ?? 0) + 1;
      }
      output({
        high: snapshot.state.cursor_seq,
        status,
        pending: snapshot.pending.count,
        oldestPendingAge:
          snapshot.pending.oldest === null
            ? null
            : Math.max(0, (await databaseTime(db)) - snapshot.pending.oldest),
        held: diff.rebuilt.matches
          .filter((r) => r.rating_status === "held")
          .map((r) => r.match_id),
        counts: diff.counts,
        firstDifference: diff.diffs[0] ?? null,
      });
      if (!values.apply) return Number(diff.diffs.length > 0);
      if (!process.stdin.isTTY)
        throw new Error(
          "Use an interactive terminal to confirm the high-water mark",
        );
      const reader = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const high = snapshot.state.cursor_seq;
      const answer = await reader.question(
        `Enter high-water seq ${high} to publish: `,
      );
      reader.close();
      if (answer !== String(high)) return 1;
      const token = crypto.randomUUID();
      const clock = await databaseTime(db);
      if ((await acquireMaintenance(db, token, high, clock)) === null) return 1;
      const paused = await readRatingSnapshot(db);
      const current = verifyRebuild(paused);
      const start = performance.now();
      await stageRebuild(
        db,
        paused,
        current,
        token,
        () => clock + Math.floor(performance.now() - start),
      );
      await publishRebuild(db, {
        token,
        high,
        now: await databaseTime(db),
        counts: [
          current.rebuilt.matches.length,
          current.rebuilt.seats.length,
          current.rebuilt.players.length,
        ],
      });
      return 0;
    }
    if (command === "inspect-match" || command === "inspect-rating") {
      const result =
        command === "inspect-match"
          ? await inspectMatch(db, target)
          : await inspectRating(db, target, !!values.full);
      output(result);
      return result ? 0 : 1;
    }
    if (command === "verify-replay") {
      const finding = await verifyReplay(db, target);
      output({ matchId: target, finding });
      return Number(finding !== null);
    }
    if (command === "check-consistency") {
      const result = await checkConsistency(db, !values["no-replays"]);
      output(result);
      return Number(!result.clean);
    }
    if (read) {
      const snapshot = await readRatingSnapshot(db);
      const diff = verifyRebuild(snapshot);
      output({
        high: snapshot.state.cursor_seq,
        counts: diff.counts,
        firstDifference: diff.diffs[0] ?? null,
      });
      return Number(diff.diffs.length > 0);
    }
    if (values.username !== undefined) {
      target = await db
        .prepare("SELECT id FROM user WHERE username = ?")
        .bind(values.username.toLowerCase())
        .first("id");
      if (!target) throw new Error("No account with that username");
    }
    if (accountCommands.includes(command) && target === null)
      throw new Error("Account id required");
    const actor = `${identity} · ${run("git", ["config", "user.name"])} <${run("git", ["config", "user.email"])}>`;
    const request = { command, environment, databaseId, target, reason, actor };
    if (!values.apply) {
      output(await planRatingAdmin(db, request));
      return 0;
    }
    let restorePoint;
    if (remote) {
      const checkpoint = JSON.parse(
        wrangler([
          "d1",
          "time-travel",
          "info",
          database,
          "--json",
          "--config",
          configPath,
        ]),
      );
      restorePoint = z.string().min(1).parse(checkpoint.bookmark);
    }
    const result = await applyRatingAdmin(db, request, values.apply, {
      restorePoint,
    });
    output(result);
    if (
      result.outcome === "applied" &&
      [...matchWrites, "rebuild-ratings"].includes(command)
    ) {
      const check = await checkConsistency(db, false);
      output(check);
      return Number(!check.clean);
    }
    return Number(result.outcome !== "applied" && result.outcome !== "noop");
  } finally {
    await proxy.dispose();
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Rating command failed",
  );
  process.exitCode = 2;
}
