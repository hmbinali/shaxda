import { describe, expect, it } from "vitest";
import { ADJACENCY, JARE_LINES, POINT_IDS } from "./board";
import type { PointId } from "./types";

const RINGS = ["O", "M", "I"] as const;
const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const EVEN_POSITIONS = [2, 4, 6, 8] as const;
const ODD_POSITIONS = [1, 3, 5, 7] as const;

const point = (ring: (typeof RINGS)[number], position: number): PointId =>
  `${ring}${position}` as PointId;

const areAdjacent = (a: PointId, b: PointId): boolean =>
  (ADJACENCY[a] as readonly PointId[]).includes(b);

describe("point labels", () => {
  it("has exactly the 24 labeled points", () => {
    const expected = RINGS.flatMap((ring) =>
      POSITIONS.map((position) => point(ring, position)),
    );

    expect(POINT_IDS).toHaveLength(24);
    expect(new Set(POINT_IDS)).toEqual(new Set(expected));
  });

  it("has no duplicate labels", () => {
    expect(new Set(POINT_IDS).size).toBe(POINT_IDS.length);
  });
});

describe("adjacency map", () => {
  it("covers all 24 points with no self-loops or duplicate neighbors", () => {
    expect(new Set(Object.keys(ADJACENCY))).toEqual(new Set(POINT_IDS));

    for (const id of POINT_IDS) {
      expect(ADJACENCY[id]).not.toContain(id);
      expect(new Set(ADJACENCY[id]).size).toBe(ADJACENCY[id].length);
    }
  });

  it("is symmetric", () => {
    for (const id of POINT_IDS) {
      for (const neighbor of ADJACENCY[id]) {
        expect(ADJACENCY[neighbor]).toContain(id);
      }
    }
  });

  it("connects each ring in order 1-2-3-4-5-6-7-8-1", () => {
    for (const ring of RINGS) {
      for (const position of POSITIONS) {
        const next = (position % 8) + 1;
        expect(areAdjacent(point(ring, position), point(ring, next))).toBe(
          true,
        );
      }
    }
  });

  it("connects rings only through even points, without O-I shortcuts", () => {
    for (const position of EVEN_POSITIONS) {
      expect(areAdjacent(point("O", position), point("M", position))).toBe(
        true,
      );
      expect(areAdjacent(point("M", position), point("I", position))).toBe(
        true,
      );
      expect(areAdjacent(point("O", position), point("I", position))).toBe(
        false,
      );
    }

    for (const position of ODD_POSITIONS) {
      expect(areAdjacent(point("O", position), point("M", position))).toBe(
        false,
      );
      expect(areAdjacent(point("M", position), point("I", position))).toBe(
        false,
      );
      expect(areAdjacent(point("O", position), point("I", position))).toBe(
        false,
      );
    }
  });

  it("has degree 2 on odd points, 3 on outer/inner even points, 4 on middle even points", () => {
    for (const ring of RINGS) {
      for (const position of ODD_POSITIONS) {
        expect(ADJACENCY[point(ring, position)]).toHaveLength(2);
      }
    }

    for (const position of EVEN_POSITIONS) {
      expect(ADJACENCY[point("O", position)]).toHaveLength(3);
      expect(ADJACENCY[point("M", position)]).toHaveLength(4);
      expect(ADJACENCY[point("I", position)]).toHaveLength(3);
    }
  });

  it("has exactly 32 edges: 24 ring edges plus 8 connector edges", () => {
    const degreeSum = POINT_IDS.reduce(
      (sum, id) => sum + ADJACENCY[id].length,
      0,
    );

    expect(degreeSum).toBe(64);
  });

  it("contains only ring edges and even connector edges", () => {
    const expectedEdges = new Set<string>();
    const edgeKey = (a: PointId, b: PointId) => [a, b].sort().join("-");

    for (const ring of RINGS) {
      for (const position of POSITIONS) {
        const next = (position % 8) + 1;
        expectedEdges.add(edgeKey(point(ring, position), point(ring, next)));
      }
    }

    for (const position of EVEN_POSITIONS) {
      expectedEdges.add(edgeKey(point("O", position), point("M", position)));
      expectedEdges.add(edgeKey(point("M", position), point("I", position)));
    }

    const actualEdges = new Set(
      POINT_IDS.flatMap((id) =>
        ADJACENCY[id].map((neighbor) => edgeKey(id, neighbor)),
      ),
    );

    expect(actualEdges).toEqual(expectedEdges);
  });
});

describe("jare lines", () => {
  const canonical = (line: readonly PointId[]) => [...line].sort().join("-");

  it("matches the 16 lines from docs/shaxda_game.md", () => {
    const expected: readonly (readonly PointId[])[] = [
      ["O1", "O2", "O3"],
      ["O3", "O4", "O5"],
      ["O5", "O6", "O7"],
      ["O7", "O8", "O1"],
      ["M1", "M2", "M3"],
      ["M3", "M4", "M5"],
      ["M5", "M6", "M7"],
      ["M7", "M8", "M1"],
      ["I1", "I2", "I3"],
      ["I3", "I4", "I5"],
      ["I5", "I6", "I7"],
      ["I7", "I8", "I1"],
      ["O2", "M2", "I2"],
      ["O4", "M4", "I4"],
      ["O6", "M6", "I6"],
      ["O8", "M8", "I8"],
    ];

    expect(JARE_LINES).toHaveLength(16);
    expect(new Set(JARE_LINES.map(canonical))).toEqual(
      new Set(expected.map(canonical)),
    );
  });

  it("only uses consecutive adjacent points", () => {
    for (const [a, b, c] of JARE_LINES) {
      expect(areAdjacent(a, b)).toBe(true);
      expect(areAdjacent(b, c)).toBe(true);
    }
  });

  it("has three distinct points per line", () => {
    for (const line of JARE_LINES) {
      expect(new Set(line).size).toBe(3);
    }
  });

  it("covers every point exactly twice", () => {
    const counts = new Map<PointId, number>();

    for (const line of JARE_LINES) {
      for (const id of line) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    for (const id of POINT_IDS) {
      expect(counts.get(id)).toBe(2);
    }
  });
});
