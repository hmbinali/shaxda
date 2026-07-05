export type Ring = "O" | "M" | "I";

export type RingPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type PointId = `${Ring}${RingPosition}`;

export type PlayerId = "A" | "B";

export type Phase = "placement" | "initialRemoval" | "movement" | "gameOver";

export type PointState = PlayerId | null;

export type BoardOccupancy = Record<PointId, PointState>;

export interface PlayerState {
  /** Pieces not yet placed. Decremented only during placement. */
  inHand: number;
  /**
   * Opponent pieces this player has captured via movement-phase jare
   * (docs/shaxda_game.md §6, §14). The initial removal phase is a "remove",
   * not a capture, and never changes this count. Pieces on the board are
   * counted from board occupancy, not from this field.
   */
  captured: number;
}

export interface GameState {
  phase: Phase;
  board: BoardOccupancy;
  currentPlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  /** Who placed first; decides the first-advantage fallback (§10). */
  startingPlayer: PlayerId;
  /**
   * Holder of first advantage (§10): first jare during placement, or the
   * non-starting player once placement ends with no jare. Null until decided.
   */
  firstAdvantage: PlayerId | null;
}

export type GameAction =
  | { type: "place"; player: PlayerId; point: PointId }
  | { type: "removeInitial"; player: PlayerId; point: PointId }
  | { type: "move"; player: PlayerId; from: PointId; to: PointId }
  | { type: "capture"; player: PlayerId; point: PointId }
  | { type: "resign"; player: PlayerId };
