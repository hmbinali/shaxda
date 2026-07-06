import { POINT_IDS, getLegalMoves, legalActions } from "@shaxda/game-engine";
import type { GameState, PlayerId, PointId } from "@shaxda/game-engine";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it } from "vitest";
import { buildBoardView } from "./view-model";

describe("buildBoardView", () => {
  it("maps fixture occupancy onto board points", () => {
    const view = buildBoardView(gameFixtures.midPlacement);

    expect(countPieces(view.points, "A")).toBe(2);
    expect(countPieces(view.points, "B")).toBe(2);
    expect(view.points).toHaveLength(POINT_IDS.length);
    expect(view.points.find((point) => point.id === "O1")?.occupant).toBe("A");
    expect(view.points.find((point) => point.id === "M1")?.occupant).toBe("B");
  });

  it("marks the selected point only", () => {
    const view = buildBoardView(gameFixtures.movement, { selected: "O8" });

    expect(selectedPointIds(view.points)).toEqual(["O8"]);
  });

  it("marks legal movement hints from the engine", () => {
    const state = gameFixtures.movement;
    const selected = "O8";
    const view = buildBoardView(state, { selected });
    const expectedHints = getLegalMoves(state, state.currentPlayer)
      .filter((move) => move.from === selected)
      .map((move) => move.to);

    expect(legalHintPointIds(view.points)).toEqual(expectedHints);
  });

  it("does not show legal hints when selected point is not current player's piece", () => {
    const view = buildBoardView(gameFixtures.movement, { selected: "O7" });

    expect(legalHintPointIds(view.points)).toEqual([]);
  });

  it("marks capture targets from legal capture actions", () => {
    const state = gameFixtures.capturePending;
    const view = buildBoardView(state);
    const expectedTargets = legalActions(state)
      .filter((action) => action.type === "capture")
      .map((action) => action.point);

    expect(captureTargetPointIds(view.points)).toEqual(expectedTargets);
  });

  it("does not add decorations for the empty board or blocked movement fixture", () => {
    expect(decorationCount(gameFixtures.emptyBoard)).toBe(0);
    expect(
      captureTargetPointIds(buildBoardView(gameFixtures.blockedPlayer).points),
    ).toEqual([]);
  });
});

type PointView = ReturnType<typeof buildBoardView>["points"][number];

function countPieces(points: readonly PointView[], player: PlayerId): number {
  return points.filter((point) => point.occupant === player).length;
}

function selectedPointIds(points: readonly PointView[]): PointId[] {
  return points.filter((point) => point.isSelected).map((point) => point.id);
}

function legalHintPointIds(points: readonly PointView[]): PointId[] {
  return points.filter((point) => point.isLegalHint).map((point) => point.id);
}

function captureTargetPointIds(points: readonly PointView[]): PointId[] {
  return points
    .filter((point) => point.isCaptureTarget)
    .map((point) => point.id);
}

function decorationCount(state: GameState): number {
  return buildBoardView(state).points.filter(
    (point) => point.isSelected || point.isLegalHint || point.isCaptureTarget,
  ).length;
}
