import {
  RULES_VERSION,
  applyAction,
  encodeCompactReplay,
  getActingPlayer,
  replayActions,
  serialize,
  summarizeReplay,
  type CompactReplay,
} from "@shaxda/game-engine";
import {
  a2ConformanceActionScripts,
  fullGameActionScripts,
  parseStoredReplay,
} from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { describe, expect, it, vi } from "vitest";
import { maximumReplay } from "../../../../packages/game-engine/src/fixtures/e4-maximum";
import { buildGameStatus } from "$lib/game/status";
import { getReplayAdapter } from "./adapters";
import { buildReplayCue, buildReplayFrames, type ReplayFacts } from "./frames";
import { readReplayPosition, replayPositionUrl } from "./position";

const ready = (replay: CompactReplay) => ({
  kind: "ready" as const,
  rulesV: 1,
  replayV: 1,
  replay,
});

function factsFor(replay: CompactReplay): ReplayFacts {
  const summary = summarizeReplay(replay);
  if (!summary.ok) throw new Error("Invalid test replay");
  const { state } = summary;
  if (state.endReason === null) throw new Error("Test replay is unfinished");
  const status = buildGameStatus(state);
  return {
    actionCount: replay.a.length,
    startingSeat: replay.s,
    winnerSeat: state.winner,
    endReason: state.endReason,
    firstAdvantageSeat: state.firstAdvantage,
    firstAdvantageBy: summary.firstAdvantageBy,
    players: {
      A: {
        piecesLeft: status.players.A.onBoard,
        captured: status.players.A.captured,
      },
      B: {
        piecesLeft: status.players.B.onBoard,
        captured: status.players.B.captured,
      },
    },
  };
}

describe("replay frames", () => {
  it("pins the adapter to v1 rules and replay", () => {
    expect(RULES_VERSION).toBe(1);
    expect(getReplayAdapter(1, 1)).not.toBeNull();
    expect(getReplayAdapter(2, 1)).toBeNull();
    expect(getReplayAdapter(1, 2)).toBeNull();
  });

  it.each(Object.entries(sampleMatchPayloads))(
    "builds every legal position for %s",
    (_, match) => {
      const replay = parseStoredReplay(match.replay);
      const facts = {
        ...match,
        players: { A: match.players[0], B: match.players[1] },
      };
      const result = buildReplayFrames(ready(replay), facts);
      const decoded = summarizeReplay(replay);
      if (!result.ok || !decoded.ok) throw new Error("Invalid sample fixture");
      expect(result.frames).toHaveLength(replay.a.length + 1);
      for (const [position, frame] of result.frames.entries()) {
        const prefix = replayActions(
          replay.s,
          decoded.actions.slice(0, position),
        );
        if (!prefix.ok) throw new Error("Invalid sample prefix");
        expect(serialize(frame.state)).toBe(serialize(prefix.state));
      }
    },
  );

  it("keeps the board on resignation and records the acting seat and phase", () => {
    const replay = parseStoredReplay(sampleMatchPayloads.M2.replay);
    const result = buildReplayFrames(ready(replay), factsFor(replay));
    if (!result.ok) throw new Error(result.reason);
    expect(result.frames[0]?.state.currentPlayer).toBe("B");
    expect(result.frames[4]?.state.board).toEqual(
      result.frames[3]?.state.board,
    );
    expect(result.frames[4]?.cue).toEqual({
      action: { type: "resign", player: "B" },
      jareLines: [],
      firstAdvantage: null,
      phaseEntered: "gameOver",
    });
  });

  it.each(fullGameActionScripts)(
    "replays the $name conformance positions",
    (script) => {
      const { actions, startingPlayer, expectedFinalState } = script;
      const terminalActions =
        expectedFinalState.phase === "gameOver"
          ? actions
          : ([
              ...actions,
              { type: "resign", player: getActingPlayer(expectedFinalState) },
            ] as const);
      const replay = encodeCompactReplay(startingPlayer, terminalActions);
      const result = buildReplayFrames(ready(replay), factsFor(replay));
      if (!result.ok) throw new Error(result.reason);
      for (const [position, frame] of result.frames.entries()) {
        const prefix = replayActions(
          startingPlayer,
          terminalActions.slice(0, position),
        );
        if (!prefix.ok) throw new Error("Invalid conformance prefix");
        expect(serialize(frame.state)).toBe(serialize(prefix.state));
      }
      expect(serialize(result.frames[actions.length]!.state)).toBe(
        serialize(expectedFinalState),
      );
    },
  );

  it("records both lines of a placement jare as one cue", () => {
    const replay: CompactReplay = {
      v: 1,
      s: "A",
      a: [
        "P:O1",
        "P:I1",
        "P:O3",
        "P:I3",
        "P:M2",
        "P:I5",
        "P:I2",
        "P:I7",
        "P:O2",
        "R:B",
      ],
    };
    const result = buildReplayFrames(ready(replay), factsFor(replay));
    if (!result.ok) throw new Error(result.reason);
    expect(result.frames[9]?.cue).toMatchObject({
      jareLines: expect.arrayContaining([
        ["O1", "O2", "O3"],
        ["O2", "M2", "I2"],
      ]),
      firstAdvantage: { seat: "A", by: "placementJare" },
    });
    expect(result.frames[9]?.cue?.jareLines).toHaveLength(2);
  });

  it("records the placement fallback and a space-making actor", () => {
    const codes =
      "I2 I1 I4 I3 I6 I5 I7 I8 M3 M1 M5 M2 M8 M4 O1 M6 O3 M7 O4 O2 O6 O5 O8 O7";
    const replay: CompactReplay = {
      v: 1,
      s: "A",
      a: [...codes.split(" ").map((point) => "P:" + point), "R:A"],
    };
    const result = buildReplayFrames(ready(replay), factsFor(replay));
    if (!result.ok) throw new Error(result.reason);
    expect(result.frames[24]?.cue).toMatchObject({
      jareLines: [],
      firstAdvantage: { seat: "B", by: "noJareFallback" },
      phaseEntered: "initialRemoval",
    });

    const script = a2ConformanceActionScripts.find(
      ({ name }) => name === "blocked-space-making",
    )!;
    const action = script.actions[0];
    const next = applyAction(script.initialState, action);
    if (!next.ok) throw new Error(next.error);
    expect(buildGameStatus(script.initialState)).toMatchObject({
      actingPlayer: "A",
      isSpaceMaking: true,
    });
    expect(
      buildReplayCue(script.initialState, action, next.state),
    ).toMatchObject({ action });
  });

  it("keeps the capture cue before an idle claim and recognizes both removals", () => {
    const replay = parseStoredReplay(sampleMatchPayloads.M3.replay);
    const result = buildReplayFrames(ready(replay), factsFor(replay));
    if (!result.ok) throw new Error(result.reason);
    expect(result.frames[25]?.cue?.action.type).toBe("removeInitial");
    expect(result.frames[26]?.cue?.action.type).toBe("removeInitial");
    expect(result.frames[27]?.cue).toMatchObject({ phaseEntered: "capture" });
    expect(result.frames[27]?.cue?.jareLines).toHaveLength(1);
    expect(result.frames[28]?.state.pendingCapture).toBeNull();
  });

  it("checks versions, malformed and illegal actions, and the final ledger facts", () => {
    const replay = parseStoredReplay(sampleMatchPayloads.M2.replay);
    const data = ready(replay);
    const facts = factsFor(replay);
    expect(buildReplayFrames({ ...data, replayV: 2 }, facts)).toEqual({
      ok: false,
      reason: "unsupportedVersion",
    });
    for (const code of ["Q:O1", "P:O1"]) {
      expect(
        buildReplayFrames(ready({ ...replay, a: ["P:O1", code] }), facts),
      ).toEqual({
        ok: false,
        reason: "illegalAction",
        position: 2,
      });
    }
    for (const [field, change] of Object.entries({
      actionCount: 5,
      startingSeat: "A",
      winnerSeat: "B",
      endReason: "bothBlocked",
      firstAdvantageSeat: "A",
      firstAdvantageBy: "placementJare",
    })) {
      expect(buildReplayFrames(data, { ...facts, [field]: change })).toEqual({
        ok: false,
        reason: "ledgerMismatch",
        field,
      });
    }
    for (const [field, key] of [
      ["piecesLeft", "piecesLeft"],
      ["captured", "captured"],
    ] as const) {
      expect(
        buildReplayFrames(data, {
          ...facts,
          players: { ...facts.players, A: { ...facts.players.A, [key]: 12 } },
        }),
      ).toEqual({ ok: false, reason: "ledgerMismatch", field });
    }
  });

  it("builds the largest replay and seeks without reapplying actions", () => {
    const facts = factsFor(maximumReplay);
    expect(facts.endReason).toBe("opponentBelowThree");
    expect(maximumReplay.a).toHaveLength(1403);
    expect(JSON.stringify(maximumReplay)).toHaveLength(13922);
    const adapter = getReplayAdapter(1, 1)!;
    const applyAction = vi.fn(adapter.applyAction);
    const start = performance.now();
    const result = buildReplayFrames(ready(maximumReplay), facts, {
      ...adapter,
      applyAction,
    });
    expect(performance.now() - start).toBeLessThan(500);
    if (!result.ok) throw new Error(result.reason);
    expect(result.frames).toHaveLength(1404);
    expect(applyAction).toHaveBeenCalledTimes(1403);
    const seekStart = performance.now();
    for (let i = 0; i < 1000; i++)
      expect(result.frames[(i * 97) % 1404]).toBeDefined();
    for (let i = 0; i < 1404; i++) {
      expect(result.frames[i]).toBeDefined();
      expect(result.frames[1403 - i]).toBeDefined();
    }
    expect(performance.now() - seekStart).toBeLessThan(500);
    expect(applyAction).toHaveBeenCalledTimes(1403);
  });
});

describe("replay URL positions", () => {
  it.each([
    ["", 0],
    ["?a=", 0],
    ["?a=0", 0],
    ["?a=007", 7],
    ["?a=34", 20],
    ["?a=2&a=4", 2],
    ["?a=-1", 0],
    ["?a=%2B2", 0],
    ["?a=1.2", 0],
    ["?a=1e3", 0],
    ["?a=jare", 0],
    ["?a=9007199254740992", 0],
    ["?a=3%0A", 0],
    ["?a=%203", 0],
  ])("reads %s as %i", (search, position) => {
    expect(
      readReplayPosition(new URL("https://shaxda.test/match/id" + search), 20),
    ).toBe(position);
  });

  it("normalizes repeated positions and removes zero without changing other parameters", () => {
    const url = new URL(
      "https://shaxda.test/match/id?a=02&ref=history&a=6#board",
    );
    expect(replayPositionUrl(url, 2).search).toBe("?a=2&ref=history");
    expect(replayPositionUrl(url, 0).href).toBe(
      "https://shaxda.test/match/id?ref=history#board",
    );
  });
});
