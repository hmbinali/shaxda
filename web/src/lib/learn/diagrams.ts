import type { GameAction, GameState, PointId } from "@shaxda/game-engine";
import { gameFixtures, learningFixtures } from "@shaxda/shared";

export const learnDiagramIds = [
  "board-anatomy",
  "legal-movement",
  "jare-formed",
  "jare-opened",
  "jare-reformed",
  "blocked-player",
  "blocked-space-made",
] as const;

export type LearnDiagramId = (typeof learnDiagramIds)[number];
export type DiagramMarkStatus = "legal" | "illegal" | "highlight" | "neutral";

interface DiagramMarkBase {
  label: string;
  status: DiagramMarkStatus;
  labelOffset?: { x: number; y: number };
}

export type DiagramMark =
  | (DiagramMarkBase & {
      kind: "arrow";
      from: PointId;
      to: PointId;
    })
  | (DiagramMarkBase & {
      kind: "line" | "outline";
      points: readonly PointId[];
      labelAt: PointId;
    })
  | (DiagramMarkBase & {
      kind: "ring";
      point: PointId;
    });

export interface LearnDiagramDefinition {
  state: GameState;
  selected?: PointId;
  action?: GameAction;
  marks: readonly DiagramMark[];
}

export const learnDiagrams = {
  "board-anatomy": {
    state: gameFixtures.emptyBoard,
    marks: [
      {
        kind: "outline",
        points: ["O1", "O3", "O5", "O7", "O1"],
        labelAt: "O2",
        label: "Dibadda: 8 barood",
        status: "neutral",
        labelOffset: { x: 0, y: -4 },
      },
      {
        kind: "outline",
        points: ["M1", "M3", "M5", "M7", "M1"],
        labelAt: "M2",
        label: "Dhexe: 8 barood",
        status: "highlight",
        labelOffset: { x: 0, y: -4 },
      },
      {
        kind: "outline",
        points: ["I1", "I3", "I5", "I7", "I1"],
        labelAt: "I2",
        label: "Gudaha: 8 barood",
        status: "legal",
        labelOffset: { x: 0, y: -4 },
      },
    ],
  },
  "legal-movement": {
    state: learningFixtures.legalMovement,
    selected: "O1",
    marks: [
      {
        kind: "arrow",
        from: "O1",
        to: "O2",
        label: "Sharci",
        status: "legal",
        labelOffset: { x: 0, y: -4 },
      },
      {
        kind: "arrow",
        from: "O1",
        to: "O8",
        label: "Sharci",
        status: "legal",
        labelOffset: { x: -6, y: 1 },
      },
      {
        kind: "arrow",
        from: "O1",
        to: "O3",
        label: "Boodis",
        status: "illegal",
        labelOffset: { x: 0, y: 5 },
      },
      {
        kind: "arrow",
        from: "O1",
        to: "M2",
        label: "Xiriir ma leh",
        status: "illegal",
        labelOffset: { x: 8, y: 4 },
      },
    ],
  },
  "jare-formed": {
    state: learningFixtures.repeatedJareFormed,
    action: { type: "move", player: "A", from: "O4", to: "O3" },
    marks: [
      {
        kind: "line",
        points: ["O1", "O2", "O3"],
        labelAt: "O2",
        label: "Jare cusub",
        status: "legal",
        labelOffset: { x: 0, y: 6 },
      },
    ],
  },
  "jare-opened": {
    state: learningFixtures.repeatedJareOpened,
    action: { type: "move", player: "A", from: "O2", to: "M2" },
    marks: [
      {
        kind: "ring",
        point: "O2",
        label: "Barta muhiimka ah",
        status: "highlight",
        labelOffset: { x: 0, y: -6 },
      },
      {
        kind: "arrow",
        from: "M2",
        to: "O2",
        label: "Dib u soo celi",
        status: "neutral",
        labelOffset: { x: 11, y: 0 },
      },
    ],
  },
  "jare-reformed": {
    state: learningFixtures.repeatedJareReformed,
    action: { type: "move", player: "A", from: "M2", to: "O2" },
    marks: [
      {
        kind: "line",
        points: ["O1", "O2", "O3"],
        labelAt: "O2",
        label: "Jare dib loo sameeyay",
        status: "legal",
        labelOffset: { x: 0, y: 6 },
      },
    ],
  },
  "blocked-player": {
    state: gameFixtures.blockedPlayer,
    action: { type: "move", player: "A", from: "O2", to: "O3" },
    marks: [
      {
        kind: "arrow",
        from: "O2",
        to: "O3",
        label: "1. Bannayn",
        status: "highlight",
        labelOffset: { x: 0, y: -5 },
      },
    ],
  },
  "blocked-space-made": {
    state: gameFixtures.blockedSpaceMade,
    selected: "O1",
    action: { type: "move", player: "B", from: "O1", to: "O2" },
    marks: [
      {
        kind: "arrow",
        from: "O1",
        to: "O2",
        label: "2. Dhaqaaq",
        status: "legal",
        labelOffset: { x: 0, y: -5 },
      },
    ],
  },
} as const satisfies Record<LearnDiagramId, LearnDiagramDefinition>;

export function getLearnDiagram(id: LearnDiagramId): LearnDiagramDefinition {
  return learnDiagrams[id];
}
