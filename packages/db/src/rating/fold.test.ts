import { expect, it } from "vitest";
import { foldLedger, type LedgerEvent } from "./fold";

const DAY = 86_400_000;
const empty = {
  invalidations: new Set<string>(),
  exclusions: new Set<string>(),
};

function game(seq: number, at: number, reversed = false): LedgerEvent {
  return {
    seq,
    id: String(seq),
    ended_at: at,
    mode: "invite",
    rated: 1,
    consent_policy_v: 1,
    rules_v: 1,
    replay_v: 1,
    winner_seat: reversed ? "B" : "A",
    a_id: reversed ? "donor" : "farmer",
    b_id: reversed ? "farmer" : "donor",
    a_result: reversed ? "loss" : "win",
    b_result: reversed ? "win" : "loss",
  };
}

it("replays the E5 weekly 12-game farming bursts with alternating seats", () => {
  const trace = Array.from({ length: 132 }, (_, i) =>
    game(
      i + 1,
      (14 + 7 * Math.floor(i / 12)) * DAY + (i % 12) * 60_000,
      i % 2 === 1,
    ),
  );
  const capped = foldLedger(trace, empty);
  expect(
    capped.matches.filter((m) => m.rating_status === "processed"),
  ).toHaveLength(33);
  expect(
    capped.matches.filter((m) => m.rating_skip_reason === "pairCap"),
  ).toHaveLength(99);
  expect(capped.players.find((p) => p.user_id === "farmer")).toMatchObject({
    rated_games: 33,
    rated_wins: 33,
    best_win_streak: 33,
    form: "WWWWW",
  });
  expect(foldLedger(trace, empty)).toEqual(capped);

  const invalidations = new Set(["2"]);
  const corrected = foldLedger(trace, { ...empty, invalidations });
  expect(corrected.matches[1]?.rating_skip_reason).toBe("invalidated");
  expect(corrected.matches[3]?.rating_status).toBe("processed");
  expect(corrected.seats.some((s) => s.match_id === "2")).toBe(false);
  // The replacement was another identical win in the same rating period.
  expect(corrected.players).toEqual(capped.players);
});

it("uses the exact 24-hour window and ingestion order for ties and late arrivals", () => {
  const rows = [
    game(1, 0),
    game(2, 1),
    game(3, DAY - 1),
    game(4, DAY - 1),
    game(5, DAY),
    game(6, 2),
    game(7, 2, true),
  ];
  const { matches, players } = foldLedger(rows, empty);
  expect(matches.map((m) => m.rating_skip_reason)).toEqual([
    null,
    null,
    null,
    "pairCap",
    null,
    null,
    "pairCap",
  ]);
  expect(players[0]).toMatchObject({
    user_id: "farmer",
    last_rated_at: DAY,
    last_seq: 6,
  });
});

it("validates before friendly decisions and honors operator invalidation before validation", () => {
  const bad = { ...game(1, 0), replay_v: 99 };
  const badFriendly = {
    ...bad,
    seq: 2,
    id: "2",
    rated: 0,
    consent_policy_v: null,
  };
  const draw = {
    ...game(4, 0),
    winner_seat: null,
    a_result: "draw",
    b_result: "draw",
  };
  const rows = [bad, badFriendly, { ...bad, seq: 3, id: "3" }, draw];
  const folded = foldLedger(rows, {
    invalidations: new Set(["3"]),
    exclusions: new Set(["donor"]),
  });
  expect(folded.matches.map((m) => m.rating_status)).toEqual([
    "held",
    "held",
    "skipped",
    "processed",
  ]);
  expect(folded.players).toMatchObject([
    { user_id: "farmer", board_key: 1, rating: 1500, excluded: 0, form: "D" },
    { user_id: "donor", board_key: 2, rating: 1500, excluded: 1, form: "D" },
  ]);
});
