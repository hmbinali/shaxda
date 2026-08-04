import { getRequestEvent } from "$app/server";
import * as schema from "@shaxda/db";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import type { BetterAuthOptions } from "better-auth";

export type AuthEnvironment = {
  DB: AnyD1Database;
  AUTH_BASE_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export function canonicalAuthOrigin(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) {
    throw new Error("AUTH_BASE_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("AUTH_BASE_URL must be an absolute HTTP(S) origin.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("AUTH_BASE_URL must be an absolute HTTP(S) origin.");
  }

  return url.origin;
}

function requireSecret(value: string | undefined, name: string): string {
  const secret = value?.trim();
  if (!secret) throw new Error(`${name} is required.`);
  return secret;
}

function pendingName(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `pending_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// Google supplies Better Auth's required `name`, but Shaxda never stores that
// full name. The create hook replaces it with a non-identifying placeholder;
// username confirmation later updates `name` and `username` together.
export function createAuthOptions(env: AuthEnvironment): BetterAuthOptions {
  const baseURL = canonicalAuthOrigin(env.AUTH_BASE_URL);

  return {
    baseURL,
    secret: requireSecret(env.BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET"),
    trustedOrigins: [baseURL],
    database: drizzleAdapter(drizzle(env.DB), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    socialProviders: {
      google: {
        clientId: requireSecret(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID"),
        clientSecret: requireSecret(
          env.GOOGLE_CLIENT_SECRET,
          "GOOGLE_CLIENT_SECRET",
        ),
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    user: {
      additionalFields: {
        username: {
          type: "string",
          required: false,
          input: false,
          returned: true,
        },
        usernameChangedAt: {
          type: "date",
          required: false,
          input: false,
          returned: false,
        },
        avatarMode: {
          type: "string",
          required: false,
          defaultValue: "initial",
          input: false,
          returned: true,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, name: pendingName() },
          }),
        },
        update: {
          before: async (user) => {
            const safe = { ...user };
            for (const field of [
              "name",
              "email",
              "image",
              "username",
              "usernameChangedAt",
              "avatarMode",
            ]) {
              delete safe[field];
            }
            return { data: safe };
          },
        },
      },
      account: {
        create: {
          before: async (account) => ({
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
            },
          }),
        },
      },
    },
    advanced: {
      useSecureCookies: baseURL.startsWith("https://"),
    },
    telemetry: { enabled: false },
    plugins: [sveltekitCookies(getRequestEvent)],
  };
}
