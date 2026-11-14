import { describe, expect, it } from "vitest";
import { deriveStatistics, nextAutomaticAttempt } from "./match-outbox";

describe("match save policy", () => {
  it("backs off until the 77th automatic attempt and never schedules beyond 72 hours", () => {
    const started = 1_000;
    const expectedOffsets = [0, 5_000, 35_000, 155_000, 755_000, 2_555_000];
    let now = started;
    for (let attempt = 1; attempt < 77; attempt++) {
      const next = nextAutomaticAttempt(started, now, attempt);
      expect(next).toBe(
        started +
          (expectedOffsets[attempt] ??
            expectedOffsets[5]! + (attempt - 5) * 3_600_000),
      );
      if (next === null) throw new Error("Retry stalled too early");
      now = next;
    }
    expect(nextAutomaticAttempt(started, now, 77)).toBeNull();
    expect(
      nextAutomaticAttempt(started, started + 72 * 3_600_000, 2),
    ).toBeNull();
  });

  it("contains statistics errors without changing the ledger save path", () => {
    expect(
      deriveStatistics({
        version: 1,
        run() {
          throw new Error("stats unavailable");
        },
      }),
    ).toEqual({
      statsV: 1,
      statsStatus: "error",
      statsJson: null,
    });
  });
});
