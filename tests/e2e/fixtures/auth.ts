import { createHmac, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { BrowserContext } from "@playwright/test";

export const E2E_AUTH_SECRET =
  "shaxda-e2e-only-secret-48-characters-long-000000";

export type SeededAccount = {
  id: string;
  email: string;
  username: string | null;
  token: string;
  cleanup(): void;
};

export async function seedAccount(
  context: BrowserContext,
  options: { complete?: boolean; alias?: string } = {},
): Promise<SeededAccount> {
  const prefix = `e2e_${randomBytes(4).toString("hex")}`;
  const id = `${prefix}_user`;
  const email = `${prefix}@example.test`;
  const username = options.complete === false ? null : `${prefix}_player`;
  const token = `${prefix}_session_token`;
  const now = Date.now();
  const expires = now + 24 * 60 * 60 * 1_000;
  const statements = [
    `INSERT INTO user (id,name,email,email_verified,created_at,updated_at,username,username_changed_at,avatar_mode) VALUES (${sql(id)},${sql(username ?? `pending_${prefix}`)},${sql(email)},1,${now},${now},${sql(username)},${username === null ? "NULL" : now},'initial')`,
    `INSERT INTO session (id,expires_at,token,created_at,updated_at,user_id) VALUES (${sql(`${prefix}_session`)},${expires},${sql(token)},${now},${now},${sql(id)})`,
  ];
  if (username !== null) {
    statements.push(
      `INSERT INTO username_claim (username,user_id,claimed_at,released_at) VALUES (${sql(username)},${sql(id)},${now},NULL)`,
    );
  }
  if (options.alias && username !== null) {
    statements.push(
      `INSERT INTO username_claim (username,user_id,claimed_at,released_at) VALUES (${sql(options.alias)},${sql(id)},${now - 1},${now})`,
    );
  }
  execute(statements.join(";"));

  const signature = createHmac("sha256", E2E_AUTH_SECRET)
    .update(token)
    .digest("base64");
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: `${token}.${signature}`,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(expires / 1_000),
    },
  ]);

  return {
    id,
    email,
    username,
    token,
    cleanup() {
      execute(
        `DELETE FROM session WHERE user_id=${sql(id)};DELETE FROM username_claim WHERE user_id=${sql(id)};DELETE FROM account WHERE user_id=${sql(id)};DELETE FROM user WHERE id=${sql(id)}`,
      );
    },
  };
}

function execute(command: string): void {
  execFileSync(
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
      "../test-results/wrangler-web-e2e",
      "--command",
      command,
    ],
    { stdio: "pipe" },
  );
}

function sql(value: string | null): string {
  return value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
}
