import { describe, expect, it } from "vitest";
import {
  DEFAULTS,
  effectiveRd,
  eligibleUntil,
  emptyPeriods,
  isProvisional,
  RatingInputError,
  RatingMathError,
  updateMatch,
  updatePeriod,
} from "./index.ts";
import { illinois } from "./solver";

const DAY = 86_400_000;

function nextDouble(x: number): number {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, x);
  bits.setBigUint64(0, bits.getBigUint64(0) + 1n);
  return bits.getFloat64(0);
}

describe("Glicko-2 v1", () => {
  it("pins the paper's three-opponent example", () => {
    const state = updatePeriod({ ...DEFAULTS, rd: 200 }, [
      { opponent: { rating: 1400, rd: 30 }, score: 1 },
      { opponent: { rating: 1550, rd: 100 }, score: 0 },
      { opponent: { rating: 1700, rd: 300 }, score: 0 },
    ]);
    expect(Math.abs(state.rating - 1464.06)).toBeLessThan(0.01);
    expect(Math.abs(state.rd - 151.52)).toBeLessThan(0.01);
    expect(state).toEqual({
      rating: 1464.0506705393013,
      rd: 151.51652412385727,
      volatility: 0.059995984286488495,
    });
  });

  it("rates both seats using the same pre-event state", () => {
    const result = updateMatch(DEFAULTS, DEFAULTS, 1);
    expect(result).toEqual({
      a: {
        rating: 1662.3108939062977,
        rd: 290.31896371798047,
        volatility: 0.05999967537233814,
      },
      b: {
        rating: 1337.6891060937023,
        rd: 290.31896371798047,
        volatility: 0.05999967537233814,
      },
    });
    expect(updateMatch(DEFAULTS, DEFAULTS, 0)).toEqual({
      a: result.b,
      b: result.a,
    });
    expect(updateMatch(DEFAULTS, DEFAULTS, 0.5).a.rating).toBe(1500);
    const a = { ...DEFAULTS, rd: 90 };
    const b = { ...DEFAULTS, rating: 1570, rd: 170 };
    const uneven = updateMatch(a, b, 1);
    expect(updateMatch(b, a, 0)).toEqual({ a: uneven.b, b: uneven.a });
    expect(uneven.a.rating + uneven.b.rating).not.toBe(a.rating + b.rating);
  });

  it("uses the exact-root branch and fails on a nonconverging bracket", () => {
    expect(illinois((x) => x - 0.5, 0, 1)).toBe(0.5);
    const start = 1e10;
    // The root remains between adjacent doubles farther apart than epsilon.
    expect(() =>
      illinois((x) => (x === start ? -1 : 1), start, start + 10),
    ).toThrow("Volatility solver did not converge");
  });

  it("fails explicitly on invalid inputs or unrepresentable calculations", () => {
    expect(() => updateMatch({ ...DEFAULTS, rd: 0 }, DEFAULTS, 1)).toThrow(
      RatingInputError,
    );
    expect(() =>
      updateMatch(DEFAULTS, { ...DEFAULTS, volatility: Number.NaN }, 1),
    ).toThrow(RatingInputError);
    expect(() => updateMatch(DEFAULTS, DEFAULTS, 0.25 as 0)).toThrow(
      RatingInputError,
    );
    expect(() =>
      updateMatch({ ...DEFAULTS, rating: Number.MAX_VALUE }, DEFAULTS, 1),
    ).toThrow(RatingMathError);
  });
});

describe("rating time boundaries", () => {
  it("uses whole empty days with a 350 RD cap", () => {
    const state = { ...DEFAULTS, rd: 110 };
    expect(emptyPeriods(0, DAY - 1)).toBe(0);
    expect(emptyPeriods(0, DAY)).toBe(1);
    expect(emptyPeriods(0, -DAY)).toBe(0);
    expect(effectiveRd(state, 0, DAY - 1)).toBe(state.rd);
    expect(effectiveRd(state, 0, DAY)).toBeGreaterThan(state.rd);
    expect(effectiveRd(state, 0, 9000 * DAY)).toBe(350);
    expect(isProvisional(state, 0, 0)).toBe(false);
    expect(isProvisional({ ...state, rd: nextDouble(110) }, 0, 0)).toBe(true);
  });

  it("uses the first instant when eligibility fails", () => {
    let low = 109;
    let high = 110;
    while (nextDouble(low) < high) {
      const mid = low + (high - low) / 2;
      if (isProvisional({ ...DEFAULTS, rd: mid }, 0, DAY)) high = mid;
      else low = mid;
    }
    expect(effectiveRd({ ...DEFAULTS, rd: low }, 0, DAY)).toBe(110);
    expect(eligibleUntil({ ...DEFAULTS, rd: low }, 0)).toBe(2 * DAY);
    expect(eligibleUntil({ ...DEFAULTS, rd: high }, 0)).toBe(DAY);
    expect(eligibleUntil({ ...DEFAULTS, rd: 111 }, 0)).toBe(0);
    const until = eligibleUntil({ ...DEFAULTS, rd: 45 }, 0);
    expect(until).toBe(90 * DAY);
    expect(until > 90 * DAY - 1).toBe(true);
    expect(until > 90 * DAY).toBe(false);
  });

  it("matches a day-by-day search across starting RDs and volatilities", () => {
    const last = 1780000000123;
    for (const volatility of [0.04, 0.06, 0.07]) {
      for (let rd = 1; rd <= 350; rd += 2) {
        const state = { ...DEFAULTS, rd, volatility };
        let first = 90;
        let previous = rd;
        let monotone = true;
        for (let day = 0; day < 90; day++) {
          const current = effectiveRd(state, last, last + day * DAY);
          if (current > 110 && first === 90) first = day;
          monotone &&= current >= previous;
          previous = current;
        }
        expect(monotone).toBe(true);
        expect(eligibleUntil(state, last)).toBe(last + first * DAY);
      }
    }
  });
});
