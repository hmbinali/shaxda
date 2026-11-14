import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  activeBeaconSchema,
  clientEventSchema,
  onlineCounterNameSchema,
} from "./events";
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

  it("matches the P13 names and rejects other events", () => {
    const kinds = ["guest", "account"];
    const modes = ["invite", "quick"];
    const waits = [10, 20, 30, 60, 90, 120, 180, 300];
    expect(new Set(onlineCounterNameSchema.options)).toEqual(
      new Set([
        ...["created", "joined"].flatMap((event) =>
          kinds.map((kind) => `online_room_${event}_${kind}`),
        ),
        ...["started", "completed"].flatMap((event) =>
          modes.flatMap((mode) =>
            kinds.map((kind) => `online_${event}_${mode}_${kind}`),
          ),
        ),
        ...[
          "joined",
          "paired",
          "started",
          "completed",
          "no_show",
          "cooldown_started",
        ].map((event) => `queue_${event}`),
        ...waits.map((seconds) => `queue_wait_lt${seconds}s`),
        "queue_wait_ge300s",
      ]),
    );
    for (const event of [
      "local_started",
      "saved_rated",
      "queue_wait_lt15s",
      "online_started_guest",
    ]) {
      expect(onlineCounterNameSchema.safeParse(event).success).toBe(false);
    }
  });
});
