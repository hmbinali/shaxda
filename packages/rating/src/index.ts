import { RatingMathError, solveVolatility } from "./solver.ts";

export { RatingMathError } from "./solver.ts";

export class RatingInputError extends Error {
  override name = "RatingInputError";
}

export interface State {
  readonly rating: number;
  readonly rd: number;
  readonly volatility: number;
}

export type Score = 0 | 0.5 | 1;

export interface Game {
  readonly opponent: Pick<State, "rating" | "rd">;
  readonly score: Score;
}

export const DEFAULTS: State = Object.freeze({
  rating: 1500,
  rd: 350,
  volatility: 0.06,
});
export const RATING_ALGORITHM_V = 1;

const SCALE = 173.7178;
const DAY_MS = 86_400_000;
const PROVISIONAL_RD = 110;

function validateState(s: State): void {
  validateRating(s);
  if (!Number.isFinite(s.volatility) || s.volatility <= 0) {
    throw new RatingInputError("Volatility must be finite and positive");
  }
}

function validateRating(s: Pick<State, "rating" | "rd">): void {
  if (!Number.isFinite(s.rating) || !Number.isFinite(s.rd) || s.rd <= 0) {
    throw new RatingInputError(
      "Rating must be finite and RD finite and positive",
    );
  }
}

export function updatePeriod(p: State, games: readonly Game[]): State {
  validateState(p);
  const phi = p.rd / SCALE;
  if (games.length === 0) {
    const rd = SCALE * Math.hypot(phi, p.volatility);
    if (!Number.isFinite(rd)) throw new RatingMathError("Non-finite RD");
    return { ...p, rd };
  }

  let precision = 0;
  let residual = 0;
  for (const { opponent, score } of games) {
    validateRating(opponent);
    if (score !== 0 && score !== 0.5 && score !== 1) {
      throw new RatingInputError("Score must be 0, 0.5, or 1");
    }
    const impact =
      1 / Math.sqrt(1 + 3 * (opponent.rd / (SCALE * Math.PI)) ** 2);
    const expected =
      1 / (1 + Math.exp((-impact * (p.rating - opponent.rating)) / SCALE));
    precision += impact ** 2 * expected * (1 - expected);
    residual += impact * (score - expected);
  }
  const variance = 1 / precision;
  const volatility = solveVolatility(
    phi,
    p.volatility,
    variance,
    variance * residual,
  );
  const postPhi = 1 / Math.sqrt(1 / (phi ** 2 + volatility ** 2) + precision);
  const rating =
    1500 + SCALE * ((p.rating - 1500) / SCALE + postPhi ** 2 * residual);
  const rd = SCALE * postPhi;
  if (
    ![rating, rd, volatility].every(Number.isFinite) ||
    rd <= 0 ||
    volatility <= 0
  ) {
    throw new RatingMathError("Invalid post-event state");
  }
  return { rating, rd, volatility };
}

export function updateMatch(
  a: State,
  b: State,
  scoreA: Score,
): { a: State; b: State } {
  const scoreB = scoreA === 0.5 ? 0.5 : scoreA === 1 ? 0 : 1;
  return {
    a: updatePeriod(a, [{ opponent: b, score: scoreA }]),
    b: updatePeriod(b, [{ opponent: a, score: scoreB }]),
  };
}

export function emptyPeriods(last: number, at: number): number {
  if (!Number.isFinite(last) || !Number.isFinite(at)) {
    throw new RatingInputError("Rating timestamps must be finite");
  }
  return Math.max(0, Math.floor((at - last) / DAY_MS));
}

export function effectiveRd(s: State, last: number, asOf: number): number {
  validateState(s);
  const n = emptyPeriods(last, asOf);
  if (n === 0) return s.rd;
  return Math.min(
    DEFAULTS.rd,
    SCALE * Math.sqrt((s.rd / SCALE) ** 2 + n * s.volatility ** 2),
  );
}

export function isProvisional(s: State, last: number, asOf: number): boolean {
  return effectiveRd(s, last, asOf) > PROVISIONAL_RD;
}

export function eligibleUntil(s: State, last: number): number {
  let low = 0;
  let high = 90;
  while (low < high) {
    const day = Math.floor((low + high) / 2);
    if (isProvisional(s, last, last + day * DAY_MS)) {
      high = day;
    } else {
      low = day + 1;
    }
  }
  return last + low * DAY_MS;
}
