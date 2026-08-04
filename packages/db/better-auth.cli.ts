import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

// The generator reads metadata only. No D1 call is issued while loading this config.
const generationDatabase = drizzle({} as D1Database);

export const auth = betterAuth({
  baseURL: "http://localhost:5173",
  secret: "schema-generation-only-secret-with-at-least-32-characters",
  database: drizzleAdapter(generationDatabase, {
    provider: "sqlite",
    transaction: false,
  }),
  socialProviders: {
    google: {
      clientId: "schema-generation-client-id",
      clientSecret: "schema-generation-client-secret",
    },
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
});

export default auth;
