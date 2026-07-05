import type { PointId } from "./types";

export const POINT_IDS = [
  "O1",
  "O2",
  "O3",
  "O4",
  "O5",
  "O6",
  "O7",
  "O8",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "I1",
  "I2",
  "I3",
  "I4",
  "I5",
  "I6",
  "I7",
  "I8",
] as const satisfies readonly PointId[];

/**
 * Movement graph of the board (docs/shaxda_game.md §4, §13): each square
 * connects in ring order 1-2-3-4-5-6-7-8-1, and rings connect only through
 * the even points 2, 4, 6, 8. No diagonals.
 */
export const ADJACENCY = {
  O1: ["O2", "O8"],
  O2: ["O1", "O3", "M2"],
  O3: ["O2", "O4"],
  O4: ["O3", "O5", "M4"],
  O5: ["O4", "O6"],
  O6: ["O5", "O7", "M6"],
  O7: ["O6", "O8"],
  O8: ["O7", "O1", "M8"],
  M1: ["M2", "M8"],
  M2: ["M1", "M3", "O2", "I2"],
  M3: ["M2", "M4"],
  M4: ["M3", "M5", "O4", "I4"],
  M5: ["M4", "M6"],
  M6: ["M5", "M7", "O6", "I6"],
  M7: ["M6", "M8"],
  M8: ["M7", "M1", "O8", "I8"],
  I1: ["I2", "I8"],
  I2: ["I1", "I3", "M2"],
  I3: ["I2", "I4"],
  I4: ["I3", "I5", "M4"],
  I5: ["I4", "I6"],
  I6: ["I5", "I7", "M6"],
  I7: ["I6", "I8"],
  I8: ["I7", "I1", "M8"],
} as const satisfies Record<PointId, readonly PointId[]>;

export type JareLine = readonly [PointId, PointId, PointId];

/**
 * The 16 valid jare lines, verbatim from docs/shaxda_game.md §15.
 */
export const JARE_LINES = [
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
] as const satisfies readonly JareLine[];
