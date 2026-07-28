import { describe, expect, it } from "vitest";
import {
  instructionKeyFor,
  noticeOwnerFor,
  railStateLabelKeyFor,
  railStateFor,
  resolveSeating,
} from "./seating";
import type { GameStatus } from "./status";

const baseStatus: GameStatus = {
  phase: "placement",
  currentPlayer: "A",
  actingPlayer: "A",
  isSpaceMaking: false,
  firstAdvantage: null,
  winner: null,
  endReason: null,
  players: {
    A: { inHand: 12, captured: 0, onBoard: 0 },
    B: { inHand: 12, captured: 0, onBoard: 0 },
  },
  turnsSinceCapture: 0,
};

describe("resolveSeating", () => {
  it("keeps the shared table fixed with the top rail rotated", () => {
    expect(resolveSeating({ orientation: "shared" })).toEqual({
      top: "B",
      bottom: "A",
      rotateTop: true,
    });
  });

  it.each(["A", "B"] as const)(
    "seats solo viewer %s at the bottom without rotating either player",
    (viewer) => {
      const seating = resolveSeating({ orientation: "solo", viewer });

      expect(seating.bottom).toBe(viewer);
      expect(seating.top).not.toBe(viewer);
      expect(seating.rotateTop).toBe(false);
    },
  );
});

describe("railStateFor", () => {
  it("distinguishes the acting and waiting players", () => {
    expect(railStateFor(baseStatus, "A")).toBe("acting");
    expect(railStateFor(baseStatus, "B")).toBe("waiting");
  });

  it("distinguishes the blocked player from the player making space", () => {
    const status = {
      ...baseStatus,
      phase: "movement",
      currentPlayer: "A",
      actingPlayer: "B",
      isSpaceMaking: true,
    } satisfies GameStatus;

    expect(railStateFor(status, "A")).toBe("blocked");
    expect(railStateFor(status, "B")).toBe("spaceMaking");
  });

  it("distinguishes winner and loser", () => {
    const status = {
      ...baseStatus,
      phase: "gameOver",
      winner: "B",
      endReason: "resignation",
    } satisfies GameStatus;

    expect(railStateFor(status, "A")).toBe("loser");
    expect(railStateFor(status, "B")).toBe("winner");
  });

  it("keeps both rails neutral for a draw", () => {
    const status = {
      ...baseStatus,
      phase: "gameOver",
      winner: null,
      endReason: "drawTermination",
    } satisfies GameStatus;

    expect(railStateFor(status, "A")).toBe("waiting");
    expect(railStateFor(status, "B")).toBe("waiting");
  });
});

describe("railStateLabelKeyFor", () => {
  it("uses neutral copy when the solo opponent is acting", () => {
    expect(railStateLabelKeyFor("acting", "A", "B")).toBe("opponentActing");
    expect(railStateLabelKeyFor("spaceMaking", "A", "B")).toBe(
      "opponentActing",
    );
  });

  it("keeps viewer and shared-table state labels unchanged", () => {
    expect(railStateLabelKeyFor("acting", "A", "A")).toBe("acting");
    expect(railStateLabelKeyFor("acting", "A", null)).toBe("acting");
    expect(railStateLabelKeyFor("blocked", "A", "B")).toBe("blocked");
  });
});

describe("instructionKeyFor", () => {
  it.each([
    ["placement", "place"],
    ["initialRemoval", "remove"],
    ["movement", "move"],
    ["capture", "capture"],
  ] as const)("maps the acting %s phase to %s", (phase, instruction) => {
    expect(
      instructionKeyFor({ ...baseStatus, phase }, "A", {
        orientation: "shared",
      }),
    ).toBe(instruction);
  });

  it("gives the space-making player the specific instruction", () => {
    expect(
      instructionKeyFor(
        {
          ...baseStatus,
          phase: "movement",
          currentPlayer: "A",
          actingPlayer: "B",
          isSpaceMaking: true,
        },
        "B",
        { orientation: "shared" },
      ),
    ).toBe("makeSpace");
  });

  it("keeps passive and completed rails free of commands", () => {
    expect(
      instructionKeyFor(baseStatus, "B", { orientation: "shared" }),
    ).toBeNull();
    expect(
      instructionKeyFor(
        { ...baseStatus, phase: "gameOver", winner: "A" },
        "A",
        { orientation: "shared" },
      ),
    ).toBeNull();
  });

  it("never aims a command at the opponent in solo orientation", () => {
    expect(
      instructionKeyFor(baseStatus, "A", {
        orientation: "solo",
        viewer: "B",
      }),
    ).toBeNull();
  });
});

describe("noticeOwnerFor", () => {
  it.each([
    ["opponentDisconnected", "opponent"],
    ["reconnecting", "viewer"],
    ["isIdlePlayer", "viewer"],
    ["canClaimWin", "centre"],
    ["invalid", "viewer"],
    ["lastServerError", "viewer"],
  ] as const)("assigns %s to %s", (signal, owner) => {
    expect(noticeOwnerFor(signal)).toBe(owner);
  });
});
