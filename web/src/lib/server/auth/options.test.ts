import { describe, expect, it } from "vitest";
import {
  canonicalAuthOrigin,
  createAuthOptions,
  type AuthEnvironment,
} from "./options";

function environment(baseURL = "https://shaxda.app"): AuthEnvironment {
  return {
    DB: {} as AuthEnvironment["DB"],
    AUTH_BASE_URL: baseURL,
    BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
  };
}

describe("Better Auth options", () => {
  it("configures only Google against the canonical origin", () => {
    const options = createAuthOptions(environment());
    expect(Object.keys(options.socialProviders ?? {})).toEqual(["google"]);
    expect(options.emailAndPassword).toBeUndefined();
    expect(options.baseURL).toBe("https://shaxda.app");
    expect(options.trustedOrigins).toEqual(["https://shaxda.app"]);
    expect(options.advanced?.useSecureCookies).toBe(true);
    expect(options.telemetry).toEqual({ enabled: false });
  });

  it("resolves the client IP from the Cloudflare edge header", () => {
    expect(
      createAuthOptions(environment()).advanced?.ipAddress?.ipAddressHeaders,
    ).toEqual(["cf-connecting-ip"]);
  });

  it("uses non-secure cookies only for an explicit HTTP development origin", () => {
    expect(
      createAuthOptions(environment("http://localhost:5173")).advanced
        ?.useSecureCookies,
    ).toBe(false);
  });

  it.each([
    undefined,
    "",
    "/relative",
    "ftp://example.com",
    "https://example.com/path",
    "https://user:pass@example.com",
  ])("rejects invalid canonical origin %j", (value) => {
    expect(() => canonicalAuthOrigin(value)).toThrow(/AUTH_BASE_URL/);
  });

  it("scrubs the Google name before user creation", async () => {
    const hook =
      createAuthOptions(environment()).databaseHooks?.user?.create?.before;
    const result = await hook?.(
      {
        id: "user-id",
        name: "Private Google Name",
        email: "private@example.test",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );
    if (typeof result !== "object" || result === null || !("data" in result)) {
      throw new Error("Expected the create hook to return scrubbed user data.");
    }
    expect(result.data.name).toMatch(/^pending_[a-f0-9]{24}$/);
  });

  it("drops provider tokens before account creation", async () => {
    const hook =
      createAuthOptions(environment()).databaseHooks?.account?.create?.before;
    const result = await hook?.(
      {
        id: "account-id",
        accountId: "google-subject",
        providerId: "google",
        userId: "user-id",
        accessToken: "access",
        refreshToken: "refresh",
        idToken: "id-token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );
    if (typeof result !== "object" || result === null || !("data" in result)) {
      throw new Error(
        "Expected the create hook to return scrubbed account data.",
      );
    }
    expect(result.data).toMatchObject({
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
  });

  it("prevents generic profile updates from touching protected identity fields", async () => {
    const hook =
      createAuthOptions(environment()).databaseHooks?.user?.update?.before;
    const result = await hook?.(
      {
        name: "Changed",
        email: "changed@example.test",
        image: "https://example.test/image",
        username: "changed",
        usernameChangedAt: new Date(),
        avatarMode: "google",
        emailVerified: false,
      },
      null,
    );
    if (typeof result !== "object" || result === null || !("data" in result)) {
      throw new Error("Expected the update hook to return filtered user data.");
    }
    expect(result.data).toEqual({
      emailVerified: false,
    });
  });
});
