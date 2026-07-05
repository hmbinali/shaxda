export type Ring = "O" | "M" | "I";

export type RingPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type PointId = `${Ring}${RingPosition}`;

export type PlayerId = "A" | "B";

export type Phase = "placement" | "initialRemoval" | "movement" | "gameOver";

export type PointState = PlayerId | null;

export type BoardOccupancy = Record<PointId, PointState>;

export interface PlayerState {
  inHand: number;
  captured: number;
}

export interface GameState {
  phase: Phase;
  board: BoardOccupancy;
  currentPlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
}

export type GameAction =
  | { type: "place"; player: PlayerId; point: PointId }
  | { type: "removeInitial"; player: PlayerId; point: PointId }
  | { type: "move"; player: PlayerId; from: PointId; to: PointId }
  | { type: "capture"; player: PlayerId; point: PointId }
  | { type: "resign"; player: PlayerId };
