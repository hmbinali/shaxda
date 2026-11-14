import {
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  constants,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getPlatformProxy } from "wrangler";
import { z } from "zod";
import { countDeletions, exportDeletions, replayDeletions } from "@shaxda/db";

const commands = z.enum(["counts", "export-deletions", "replay-deletions"]);
const databases = z.enum(["local", "preview", "production"]);
const millis = z.number().int().nonnegative();
const exportSchema = z
  .strictObject({
    version: z.literal(1),
    database: databases,
    records: z.array(
      z.strictObject({
        id: z.string().min(1),
        deletion_requested_at: millis,
        deletion_due_at: millis,
        deleted_at: millis.nullable(),
      }),
    ),
  })
  .refine(
    ({ records }) =>
      new Set(records.map(({ id }) => id)).size === records.length &&
      records.every(
        ({
          deletion_requested_at: requested,
          deletion_due_at: due,
          deleted_at: final,
        }) => due > requested && (final === null || final >= due),
      ),
  );
const file = (relative) => fileURLToPath(new URL(relative, import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const input = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    allowPositionals: true,
    options: {
      database: { type: "string" },
      file: { type: "string" },
      "time-travel": { type: "string" },
      "confirm-database": { type: "string" },
    },
  });
  const command = commands.parse(input.positionals[0]);
  const target = databases.parse(input.values.database);
  const remote = target !== "local";
  const database = target === "preview" ? "shaxda-db-preview" : "shaxda-db";
  const configPath = file(`./rating-admin/wrangler.${target}.jsonc`);
  const exportPath = input.values.file;
  const bookmark = input.values["time-travel"];
  if (
    input.positionals.length !== 1 ||
    (command !== "counts" && !exportPath) ||
    (bookmark && (!remote || command !== "replay-deletions")) ||
    (remote &&
      command === "replay-deletions" &&
      input.values["confirm-database"] !== database)
  )
    throw new Error("Invalid deletion operation arguments.");

  let saved;
  if (command === "replay-deletions") {
    const descriptor = openSync(
      exportPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const status = fstatSync(descriptor);
      if (!status.isFile() || (status.mode & 0o077) !== 0)
        throw new Error("Private export file required.");
      saved = exportSchema.parse(JSON.parse(readFileSync(descriptor, "utf8")));
    } finally {
      closeSync(descriptor);
    }
    if (bookmark && saved.database !== target)
      throw new Error(
        "Time Travel requires an export from the target database.",
      );
    if (bookmark)
      execFileSync(
        "pnpm",
        [
          "exec",
          "wrangler",
          "d1",
          "time-travel",
          "restore",
          database,
          "--config",
          configPath,
          "--bookmark",
          bookmark,
        ],
        { stdio: "inherit" },
      );
  }

  const proxy = await getPlatformProxy({
    configPath,
    envFiles: ["bindings.env"],
    remoteBindings: remote,
    persist: remote ? false : { path: file("../web/.wrangler/state/v3") },
  });
  try {
    const { DB: db } = proxy.env;
    if (command === "counts") {
      console.log(JSON.stringify(await countDeletions(db, Date.now())));
    } else if (command === "export-deletions") {
      const records = await exportDeletions(db);
      writeFileSync(
        exportPath,
        JSON.stringify({ version: 1, database: target, records }),
        {
          mode: 0o600,
          flag: "wx",
        },
      );
      console.log(JSON.stringify({ exported: records.length }));
    } else {
      const result = await replayDeletions(db, saved.records, Date.now());
      if (bookmark) unlinkSync(exportPath);
      console.log(JSON.stringify(result));
    }
  } finally {
    await proxy.dispose();
  }
}

main().catch(() => {
  console.error(
    "Account deletion operation failed. Verify the database, arguments, private export, and Wrangler access.",
  );
  process.exitCode = 1;
});
