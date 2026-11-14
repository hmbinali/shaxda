import { describe, expect, it } from "vitest";
import {
  PAIR_CAP,
  PAIR_CAP_WINDOW_MS,
  RATING_POLICY_V,
  ratingSkipReason,
  writesLedgerRow,
} from "./rated-play";

describe("rating policy v1", () => {
  const endedAt = 100_000_000;
  const two = [endedAt - 2, endedAt - 1];
  const cutoff = endedAt - 86_400_000;

  it("pins the version, window, and cap", () => {
    expect([RATING_POLICY_V, PAIR_CAP_WINDOW_MS, PAIR_CAP]).toEqual([
      1, 86_400_000, 3,
    ]);
  });

  it.each([
    [false, true, two, "invalidated"],
    [true, true, [...two, endedAt], "invalidated"],
    [false, false, [...two, endedAt], "friendly"],
    [true, false, two, null],
    [true, false, [...two, endedAt], "pairCap"],
    [true, false, [...two, cutoff], null],
    [true, false, [...two, cutoff + 1], "pairCap"],
    [true, false, [...two, cutoff - 1, endedAt + 1], null],
    [true, false, [...two, cutoff, endedAt + 1, endedAt], "pairCap"],
  ] as const)("%s / %s / %j → %s", (rated, invalidated, ends, decision) => {
    expect(
      ratingSkipReason({
        rated,
        invalidated,
        endedAt,
        pairProcessedEndedAt: ends,
      }),
    ).toBe(decision);
  });
});

describe("ledger eligibility", () => {
  it.each(["action", "claim", null] as const)("for %s", (endedBy) => {
    const seatKinds = ["account", "guest", undefined] as const;
    for (const A of seatKinds) {
      for (const B of seatKinds) {
        for (const playBegan of [true, false]) {
          expect(
            writesLedgerRow({ seatKinds: { A, B }, playBegan, endedBy }),
          ).toBe(
            A === "account" && B === "account" && playBegan && endedBy !== null,
          );
        }
      }
    }
  });
});
