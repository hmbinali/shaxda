import assert from "node:assert/strict";

const day = 86_400_000;
const scale = 173.7178;
const defaults = { rating: 1500, rd: 350, volatility: 0.06 };
const tau = 0.5;
const epsilon = 0.000001;
const cutoff = 110;
const seeds = Array.from({ length: 32 }, (_, i) => 20261114 + i);
const days = 180;
const populations = [20, 50, 100, 300];
const cadences = [
  { name: "sparse", attendance: 0.12 },
  { name: "regular", attendance: 0.25 },
  { name: "busy", attendance: 0.5 },
];

function randomFrom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

function effectiveRd(state, at) {
  const n = Math.max(0, Math.floor((at - state.last) / day));
  return n === 0
    ? state.rd
    : Math.min(
        350,
        scale * Math.sqrt((state.rd / scale) ** 2 + n * state.volatility ** 2),
      );
}

function nextVolatility(phi, volatility, variance, delta) {
  const a = Math.log(volatility ** 2);
  function f(x) {
    const exp = Math.exp(x);
    const denominator = phi ** 2 + variance + exp;
    return (
      (exp * (delta ** 2 - denominator)) / (2 * denominator ** 2) -
      (x - a) / tau ** 2
    );
  }
  let A = a;
  let B = Math.log(delta ** 2 - phi ** 2 - variance);
  if (delta ** 2 <= phi ** 2 + variance) {
    B = a - tau;
    while (f(B) < 0) B -= tau;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; Math.abs(B - A) > epsilon; i++) {
    assert.ok(i < 100, "volatility must converge");
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

function rate(player, games) {
  const mu = (player.rating - 1500) / scale;
  const phi = player.rd / scale;
  let precision = 0;
  let residual = 0;
  for (const { opponent, score } of games) {
    const g = 1 / Math.sqrt(1 + 3 * (opponent.rd / (scale * Math.PI)) ** 2);
    const expected =
      1 / (1 + Math.exp((-g * (player.rating - opponent.rating)) / scale));
    precision += g ** 2 * expected * (1 - expected);
    residual += g * (score - expected);
  }
  const variance = 1 / precision;
  const volatility = nextVolatility(
    phi,
    player.volatility,
    variance,
    variance * residual,
  );
  // The paper's own step 6 also applies inside each played rating period.
  const postPhi = 1 / Math.sqrt(1 / (phi ** 2 + volatility ** 2) + precision);
  const rating = 1500 + scale * (mu + postPhi ** 2 * residual);
  const rd = scale * postPhi;
  assert.ok([rating, rd, volatility].every(Number.isFinite));
  return { rating, rd, volatility };
}

// Glickman's published 2022 test vector and §7.3's inactivity boundaries.
const example = rate({ rating: 1500, rd: 200, volatility: 0.06 }, [
  { opponent: { rating: 1400, rd: 30 }, score: 1 },
  { opponent: { rating: 1550, rd: 100 }, score: 0 },
  { opponent: { rating: 1700, rd: 300 }, score: 0 },
]);
assert.ok(Math.abs(example.rating - 1464.06) < 0.02);
assert.ok(Math.abs(example.rd - 151.52) < 0.02);
assert.ok(Math.abs(example.volatility - 0.059996) < 0.000002);
assert.equal(effectiveRd({ ...defaults, last: 0, rd: 110 }, day - 1), 110);
assert.ok(effectiveRd({ ...defaults, last: 0, rd: 110 }, day) > 110);
assert.equal(effectiveRd({ ...defaults, last: 0 }, 90 * day), 350);

function inPairWindow(entries, at) {
  return entries.filter((earlier) => earlier > at - day && earlier <= at);
}

assert.equal(inPairWindow([0, 1, day, day, day + 1], day).length, 3);

function generateGames(population, attendance, seed) {
  const rand = randomFrom(seed);
  const skill = Array.from(
    { length: population },
    () => 1500 + 200 * (rand() - rand()),
  );
  skill[0] = 1850; // strong player with ordinary attendance
  skill[1] = 1500; // beneficiary
  skill[2] = 1500; // donor
  const games = [];
  for (let date = 0; date < days; date++) {
    const present = skill.map((_, id) => id).filter(() => rand() < attendance);
    for (let i = present.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [present[i], present[j]] = [present[j], present[i]];
    }
    for (let i = 0; i + 1 < present.length; i += 2) {
      const a = present[i];
      const b = present[i + 1];
      for (const hour of [18, 19, 20]) {
        const expected = 1 / (1 + 10 ** ((skill[b] - skill[a]) / 400));
        const draw = Math.min(0.1, 2 * expected, 2 * (1 - expected));
        const value = rand();
        const score = value < draw ? 0.5 : value < expected + draw / 2 ? 1 : 0;
        games.push({ a, b, score, at: (date + hour / 24) * day });
      }
    }
    if (date >= 14 && date <= 84 && (date - 14) % 7 === 0) {
      for (let game = 0; game < 12; game++) {
        // Swap seats each game to exercise the unordered-pair rule.
        games.push({
          a: game % 2 ? 2 : 1,
          b: game % 2 ? 1 : 2,
          score: game % 2 ? 0 : 1,
          at: (date + 21 / 24 + game / 144) * day,
          farming: true,
        });
      }
    }
  }
  return games;
}

function eligible(player, asOf) {
  // Every synthetic account has a current username and no exclusions.
  return (
    player.games >= 10 &&
    asOf - player.last < 90 * day &&
    effectiveRd(player, asOf) <= cutoff
  );
}

assert.equal(
  eligible({ ...defaults, rd: 50, last: 0, games: 10 }, 90 * day),
  false,
);
assert.equal(eligible({ ...defaults, rd: 110, last: 0, games: 10 }, 0), true);
assert.equal(eligible({ ...defaults, rd: 110, last: 0, games: 9 }, 0), false);

function replay(population, games, mode) {
  const states = Array.from({ length: population }, () => ({
    ...defaults,
    games: 0,
    last: 0,
    first: null,
    exit: null,
    exitGames: null,
  }));
  const pairs = new Map();
  let farmingProcessed = 0;
  let cursor = 0;
  const snapshots = {};
  for (const end of [15, 30, 60, 90, 180]) {
    const asOf = end * day;
    while (cursor < games.length && games[cursor].at <= asOf) {
      const { a, b, at, score, farming } = games[cursor++];
      if (farming && mode === "control") continue;
      const key = [Math.min(a, b), Math.max(a, b)].join(":");
      const history = inPairWindow(pairs.get(key) ?? [], at);
      if (mode !== "uncapped" && history.length >= 3) continue;
      pairs.set(key, [...history, at]);
      if (farming) farmingProcessed++;
      const preA = {
        ...states[a],
        rd: states[a].games ? effectiveRd(states[a], at) : defaults.rd,
      };
      const preB = {
        ...states[b],
        rd: states[b].games ? effectiveRd(states[b], at) : defaults.rd,
      };
      const afterA = rate(preA, [{ opponent: preB, score }]);
      const afterB = rate(preB, [{ opponent: preA, score: 1 - score }]);
      for (const [id, after] of [
        [a, afterA],
        [b, afterB],
      ]) {
        const state = states[id];
        Object.assign(state, after);
        state.games++;
        state.last = Math.max(state.last, at);
        state.first ??= at;
        if (state.exit === null && state.rd <= cutoff) {
          state.exit = at;
          state.exitGames = state.games;
        }
      }
    }
    const eligiblePlayers = states.filter((state) => eligible(state, asOf));
    const ranked = (id) => eligible(states[id], asOf);
    snapshots[end] = {
      eligible: eligiblePlayers.length,
      strongRating: states[0].rating,
      strongListed: ranked(0),
      farmerRating: states[1].rating,
      farmerListed: ranked(1),
      farmerAboveStrong:
        ranked(1) && ranked(0) && states[1].rating > states[0].rating,
    };
  }
  return {
    snapshots,
    farmingProcessed,
    regular: states
      .filter((_, id) => id !== 1 && id !== 2)
      .map((state) => ({
        games: state.games,
        exitDays: state.exit === null ? null : (state.exit - state.first) / day,
        exitGames: state.exitGames,
      })),
  };
}

const rounded = (value) => Math.round(value * 100) / 100;
const average = (values) =>
  rounded(values.reduce((sum, value) => sum + value, 0) / values.length);
function quantiles(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return [0.1, 0.5, 0.9].map((p) =>
    rounded(sorted[Math.ceil(sorted.length * p) - 1]),
  );
}

const scenarios = [];
for (const population of populations) {
  for (const { name, attendance } of cadences) {
    const runs = seeds.map((seed) => {
      const games = generateGames(population, attendance, seed);
      return {
        control: replay(population, games, "control"),
        capped: replay(population, games, "capped"),
        uncapped: replay(population, games, "uncapped"),
      };
    });
    for (const run of runs) {
      assert.equal(run.control.farmingProcessed, 0);
      assert.equal(run.uncapped.farmingProcessed, 132);
      assert.ok(run.capped.farmingProcessed <= 33);
    }
    const honest = runs.flatMap((run) => run.capped.regular);
    const exits = honest.filter((state) => state.exitDays !== null);
    const atDays = [15, 30, 60, 90, 180].map((at) => ({
      day: at,
      ...Object.fromEntries(
        ["control", "capped", "uncapped"].map((mode) => {
          const boards = runs.map((run) => run[mode].snapshots[at]);
          return [
            mode,
            {
              eligiblePercent: average(
                boards.map((row) => (100 * row.eligible) / population),
              ),
              emptyBoards: boards.filter((row) => row.eligible === 0).length,
              strongListed: boards.filter((row) => row.strongListed).length,
              strongRating: quantiles(boards.map((row) => row.strongRating)),
              farmerListed: boards.filter((row) => row.farmerListed).length,
              farmerAboveStrong: boards.filter((row) => row.farmerAboveStrong)
                .length,
              farmerRating: quantiles(boards.map((row) => row.farmerRating)),
              farmerGainVsControl: quantiles(
                runs.map(
                  (run) =>
                    run[mode].snapshots[at].farmerRating -
                    run.control.snapshots[at].farmerRating,
                ),
              ),
            },
          ];
        }),
      ),
    }));
    scenarios.push({
      population,
      cadence: name,
      attendance,
      ordinaryParticipants: honest.length,
      reachedByDay180: exits.length,
      ordinaryGames: quantiles(honest.map((row) => row.games)),
      exitDays: quantiles(exits.map((row) => row.exitDays)),
      exitGames: quantiles(exits.map((row) => row.exitGames)),
      cappedFarmingProcessed: quantiles(
        runs.map((run) => run.capped.farmingProcessed),
      ),
      atDays,
    });
  }
}
console.log(
  JSON.stringify(
    { node: process.version, seeds, days, quantiles: [10, 50, 90], scenarios },
    null,
    2,
  ),
);
