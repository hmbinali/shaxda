import {
  applyAction,
  legalActions,
  serialize,
  type GameAction,
  type GameState,
} from "@shaxda/game-engine";

export function inferOpponentAction(
  previousState: GameState,
  nextState: GameState,
  candidates: readonly GameAction[] = legalActions(previousState),
): GameAction | null {
  const serializedNextState = serialize(nextState);
  let match: GameAction | null = null;

  for (const action of candidates) {
    const result = applyAction(previousState, action);

    if (!result.ok || serialize(result.state) !== serializedNextState) {
      continue;
    }

    if (match !== null) {
      return null;
    }

    match = action;
  }

  return match;
}
