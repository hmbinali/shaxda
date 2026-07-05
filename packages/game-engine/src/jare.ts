import { JARE_LINES, POINT_IDS } from "./board";
import type { JareLine } from "./board";
import type { BoardOccupancy, PlayerId, PointId } from "./types";

/**
 * The jare lines passing through each point. Every point lies on exactly
 * two of the 16 lines (docs/shaxda_game.md §15).
 */
export const JARE_LINES_BY_POINT: Record<PointId, readonly JareLine[]> =
  POINT_IDS.reduce(
    (lines, point) => {
      lines[point] = JARE_LINES.filter((line) =>
        (line as readonly PointId[]).includes(point),
      );
      return lines;
    },
    {} as Record<PointId, readonly JareLine[]>,
  );

/**
 * True when `point` is part of a jare owned by `player`: some line through
 * `point` is fully occupied by that player's pieces. `board` must already
 * contain the piece at `point`.
 */
export function completesJare(
  board: BoardOccupancy,
  point: PointId,
  player: PlayerId,
): boolean {
  return completedJareLines(board, point, player).length > 0;
}

export function completedJareLines(
  board: BoardOccupancy,
  point: PointId,
  player: PlayerId,
): readonly JareLine[] {
  return JARE_LINES_BY_POINT[point].filter((line) =>
    line.every((id) => board[id] === player),
  );
}

/**
 * A repeated jare earns a capture only when the move newly completes a line
 * that was not complete before the move. This keeps the rule stateless.
 */
export function formsNewJare(
  before: BoardOccupancy,
  after: BoardOccupancy,
  point: PointId,
  player: PlayerId,
): boolean {
  return JARE_LINES_BY_POINT[point].some(
    (line) =>
      line.every((id) => after[id] === player) &&
      !line.every((id) => before[id] === player),
  );
}
