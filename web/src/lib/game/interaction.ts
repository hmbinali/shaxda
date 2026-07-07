import {
  getActingPlayer,
  legalActions,
  type GameAction,
  type GameState,
  type PointId,
} from "@shaxda/game-engine";

export type PointInteractionResult =
  | { type: "apply"; action: GameAction }
  | { type: "select"; selected: PointId }
  | { type: "deselect" }
  | { type: "invalid"; reason: PointInteractionInvalidReason };

export type PointInteractionInvalidReason =
  "gameOver" | "illegalPoint" | "selectMovablePiece" | "illegalMove";

export function mapPointClick(
  state: GameState,
  selected: PointId | null,
  clicked: PointId,
): PointInteractionResult {
  if (state.phase === "gameOver") {
    return { type: "invalid", reason: "gameOver" };
  }

  const actions = legalActions(state);

  if (state.phase === "placement") {
    const action = actions.find(
      (candidate): candidate is Extract<GameAction, { type: "place" }> =>
        candidate.type === "place" && candidate.point === clicked,
    );

    return action === undefined
      ? { type: "invalid", reason: "illegalPoint" }
      : { type: "apply", action };
  }

  if (state.phase === "initialRemoval") {
    const action = actions.find(
      (
        candidate,
      ): candidate is Extract<GameAction, { type: "removeInitial" }> =>
        candidate.type === "removeInitial" && candidate.point === clicked,
    );

    return action === undefined
      ? { type: "invalid", reason: "illegalPoint" }
      : { type: "apply", action };
  }

  if (state.phase === "capture") {
    const action = actions.find(
      (candidate): candidate is Extract<GameAction, { type: "capture" }> =>
        candidate.type === "capture" && candidate.point === clicked,
    );

    return action === undefined
      ? { type: "invalid", reason: "illegalPoint" }
      : { type: "apply", action };
  }

  const moveActions = actions.filter(
    (action): action is Extract<GameAction, { type: "move" }> =>
      action.type === "move",
  );
  const actingPlayer = getActingPlayer(state);

  if (selected !== null) {
    if (clicked === selected) {
      return { type: "deselect" };
    }

    const move = moveActions.find(
      (action) => action.from === selected && action.to === clicked,
    );
    if (move !== undefined) {
      return { type: "apply", action: move };
    }
  }

  if (state.board[clicked] === actingPlayer) {
    return moveActions.some((action) => action.from === clicked)
      ? { type: "select", selected: clicked }
      : { type: "invalid", reason: "selectMovablePiece" };
  }

  return selected === null
    ? { type: "invalid", reason: "selectMovablePiece" }
    : { type: "invalid", reason: "illegalMove" };
}
