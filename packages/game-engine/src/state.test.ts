import { describe, expect, it } from "vitest";
import { POINT_IDS } from "./board";
import { createInitialState, PIECES_PER_PLAYER } from "./state";

describe("createInitialState", () => {
  it("starts in placement with an empty board and the given starting player", () => {
    const state = createInitialState("B");

    expect(state.phase).toBe("placement");
    expect(state.currentPlayer).toBe("B");
    expect(Object.keys(state.board)).toHaveLength(POINT_IDS.length);

    for (const id of POINT_IDS) {
      expect(state.board[id]).toBeNull();
    }
  });

  it("gives both players 12 pieces in hand and no captures", () => {
    const state = createInitialState("A");

    expect(PIECES_PER_PLAYER).toBe(12);
    expect(state.players.A).toEqual({ inHand: 12, captured: 0 });
    expect(state.players.B).toEqual({ inHand: 12, captured: 0 });
  });

  it("returns independent state objects on each call", () => {
    const first = createInitialState("A");
    const second = createInitialState("A");

    first.board.O1 = "A";
    first.players.A.inHand = 11;

    expect(second.board.O1).toBeNull();
    expect(second.players.A.inHand).toBe(12);
  });
});
