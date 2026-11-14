import { RULES_VERSION, summarizeReplay } from "@shaxda/game-engine";
import type { PlayerId } from "@shaxda/game-engine";
import { matchPayloadSchema } from "./match";
import type { MatchPayload } from "./match";

// Legal engine playouts for a board win, a claim during capture, and an
// 80-turn draw. Keep the compact scripts as fixtures instead of searching
// for these rare endings when a package imports the ledger fixtures.
const m1 =
  "P:O6 P:M6 P:M2 P:O4 P:I3 P:O2 P:M3 P:M5 P:I2 P:M1 P:O5 P:M4 P:O8 P:O7 P:M7 P:O1 P:I7 " +
  "P:I4 P:I5 P:O3 P:M8 P:I6 P:I8 P:I1 X:I2 X:M1 M:I1>I2 M:M8>M1 C:I2 M:I3>I2 M:I4>I3 " +
  "M:M1>M8 C:I3 M:M4>I4 M:I2>I1 C:O7 M:I4>I3 M:M8>M1 C:M5 M:I3>I2 M:M1>M8 C:O4 M:M6>M5 " +
  "M:M3>M4 M:I2>I3 M:O6>M6 M:I3>I2 M:M8>M1 M:O3>O4 M:M4>M3 C:I2 M:O2>O3 M:M6>O6 M:O4>M4 " +
  "M:O6>O7 M:O3>O4 M:I8>M8 C:O4 M:M4>O4 M:M7>M6 M:O1>O2 M:M8>I8 C:O2 M:O4>M4 M:O5>O4 " +
  "M:M4>I4 M:M1>M8 C:M5";
const m3 =
  "P:O7 P:O4 P:O2 P:I7 P:O1 P:I4 P:M6 P:I2 P:I1 P:I3 P:O8 P:I8 P:M1 P:O3 P:M4 P:M8 P:M3 " +
  "P:M5 P:I5 P:M2 P:M7 P:O6 P:I6 P:O5 X:I3 X:O1 M:O2>O1 R:A";
const m5 =
  "P:O8 P:I2 P:O4 P:O5 P:O1 P:M2 P:O6 P:M1 P:I5 P:O3 P:I8 P:O7 P:M4 P:I4 P:I3 P:M7 P:M5 " +
  "P:M8 P:I1 P:I7 P:I6 P:M6 P:M3 P:O2 X:M3 X:M7 M:M8>M7 M:O8>M8 M:O7>O8 M:O6>O7 M:O5>O6 " +
  "M:M4>M3 M:I4>M4 M:O4>O5 M:M4>I4 M:O5>O4 M:O6>O5 M:M5>M4 M:M6>O6 M:M4>M5 M:M7>M6 M:M8>M7 " +
  "M:M1>M8 M:O4>M4 C:M2 M:O2>M2 M:M4>O4 M:M2>M1 M:O4>M4 C:I7 M:M1>M2 M:M4>O4 M:M2>M1 " +
  "M:O1>O2 M:M1>M2 M:M3>M4 M:M2>M1 M:O2>O1 M:O3>O2 M:I8>I7 C:I4 M:M1>M2 C:O1 M:I1>I8 " +
  "M:M2>M1 M:I5>I4 C:M8 M:M1>M8 M:I6>I5 C:O6 M:M6>I6 M:O4>O3 M:O8>O1 M:M7>M6 M:M8>O8 " +
  "M:M6>O6 M:I2>M2 M:I8>I1 M:O5>O4 M:M5>M6 M:M2>M3 M:M4>M5 M:O2>M2 M:I1>I2 M:M2>O2 M:I7>I8 " +
  "M:M3>M4 M:I8>I7 M:M4>M3 M:I2>M2 M:O4>O5 M:M5>M4 M:O5>O4 M:M2>I2 M:M3>M2 M:M4>M3 M:O8>M8 " +
  "M:I7>I8 M:I6>I7 M:M6>I6 M:O4>O5 M:O7>O8 M:M2>M1 M:I2>M2 M:O5>O4 M:M3>M4 M:M8>M7 M:O8>O7 " +
  "M:O1>O8 M:I6>M6 M:I7>I6 M:I3>I2 M:O4>O5 M:M4>M5 M:O2>O1 M:M2>O2 M:M1>M2 M:I4>I3 M:M2>M3 " +
  "M:M5>M4 M:M7>M8 M:M6>M7 M:M3>M2 M:I5>I4 M:I6>I5 M:I2>I1 M:I5>I6 M:I8>I7 M:M2>M3 M:I3>I2 " +
  "M:M8>M1 M:I1>I8 M:M1>M2 M:M4>O4 M:M2>M1 M:M7>M6 M:M3>M4 M:M6>M7 M:M4>M5 M:M7>M6 M:I6>I5 " +
  "M:I8>M8 M:M1>M2 M:I2>I1 M:M2>M1 M:M6>I6 M:M5>M6 M:M8>M7 M:M1>M8 M:I1>I8";

function sample(
  id: string,
  startingSeat: PlayerId,
  codes: string,
  onlineEndReason: MatchPayload["onlineEndReason"] = null,
  matchNumber = 1,
): MatchPayload {
  const replay = { v: 1 as const, s: startingSeat, a: codes.split(" ") };
  const summary = summarizeReplay(replay);
  if (!summary.ok || summary.state.phase !== "gameOver") {
    throw new Error(`Invalid sample ledger replay ${id}.`);
  }
  const { state } = summary;
  const player = <Seat extends PlayerId>(seat: Seat) => ({
    seat,
    userId: `sample-account-${seat.toLowerCase()}`,
    result:
      state.winner === null ? "draw" : state.winner === seat ? "win" : "loss",
    piecesLeft: Object.values(state.board).filter((piece) => piece === seat)
      .length,
    captured: state.players[seat].captured,
  });
  return matchPayloadSchema.parse({
    id: id.padStart(20, "A"),
    roomCode: "ABCDEFGH",
    roomCreatedAt: id === "3" || id === "6" ? 1_000 : Number(id) * 1_000,
    matchNumber,
    mode: "invite",
    rated: 0,
    consentPolicyV: null,
    rulesV: RULES_VERSION,
    replayV: replay.v,
    replay: JSON.stringify(replay),
    startingSeat,
    firstAdvantageSeat: state.firstAdvantage,
    firstAdvantageBy: summary.firstAdvantageBy,
    winnerSeat: state.winner,
    endReason: state.endReason,
    onlineEndReason,
    actionCount: summary.actionCount,
    statsV: null,
    statsStatus: "none",
    statsJson: null,
    startedAt: matchNumber * 1_000,
    endedAt: matchNumber * 1_000 + summary.actionCount,
    players: [player("A"), player("B")],
  });
}

export const sampleMatchPayloads = {
  M1: sample("2", "A", m1),
  M2: sample("3", "B", "P:O1 P:M1 P:I1 R:B"),
  M3: sample("4", "A", m3, "idle"),
  M5: sample("5", "A", m5),
  M9: sample("6", "A", "P:O1 P:M1 P:I1 R:A", null, 2),
};
