import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = mkdtempSync(join(tmpdir(), "shaxda-auth-schema-"));
const generated = join(directory, "schema.generated.ts");

try {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "better-auth",
      "generate",
      "--config",
      "./better-auth.cli.ts",
      "--output",
      generated,
      "--yes",
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const expected = readFileSync(
    new URL("../src/schema.generated.ts", import.meta.url),
    "utf8",
  );
  const actual = readFileSync(generated, "utf8");

  if (actual !== expected) {
    process.stderr.write(
      "Better Auth schema drift detected. Run `pnpm --filter @shaxda/db run schema:generate` and review the result.\n",
    );
    process.exit(1);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
