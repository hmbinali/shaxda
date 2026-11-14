import {
  completedJareLines,
  formsNewJare,
  type FirstAdvantageBy,
  type GameAction,
  type GameEndReason,
  type GameState,
  type JareLine,
  type Phase,
  type PlayerId,
} from "@shaxda/game-engine";
import { buildGameStatus } from "$lib/game/status";
import { getReplayAdapter } from "./adapters";
import type { MatchReplayData } from "./data";

export type ReplayCue = {
  action: GameAction;
  jareLines: readonly JareLine[];
  firstAdvantage: { seat: PlayerId; by: FirstAdvantageBy } | null;
  phaseEntered: Phase | null;
};

export type ReplayFrame = { state: GameState; cue: ReplayCue | null };

export type ReplayFacts = {
  actionCount: number;
  startingSeat: PlayerId;
  winnerSeat: PlayerId | null;
  endReason: GameEndReason;
  firstAdvantageSeat: PlayerId | null;
  firstAdvantageBy: FirstAdvantageBy | null;
  players: Record<PlayerId, { piecesLeft: number; captured: number }>;
};

export function buildReplayCue(
  before: GameState,
  action: GameAction,
  after: GameState,
): ReplayCue {
  const point =
    action.type === "place"
      ? action.point
      : action.type === "move"
        ? action.to
        : null;
  const jareLines =
    point && formsNewJare(before.board, after.board, point, action.player)
      ? completedJareLines(after.board, point, action.player).filter(
          (line) => !line.every((id) => before.board[id] === action.player),
        )
      : [];
  const firstAdvantage =
    before.firstAdvantage === null && after.firstAdvantage !== null
      ? {
          seat: after.firstAdvantage,
          by: jareLines.length
            ? ("placementJare" as const)
            : ("noJareFallback" as const),
        }
      : null;
  return {
    action,
    jareLines,
    firstAdvantage,
    phaseEntered: before.phase !== after.phase ? after.phase : null,
  };
}

export function buildReplayFrames(
  data: Extract<MatchReplayData, { kind: "ready" }>,
  facts: ReplayFacts,
  adapter = getReplayAdapter(data.rulesV, data.replayV),
):
  | { ok: true; frames: readonly ReplayFrame[] }
  | { ok: false; reason: "unsupportedVersion" }
  | { ok: false; reason: "illegalAction"; position: number }
  | { ok: false; reason: "ledgerMismatch"; field: string } {
  if (adapter === null) return { ok: false, reason: "unsupportedVersion" };
  const decoded = adapter.decodeCompactReplay(data.replay);
  if (!decoded.ok) {
    return {
      ok: false,
      reason: "illegalAction",
      position: decoded.actionIndex + 1,
    };
  }

  let state = adapter.createInitialState(data.replay.s);
  let firstAdvantageBy: FirstAdvantageBy | null = null;
  const frames: ReplayFrame[] = [{ state, cue: null }];
  for (const action of decoded.actions) {
    const result = adapter.applyAction(state, action);
    if (!result.ok)
      return { ok: false, reason: "illegalAction", position: frames.length };
    const cue = buildReplayCue(state, action, result.state);
    firstAdvantageBy = cue.firstAdvantage?.by ?? firstAdvantageBy;
    state = result.state;
    frames.push({ state, cue });
  }

  const status = buildGameStatus(state);
  const checks = {
    finalState: adapter.serialize(state) === adapter.serialize(decoded.state),
    actionCount: frames.length === facts.actionCount + 1,
    startingSeat: data.replay.s === facts.startingSeat,
    winnerSeat: state.winner === facts.winnerSeat,
    endReason:
      state.endReason === facts.endReason && state.phase === "gameOver",
    firstAdvantageSeat: state.firstAdvantage === facts.firstAdvantageSeat,
    firstAdvantageBy: firstAdvantageBy === facts.firstAdvantageBy,
    piecesLeft:
      status.players.A.onBoard === facts.players.A.piecesLeft &&
      status.players.B.onBoard === facts.players.B.piecesLeft,
    captured:
      status.players.A.captured === facts.players.A.captured &&
      status.players.B.captured === facts.players.B.captured,
  };
  const failure = Object.entries(checks).find(([, valid]) => !valid);
  return failure
    ? { ok: false, reason: "ledgerMismatch", field: failure[0] }
    : { ok: true, frames };
}
