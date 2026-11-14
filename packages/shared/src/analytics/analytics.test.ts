import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { activeBeaconSchema, clientEventSchema } from "./events";
import { analyticsHash } from "./hash";

describe("analytics contracts", () => {
  it("uses stable, domain-separated HMAC-SHA-256 in base64url", async () => {
    const salt = "a".repeat(32);
    const value = "fixture";
    const expected = createHmac("sha256", salt)
      .update("guest:fixture")
      .digest("base64url");
    expect(expected).toMatch(/^[\w-]{43}$/);
    await expect(analyticsHash(salt, "guest", value)).resolves.toBe(expected);
    await expect(analyticsHash(salt, "account", value)).resolves.not.toBe(
      expected,
    );
    await expect(
      analyticsHash("b".repeat(32), "guest", value),
    ).resolves.not.toBe(expected);
    await expect(analyticsHash("short", "guest", value)).rejects.toThrow();
  });

  it("accepts only v1 beacons and allowlisted local counters", () => {
    expect(
      activeBeaconSchema.safeParse({ v: 1, guestId: "fixture-id" }).success,
    ).toBe(true);
    for (const body of [
      { v: 2, guestId: "fixture-id" },
      { v: 1, guestId: "short" },
      { v: 1, guestId: "fixture-id", userId: "other-id" },
    ]) {
      expect(activeBeaconSchema.safeParse(body).success).toBe(false);
    }
    expect(
      clientEventSchema.safeParse({ v: 1, event: "local_completed" }).success,
    ).toBe(true);
    for (const event of [
      "active_accounts_1d",
      "online_started_invite_guest",
      "local_unknown",
    ]) {
      expect(clientEventSchema.safeParse({ v: 1, event }).success).toBe(false);
    }
  });
});
