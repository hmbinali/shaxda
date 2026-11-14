import { execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const environments = {
  local: {
    origin: "http://127.0.0.1:8787",
    database: "shaxda-db",
    config: "wrangler.jsonc",
  },
  preview: {
    origin: "https://shaxda-worker-preview.shaxda.workers.dev",
    database: "shaxda-db-preview",
    config: "wrangler.preview.jsonc",
  },
  production: {
    origin: "https://shaxda.app",
    database: "shaxda-db",
    config: "wrangler.jsonc",
  },
};

const safeRoom = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const safeId = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$/;
const web = fileURLToPath(new URL("../web/", import.meta.url));

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Match operation failed."}\n`,
  );
  process.exitCode = 1;
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2).filter((arg, i) => i !== 0 || arg !== "--"),
    allowPositionals: true,
    options: { database: { type: "string" }, reason: { type: "string" } },
  });
  const [command, roomCode, number] = positionals;
  const environment = Object.hasOwn(environments, values.database)
    ? environments[values.database]
    : null;
  if (!environment)
    throw new Error("Use --database local, preview, or production.");
  const matchNumber = Number(number);
  const reason = values.reason;
  const mutates = command === "retry" || command === "discard";
  if (
    mutates &&
    (positionals.length !== 3 ||
      !safeRoom.test(roomCode ?? "") ||
      !/^[1-9][0-9]*$/.test(number ?? "") ||
      !Number.isSafeInteger(matchNumber))
  ) {
    throw new Error("Supply a valid room code and match number.");
  }
  if (
    command === "discard" &&
    (reason === undefined || !reason.trim() || reason.length > 500)
  ) {
    throw new Error("Discard requires --reason with 1–500 characters.");
  }
  if (
    !mutates &&
    (command !== "list-unsaved" || positionals.length !== 1) &&
    (command !== "verify" ||
      positionals.length !== 2 ||
      !safeId.test(roomCode ?? ""))
  ) {
    throw new Error(
      "Use list-unsaved, retry <room> <matchNumber>, discard <room> <matchNumber>, or verify <matchId>.",
    );
  }
  const locality = values.database === "local" ? "--local" : "--remote";
  process.stdout.write(
    `${environment.origin} · ${environment.database} (${locality})\n`,
  );
  const execute = (query) =>
    wrangler([
      "d1",
      "execute",
      environment.database,
      "--config",
      environment.config,
      locality,
      "--json",
      "--command",
      query,
    ]);
  if (command === "verify") {
    const [match] = JSON.parse(
      execute(`SELECT * FROM match WHERE id = ${sql(roomCode)}`),
    )[0].results;
    if (!match) throw new Error("Match was not found.");
    const players = JSON.parse(
      execute(
        `SELECT seat, user_id, result, pieces_left, captured FROM match_player WHERE match_id = ${sql(roomCode)} ORDER BY seat`,
      ),
    )[0].results;
    await verifyMatch(match, players);
    return;
  }

  const token =
    process.env.MATCH_OPS_TOKEN ??
    (values.database === "local"
      ? "shaxda-local-match-ops-fixture-000000000001"
      : null);
  if (!token)
    throw new Error("Set MATCH_OPS_TOKEN in the operator environment.");
  const call = (pathname, body) =>
    request(new URL(pathname, environment.origin), token, body);
  if (command === "list-unsaved") {
    let after = null;
    do {
      const result = await call(
        after ? `/ops/unsaved?after=${after}` : "/ops/unsaved",
      );
      console.log(JSON.stringify(result));
      after = result.nextAfter;
    } while (after);
    return;
  }

  if (command === "discard" && values.database === "production") {
    const prompt = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      if (
        (await prompt.question(
          `Type ${roomCode} to discard this unsaved match: `,
        )) !== roomCode
      ) {
        throw new Error("Room code did not match.");
      }
    } finally {
      prompt.close();
    }
  }
  const room = await call(`/ops/unsaved?room=${roomCode}`);
  const entry = room.entries.find(
    (candidate) => candidate.matchNumber === matchNumber,
  );
  if (!entry || !safeId.test(entry.matchId))
    throw new Error("No matching unsaved entry.");
  const name = execFileSync("git", ["config", "user.name"], {
    cwd: web,
    encoding: "utf8",
  }).trim();
  const who =
    values.database === "local"
      ? "local"
      : wrangler(["whoami"]).match(/\b[0-9a-f]{32}\b/iu)?.[0];
  if (!name || !who)
    throw new Error("Could not identify the Wrangler operator.");
  const audit = (phase, detail = null) =>
    execute(`
    INSERT INTO match_ops_audit
      (at, actor, command, phase, room_code, room_created_at, match_number, match_id, payload_hash, entry_status, reason, detail)
    VALUES (${Date.now()}, ${sql(`${name} · ${who}`)}, ${sql(command)}, ${sql(phase)}, ${sql(roomCode)},
      ${Number(room.roomCreatedAt)}, ${matchNumber}, ${sql(entry.matchId)}, ${sql(entry.payloadHash)},
      ${sql(entry.stalledReason ?? "pending")}, ${sql(reason ?? null)}, ${sql(detail)})`);
  audit("requested");
  let result;
  try {
    result = await call(`/ops/${command}`, {
      roomCode,
      matchNumber,
      matchId: entry.matchId,
      ...(command === "discard" ? { reason } : {}),
    });
  } catch (error) {
    audit("failed", error instanceof Error ? error.message : "Request failed.");
    throw error;
  }
  audit("done", JSON.stringify(result));
  console.log(JSON.stringify(result));
}

async function verifyMatch(match, players) {
  // Vite resolves the same TypeScript entry points as the game and web Workers.
  const { createServer } =
    await import("../web/node_modules/vite/dist/node/index.js");
  const vite = await createServer({
    configFile: false,
    root: web,
    server: { middlewareMode: true, ws: false, watch: null },
  });
  try {
    const { matchPayloadHash, matchPayloadSchema, parseStoredReplay } =
      await vite.ssrLoadModule("@shaxda/shared");
    const { RULES_VERSION, decodeCompactReplay } = await vite.ssrLoadModule(
      "@shaxda/game-engine",
    );
    const payload = matchPayloadSchema.parse({
      id: match.id,
      roomCode: match.room_code,
      roomCreatedAt: match.room_created_at,
      matchNumber: match.match_number,
      mode: match.mode,
      rated: match.rated,
      consentPolicyV: match.consent_policy_v,
      rulesV: match.rules_v,
      replayV: match.replay_v,
      replay: match.replay,
      startingSeat: match.starting_seat,
      firstAdvantageSeat: match.first_advantage_seat,
      firstAdvantageBy: match.first_advantage_by,
      winnerSeat: match.winner_seat,
      endReason: match.end_reason,
      onlineEndReason: match.online_end_reason,
      actionCount: match.action_count,
      statsV: match.stats_v,
      statsStatus: match.stats_status,
      statsJson: match.stats_json,
      startedAt: match.started_at,
      endedAt: match.ended_at,
      players: players.map((p) => ({
        seat: p.seat,
        userId: p.user_id,
        result: p.result,
        piecesLeft: p.pieces_left,
        captured: p.captured,
      })),
    });
    const decoded =
      payload.rulesV === RULES_VERSION
        ? decodeCompactReplay(parseStoredReplay(payload.replay))
        : null;
    const hash = await matchPayloadHash(payload);
    if (
      !decoded?.ok ||
      decoded.state.phase !== "gameOver" ||
      decoded.state.winner !== payload.winnerSeat ||
      decoded.state.endReason !== payload.endReason ||
      decoded.actions.length !== payload.actionCount ||
      decoded.state.startingPlayer !== payload.startingSeat ||
      hash !== match.payload_hash
    ) {
      throw new Error("Ledger replay or payload hash failed verification.");
    }
    console.log(
      JSON.stringify({
        id: payload.id,
        matchNumber: payload.matchNumber,
        startingSeat: payload.startingSeat,
        payloadHash: hash,
        state: decoded.state,
      }),
    );
  } finally {
    await vite.close();
  }
}

function wrangler(args) {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: web,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sql(value) {
  return value === null
    ? "NULL"
    : `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`;
}

function request(url, token, body) {
  const transport = url.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        timeout: 20_000,
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const result = JSON.parse(text);
            if (response.statusCode < 200 || response.statusCode >= 300) {
              reject(
                new Error(
                  `HTTP ${response.statusCode} ${result.error ?? ""}`.trim(),
                ),
              );
            } else {
              resolve(result);
            }
          } catch {
            reject(
              new Error(
                `Unexpected operator response (HTTP ${response.statusCode}).`,
              ),
            );
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () =>
      req.destroy(new Error("Operator request timed out.")),
    );
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
