import { describe, expect, it } from "vitest";
import { JARE_LINES, POINT_IDS } from "./board";
import { completesJare, JARE_LINES_BY_POINT } from "./jare";
import { createInitialState } from "./state";
import type { BoardOccupancy, PlayerId, PointId } from "./types";

function boardWith(pieces: Partial<Record<PointId, PlayerId>>): BoardOccupancy {
  const board = createInitialState("A").board;

  for (const [point, player] of Object.entries(pieces)) {
    board[point as PointId] = player;
  }

  return board;
}

describe("JARE_LINES_BY_POINT", () => {
  it("gives every point exactly the two lines it lies on", () => {
    for (const point of POINT_IDS) {
      const lines = JARE_LINES_BY_POINT[point];

      expect(lines).toHaveLength(2);

      for (const line of lines) {
        expect(line).toContain(point);
        expect(JARE_LINES).toContain(line);
      }
    }
  });
});

describe("completesJare", () => {
  it("detects a completed ring line", () => {
    const board = boardWith({ O1: "A", O2: "A", O3: "A" });

    expect(completesJare(board, "O1", "A")).toBe(true);
    expect(completesJare(board, "O2", "A")).toBe(true);
    expect(completesJare(board, "O3", "A")).toBe(true);
  });

  it("detects a completed connector line", () => {
    const board = boardWith({ O2: "B", M2: "B", I2: "B" });

    expect(completesJare(board, "M2", "B")).toBe(true);
  });

  it("rejects two-of-three lines", () => {
    const board = boardWith({ O1: "A", O2: "A" });

    expect(completesJare(board, "O2", "A")).toBe(false);
  });

  it("rejects lines mixed with opponent pieces", () => {
    const board = boardWith({ O1: "A", O2: "A", O3: "B" });

    expect(completesJare(board, "O2", "A")).toBe(false);
    expect(completesJare(board, "O3", "B")).toBe(false);
  });

  it("ignores complete lines the point is not part of", () => {
    const board = boardWith({ O1: "A", O2: "A", O3: "A", O5: "A" });

    expect(completesJare(board, "O5", "A")).toBe(false);
  });
});
