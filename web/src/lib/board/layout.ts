import { JARE_LINES, POINT_IDS } from "@shaxda/game-engine";
import type { PointId, Ring, RingPosition } from "@shaxda/game-engine";

export interface BoardCoord {
  x: number;
  y: number;
}

export interface BoardLine {
  a: PointId;
  b: PointId;
}

export const BOARD_VIEWBOX_SIZE = 100;
export const BOARD_CENTER = BOARD_VIEWBOX_SIZE / 2;
export const SOCKET_RADIUS = 2.6;
export const PIECE_RADIUS = 4.2;
export const LEGAL_HINT_RADIUS = 1.55;

const RING_HALF_SIZES = {
  O: 42,
  M: 29,
  I: 16,
} as const satisfies Record<Ring, number>;

const POSITION_OFFSETS = {
  1: [-1, -1],
  2: [0, -1],
  3: [1, -1],
  4: [1, 0],
  5: [1, 1],
  6: [0, 1],
  7: [-1, 1],
  8: [-1, 0],
} as const satisfies Record<RingPosition, readonly [number, number]>;

export const POINT_COORDS = Object.fromEntries(
  POINT_IDS.map((point) => {
    const ring = point[0] as Ring;
    const position = Number(point[1]) as RingPosition;
    const [xOffset, yOffset] = POSITION_OFFSETS[position];
    const halfSize = RING_HALF_SIZES[ring];

    return [
      point,
      {
        x: BOARD_CENTER + xOffset * halfSize,
        y: BOARD_CENTER + yOffset * halfSize,
      },
    ];
  }),
) as Record<PointId, BoardCoord>;

export const BOARD_LINES = dedupeLines(
  JARE_LINES.flatMap(([a, b, c]) => [
    { a, b },
    { a: b, b: c },
  ]),
);

function dedupeLines(lines: readonly BoardLine[]): BoardLine[] {
  const seen = new Set<string>();
  const uniqueLines: BoardLine[] = [];

  for (const line of lines) {
    const key = [line.a, line.b].sort().join("-");

    if (!seen.has(key)) {
      seen.add(key);
      uniqueLines.push(line);
    }
  }

  return uniqueLines;
}
