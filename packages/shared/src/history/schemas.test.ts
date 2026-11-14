import { describe, expect, it } from "vitest";
import {
  encodeHistoryCursor,
  historyFilterSchema,
  parseHistoryCursor,
} from "./schemas";

const matchId = "A".repeat(20);

describe("history parameters", () => {
  it("accepts the six filters and falls back to all", () => {
    for (const filter of [
      "all",
      "wins",
      "losses",
      "draws",
      "rated",
      "friendly",
    ]) {
      expect(historyFilterSchema.parse(filter)).toBe(filter);
    }
    expect(historyFilterSchema.parse("WIN")).toBe("all");
    expect(historyFilterSchema.parse(null)).toBe("all");
  });

  it.each([0, 1_794_585_600_000, Number.MAX_SAFE_INTEGER])(
    "round trips timestamp %s",
    (endedAt) => {
      const cursor = { endedAt, matchId };
      const token = encodeHistoryCursor(cursor);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(parseHistoryCursor(token)).toEqual(cursor);
    },
  );

  it.each([
    `-1:${matchId}`,
    `1.5:${matchId}`,
    `1e2:${matchId}`,
    `01:${matchId}`,
    `9007199254740992:${matchId}`,
    `1:${matchId}:A`,
    ...["a", "0", "1", "I", "O"].map((bad) => `1:${matchId.slice(1)}${bad}`),
    `1:${matchId.slice(1)}`,
    `1:${matchId}A`,
  ])("treats an invalid cursor %s as page one", (plain) => {
    expect(parseHistoryCursor(btoa(plain).replace(/=+$/, ""))).toBeNull();
  });

  it.each([null, "", "not base64", "X".repeat(51), "X".repeat(29)])(
    "defaults for malformed token %s",
    (value) => expect(parseHistoryCursor(value)).toBeNull(),
  );
});
