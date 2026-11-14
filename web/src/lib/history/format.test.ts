import { describe, expect, it } from "vitest";
import {
  computeStreak,
  formatDuration,
  formatMatchDateTime,
  recentForm,
} from "./format";

describe("history formatting", () => {
  it.each([
    [45_000, "45 il"],
    [182_000, "3 daq 2 il"],
    [3_900_000, "1 s 5 daq"],
  ])("formats a duration of %s ms", (duration, expected) =>
    expect(formatDuration(duration)).toBe(expected),
  );

  it("formats match times in UTC", () => {
    const instant = Date.UTC(2026, 10, 14, 23, 29);
    expect(formatMatchDateTime(instant)).toBe(
      new Intl.DateTimeFormat("so-SO", {
        timeZone: "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(instant),
    );
  });

  it("counts the newest streak and caps a full form window", () => {
    expect(computeStreak([])).toBeNull();
    expect(computeStreak(["draw", "draw", "win", "loss"])).toEqual({
      result: "draw",
      length: 2,
      capped: false,
    });
    expect(computeStreak(Array<"win">(20).fill("win"))).toEqual({
      result: "win",
      length: 20,
      capped: true,
    });
  });

  it("keeps recent results in order with Somali accessible names", () => {
    expect(recentForm(["draw", "win", "loss"])).toEqual([
      { result: "draw", mark: "B", label: "Barbaro" },
      { result: "win", mark: "G", label: "Guul" },
      { result: "loss", mark: "K", label: "Guuldarro" },
    ]);
  });
});
