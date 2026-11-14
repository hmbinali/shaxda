import {
  applyAction,
  createInitialState,
  decodeCompactReplay,
  serialize,
} from "@shaxda/game-engine";

const replayV1 = {
  applyAction,
  createInitialState,
  decodeCompactReplay,
  serialize,
};

export function getReplayAdapter(rulesV: number, replayV: number) {
  return rulesV === 1 && replayV === 1 ? replayV1 : null;
}
