import { execFileSync } from "node:child_process";

export function ledgerQuery<T>(sql: string): T[] {
  const output = execFileSync(
    "pnpm",
    [
      "--filter",
      "@shaxda/web",
      "exec",
      "wrangler",
      "d1",
      "execute",
      "shaxda-db-e2e",
      "--config",
      "wrangler.e2e.jsonc",
      "--local",
      "--persist-to",
      "../test-results/wrangler-e2e",
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(output)[0].results;
}

export function inviteRoomCode(link: string): string {
  const code = new URL(link).searchParams.get("room");
  if (!code || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
    throw new Error("Expected a valid invite code.");
  }
  return code;
}
