import { POINT_IDS, legalActions } from "@shaxda/game-engine";
import type {
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "@shaxda/game-engine";
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
    const expectedHints = legalActions(state)
      .filter(isMoveFrom(selected))
      .map((action) => action.to);

    expect(legalHintPointIds(view.points)).toEqual(expectedHints);
  });

  it("marks legal movement hints for blocked-player space-making", () => {
    const state = gameFixtures.blockedPlayer;
    const view = buildBoardView(state, { selected: "O2" });
    const expectedHints = legalActions(state)
      .filter(isMoveFrom("O2"))
      .map((action) => action.to);

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

  it("marks initial-removal targets without capture semantics", () => {
    const state = gameFixtures.initialRemoval;
    const view = buildBoardView(state);
    const expectedTargets = legalActions(state)
      .filter((action) => action.type === "removeInitial")
      .map((action) => action.point);

    expect(removalTargetPointIds(view.points)).toEqual(expectedTargets);
    expect(captureTargetPointIds(view.points)).toEqual([]);
  });

  it("exposes jare line metadata separately from structural lines", () => {
    const view = buildBoardView(gameFixtures.placementJare);
    const line = view.jareLines.find(
      (candidate) => candidate.id === "O1-O2-O3",
    );

    expect(view.jareLines).toHaveLength(16);
    expect(line).toMatchObject({
      id: "O1-O2-O3",
      points: ["O1", "O2", "O3"],
      isCompleted: true,
      owner: "A",
      isActivePendingCapture: false,
    });
  });

  it("marks the pending-capture jare line through the engine helper", () => {
    const view = buildBoardView(gameFixtures.capturePending);
    const activeLines = view.jareLines.filter(
      (line) => line.isActivePendingCapture,
    );

    expect(activeLines).toHaveLength(1);
    expect(activeLines[0]).toMatchObject({
      id: "O1-O2-O3",
      owner: "A",
      isCompleted: true,
    });
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

function removalTargetPointIds(points: readonly PointView[]): PointId[] {
  return points
    .filter((point) => point.isRemovalTarget)
    .map((point) => point.id);
}

function decorationCount(state: GameState): number {
  return buildBoardView(state).points.filter(
    (point) =>
      point.isSelected ||
      point.isLegalHint ||
      point.isCaptureTarget ||
      point.isRemovalTarget,
  ).length;
}

function isMoveFrom(
  selected: PointId,
): (action: GameAction) => action is Extract<GameAction, { type: "move" }> {
  return (action): action is Extract<GameAction, { type: "move" }> =>
    action.type === "move" && action.from === selected;
}
