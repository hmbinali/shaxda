export class RatingMathError extends Error {
  override name = "RatingMathError";
}

const TAU = 0.5;
const EPSILON = 0.000001;
const MAX_ITERATIONS = 100;

export function illinois(
  f: (x: number) => number,
  a: number,
  b: number,
): number {
  let fa = f(a);
  let fb = f(b);
  for (let i = 0; Math.abs(b - a) > EPSILON; i++) {
    if (i >= MAX_ITERATIONS) {
      throw new RatingMathError("Volatility solver did not converge");
    }
    const c = a + ((a - b) * fa) / (fb - fa);
    const fc = f(c);
    if (!Number.isFinite(c) || !Number.isFinite(fc)) {
      throw new RatingMathError("Non-finite volatility iteration");
    }
    if (fc * fb <= 0) {
      a = b;
      fa = fb;
    } else {
      fa /= 2;
    }
    b = c;
    fb = fc;
  }
  return a;
}

export function solveVolatility(
  phi: number,
  volatility: number,
  variance: number,
  delta: number,
): number {
  const a = Math.log(volatility ** 2);
  const sum = phi ** 2 + variance;
  const deltaSquared = delta ** 2;
  if (![a, sum, deltaSquared].every(Number.isFinite)) {
    throw new RatingMathError("Non-finite volatility input");
  }
  function f(x: number): number {
    const exp = Math.exp(x);
    const denominator = sum + exp;
    return (
      (exp * (deltaSquared - denominator)) / (2 * denominator ** 2) -
      (x - a) / TAU ** 2
    );
  }

  let b: number;
  if (deltaSquared > sum) {
    b = Math.log(deltaSquared - sum);
  } else {
    b = a - TAU;
    for (let i = 1; f(b) < 0; i++) {
      if (i >= MAX_ITERATIONS) {
        throw new RatingMathError("Could not bracket volatility");
      }
      b = a - (i + 1) * TAU;
    }
  }
  return Math.exp(illinois(f, a, b) / 2);
}
