import { betterAuth } from "better-auth";
import {
  canonicalAuthOrigin,
  createAuthOptions,
  type AuthEnvironment,
} from "./options";

export type ShaxdaAuth = ReturnType<typeof betterAuth>;

const instances = new WeakMap<
  import("drizzle-orm/d1").AnyD1Database,
  { origin: string; auth: ShaxdaAuth }
>();

export function getAuth(env: AuthEnvironment): ShaxdaAuth {
  const origin = canonicalAuthOrigin(env.AUTH_BASE_URL);
  const cached = instances.get(env.DB);

  if (cached !== undefined) {
    if (cached.origin !== origin) {
      throw new Error(
        "A D1 auth instance cannot be reused with a different AUTH_BASE_URL.",
      );
    }
    return cached.auth;
  }

  const auth = betterAuth(createAuthOptions(env));
  instances.set(env.DB, { origin, auth });
  return auth;
}
