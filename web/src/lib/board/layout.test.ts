import { JARE_LINES, POINT_IDS } from "@shaxda/game-engine";
import { describe, expect, it } from "vitest";
import { BOARD_CENTER, BOARD_LINES, HIT_RADIUS, POINT_COORDS } from "./layout";
import type { BoardLine } from "./layout";

describe("board layout", () => {
  it("provides distinct coordinates for all points", () => {
    expect(Object.keys(POINT_COORDS)).toHaveLength(POINT_IDS.length);
    expect(new Set(Object.keys(POINT_COORDS))).toEqual(new Set(POINT_IDS));

    const uniqueCoords = new Set(
      POINT_IDS.map(
        (point) => `${POINT_COORDS[point].x},${POINT_COORDS[point].y}`,
      ),
    );

    expect(uniqueCoords.size).toBe(POINT_IDS.length);
  });

  it("keeps every ring centered and symmetric", () => {
    for (const ring of ["O", "M", "I"] as const) {
      expect(POINT_COORDS[`${ring}1`].x + POINT_COORDS[`${ring}5`].x).toBe(
        BOARD_CENTER * 2,
      );
      expect(POINT_COORDS[`${ring}1`].y + POINT_COORDS[`${ring}5`].y).toBe(
        BOARD_CENTER * 2,
      );
      expect(POINT_COORDS[`${ring}2`].x).toBe(BOARD_CENTER);
      expect(POINT_COORDS[`${ring}6`].x).toBe(BOARD_CENTER);
      expect(POINT_COORDS[`${ring}4`].y).toBe(BOARD_CENTER);
      expect(POINT_COORDS[`${ring}8`].y).toBe(BOARD_CENTER);
    }
  });

  it("nests outer, middle, and inner rings", () => {
    expect(distanceFromCenter("O1")).toBeGreaterThan(distanceFromCenter("M1"));
    expect(distanceFromCenter("M1")).toBeGreaterThan(distanceFromCenter("I1"));
    expect(POINT_COORDS.O2.y).toBeLessThan(POINT_COORDS.M2.y);
    expect(POINT_COORDS.M2.y).toBeLessThan(POINT_COORDS.I2.y);
  });

  it("derives de-duplicated line segments from jare lines", () => {
    const expectedLines = JARE_LINES.flatMap(([a, b, c]) => [
      { a, b },
      { a: b, b: c },
    ]);

    expect(new Set(BOARD_LINES.map(canonicalLine))).toEqual(
      new Set(expectedLines.map(canonicalLine)),
    );
    expect(new Set(BOARD_LINES.map(canonicalLine))).toHaveLength(
      BOARD_LINES.length,
    );

    for (const line of BOARD_LINES) {
      expect(POINT_COORDS[line.a]).toBeDefined();
      expect(POINT_COORDS[line.b]).toBeDefined();
    }
  });

  it("keeps enlarged hit targets from overlapping", () => {
    const distances = POINT_IDS.flatMap((point, index) =>
      POINT_IDS.slice(index + 1).map((otherPoint) => {
        const a = POINT_COORDS[point];
        const b = POINT_COORDS[otherPoint];

        return Math.hypot(a.x - b.x, a.y - b.y);
      }),
    );

    expect(HIT_RADIUS * 2).toBeLessThan(Math.min(...distances));
  });
});

function distanceFromCenter(point: keyof typeof POINT_COORDS): number {
  const coord = POINT_COORDS[point];

  return Math.hypot(coord.x - BOARD_CENTER, coord.y - BOARD_CENTER);
}

function canonicalLine(line: BoardLine): string {
  return [line.a, line.b].sort().join("-");
}
