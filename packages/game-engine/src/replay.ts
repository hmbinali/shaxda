import { completesJare } from "./jare";
import { applyAction, getActingPlayer } from "./reducer";
import type { ActionError } from "./reducer";
import { createInitialState } from "./state";
import type { GameAction, GameState, PlayerId, PointId } from "./types";

export const RULES_VERSION = 1;
export const REPLAY_VERSION = 1;
export const MAX_REPLAY_ACTIONS = 1_403;

export type CompactReplay = { v: 1; s: PlayerId; a: readonly string[] };
export type FirstAdvantageBy = "placementJare" | "noJareFallback";

const point = "[OMI][1-8]";
const pointAction = new RegExp(`^([PXC]):(${point})$`);
const moveAction = new RegExp(`^M:(${point})>(${point})$`);
export const COMPACT_ACTION_PATTERN = new RegExp(
  `^(?:[PXC]:${point}|M:${point}>${point}|R:[AB])(?![\\s\\S])`,
);
const pointActionTypes = {
  P: "place",
  X: "removeInitial",
  C: "capture",
} as const;

type DecodeError = {
  ok: false;
  error:
    | ActionError
    | "unsupportedVersion"
    | "tooManyActions"
    | "invalidStartingSeat"
    | "invalidActionCode";
  actionIndex: number;
};

export function encodeAction(action: GameAction): string {
  switch (action.type) {
    case "place":
      return `P:${action.point}`;
    case "removeInitial":
      return `X:${action.point}`;
    case "move":
      return `M:${action.from}>${action.to}`;
    case "capture":
      return `C:${action.point}`;
    case "resign":
      return `R:${action.player}`;
  }
}

export function encodeCompactReplay(
  s: PlayerId,
  actions: readonly GameAction[],
): CompactReplay {
  return { v: REPLAY_VERSION, s, a: actions.map(encodeAction) };
}

function decodeAction(code: string, player: PlayerId): GameAction | null {
  if (code === "R:A" || code === "R:B") {
    return { type: "resign", player: code === "R:A" ? "A" : "B" };
  }
  if (!COMPACT_ACTION_PATTERN.test(code)) return null;
  const move = moveAction.exec(code);
  if (move)
    return {
      type: "move",
      player,
      from: move[1] as PointId,
      to: move[2] as PointId,
    };
  const placement = pointAction.exec(code);
  if (!placement) return null;
  return {
    type: pointActionTypes[placement[1] as keyof typeof pointActionTypes],
    player,
    point: placement[2] as PointId,
  };
}

export function summarizeReplay(
  replay: Omit<CompactReplay, "v"> & { v: number },
):
  | DecodeError
  | {
      ok: true;
      actions: GameAction[];
      state: GameState;
      actionCount: number;
      firstAdvantageBy: FirstAdvantageBy | null;
    } {
  if (replay.a.length > MAX_REPLAY_ACTIONS) {
    return {
      ok: false,
      error: "tooManyActions",
      actionIndex: MAX_REPLAY_ACTIONS,
    };
  }
  if (replay.v !== REPLAY_VERSION)
    return { ok: false, error: "unsupportedVersion", actionIndex: 0 };
  if (replay.s !== "A" && replay.s !== "B")
    return { ok: false, error: "invalidStartingSeat", actionIndex: 0 };
  let state = createInitialState(replay.s);
  let firstAdvantageBy: FirstAdvantageBy | null = null;
  const actions: GameAction[] = [];
  for (const [actionIndex, code] of replay.a.entries()) {
    const action = decodeAction(code, getActingPlayer(state));
    if (!action) return { ok: false, error: "invalidActionCode", actionIndex };
    const result = applyAction(state, action);
    if (!result.ok) return { ok: false, error: result.error, actionIndex };
    if (
      action.type === "place" &&
      state.firstAdvantage === null &&
      result.state.firstAdvantage !== null
    ) {
      firstAdvantageBy = completesJare(
        result.state.board,
        action.point,
        action.player,
      )
        ? "placementJare"
        : "noJareFallback";
    }
    actions.push(action);
    state = result.state;
  }
  return {
    ok: true,
    actions,
    state,
    actionCount: actions.length,
    firstAdvantageBy,
  };
}

export function decodeCompactReplay(
  replay: Parameters<typeof summarizeReplay>[0],
) {
  const result = summarizeReplay(replay);
  if (!result.ok) return result;
  return { ok: true as const, actions: result.actions, state: result.state };
}
