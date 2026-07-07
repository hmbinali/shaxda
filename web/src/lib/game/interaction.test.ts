import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it } from "vitest";
import { mapPointClick } from "./interaction";

describe("mapPointClick", () => {
  it("applies valid placement and rejects occupied placement", () => {
    expect(mapPointClick(gameFixtures.emptyBoard, null, "O1")).toEqual({
      type: "apply",
      action: { type: "place", player: "A", point: "O1" },
    });
    expect(mapPointClick(gameFixtures.midPlacement, null, "O1")).toEqual({
      type: "invalid",
      reason: "illegalPoint",
    });
  });

  it("applies initial removal from legal actions", () => {
    expect(mapPointClick(gameFixtures.initialRemoval, null, "O1")).toEqual({
      type: "apply",
      action: { type: "removeInitial", player: "B", point: "O1" },
    });
  });

  it("selects, reselects, deselects, and applies movement", () => {
    expect(mapPointClick(gameFixtures.movement, null, "O8")).toEqual({
      type: "select",
      selected: "O8",
    });
    expect(mapPointClick(gameFixtures.movement, "O8", "O8")).toEqual({
      type: "deselect",
    });
    expect(mapPointClick(gameFixtures.movement, "O8", "O1")).toEqual({
      type: "apply",
      action: { type: "move", player: "B", from: "O8", to: "O1" },
    });
    expect(mapPointClick(gameFixtures.movement, "O8", "O7")).toEqual({
      type: "invalid",
      reason: "illegalMove",
    });
  });

  it("reselects another movable piece during movement", () => {
    expect(mapPointClick(gameFixtures.repeatedJare, "O4", "O1")).toEqual({
      type: "select",
      selected: "O1",
    });
  });

  it("applies capture from legal actions", () => {
    expect(mapPointClick(gameFixtures.capturePending, null, "O5")).toEqual({
      type: "apply",
      action: { type: "capture", player: "A", point: "O5" },
    });
  });

  it("uses the acting player for blocked-player space-making", () => {
    expect(mapPointClick(gameFixtures.blockedPlayer, null, "O2")).toEqual({
      type: "select",
      selected: "O2",
    });
    expect(mapPointClick(gameFixtures.blockedPlayer, "O2", "O3")).toEqual({
      type: "apply",
      action: { type: "move", player: "A", from: "O2", to: "O3" },
    });
  });

  it("rejects clicks after game over", () => {
    expect(mapPointClick(gameFixtures.win, null, "O1")).toEqual({
      type: "invalid",
      reason: "gameOver",
    });
  });
});
