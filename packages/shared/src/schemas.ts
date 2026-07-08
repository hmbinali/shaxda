import { ADJACENCY, JARE_LINES, POINT_IDS } from "@shaxda/game-engine";
import { z } from "zod";
import type { PointId } from "@shaxda/game-engine";

export const protocolVersion = 1 as const;

export const boardContract = {
  pointIds: POINT_IDS,
  adjacency: ADJACENCY,
  jareLines: JARE_LINES,
} as const;

export const playerIdSchema = z.enum(["A", "B"]);
export const playerSlotSchema = z.enum(["A", "B"]);
export const pointIdSchema = z.enum(POINT_IDS);
export const phaseSchema = z.enum([
  "placement",
  "initialRemoval",
  "movement",
  "capture",
  "gameOver",
]);
export const gameEndReasonSchema = z.enum([
  "opponentBelowThree",
  "opponentCapturedAll",
  "resignation",
  "drawTermination",
  "bothBlocked",
  "forcedJareSpaceMaking",
]);
export const pointStateSchema = z.union([playerIdSchema, z.null()]);

const boardShape = Object.fromEntries(
  POINT_IDS.map((point) => [point, pointStateSchema]),
) as Record<PointId, typeof pointStateSchema>;

export const boardOccupancySchema = z.object(boardShape);

export const playerStateSchema = z.object({
  inHand: z.number().int().min(0).max(12),
  captured: z.number().int().min(0).max(12),
});

export const initialRemovalProgressSchema = z.object({
  removedBy: z.object({
    A: z.boolean(),
    B: z.boolean(),
  }),
});

export const pendingCaptureSchema = z.object({
  player: playerIdSchema,
  formedAt: pointIdSchema,
});

export const drawProgressSchema = z.object({
  turnsSinceCapture: z.number().int().min(0),
  repeatedPositions: z.record(z.string(), z.number().int().min(0)),
});

export const gameStateSchema = z.object({
  phase: phaseSchema,
  board: boardOccupancySchema,
  currentPlayer: playerIdSchema,
  players: z.object({
    A: playerStateSchema,
    B: playerStateSchema,
  }),
  startingPlayer: playerIdSchema,
  firstAdvantage: playerIdSchema.nullable(),
  initialRemoval: initialRemovalProgressSchema,
  pendingCapture: pendingCaptureSchema.nullable(),
  draw: drawProgressSchema,
  winner: playerIdSchema.nullable(),
  endReason: gameEndReasonSchema.nullable(),
});

export const placeActionSchema = z.object({
  type: z.literal("place"),
  player: playerIdSchema,
  point: pointIdSchema,
});

export const removeInitialActionSchema = z.object({
  type: z.literal("removeInitial"),
  player: playerIdSchema,
  point: pointIdSchema,
});

export const moveActionSchema = z.object({
  type: z.literal("move"),
  player: playerIdSchema,
  from: pointIdSchema,
  to: pointIdSchema,
});

export const captureActionSchema = z.object({
  type: z.literal("capture"),
  player: playerIdSchema,
  point: pointIdSchema,
});

export const resignActionSchema = z.object({
  type: z.literal("resign"),
  player: playerIdSchema,
});

export const gameActionSchema = z.discriminatedUnion("type", [
  placeActionSchema,
  removeInitialActionSchema,
  moveActionSchema,
  captureActionSchema,
  resignActionSchema,
]);

export const roomCodeSchema = z
  .string()
  .min(4)
  .max(32)
  .regex(/^[A-Z0-9-]+$/);
export const guestIdSchema = z.string().min(8).max(128);
export const guestDisplayNameSchema = z.string().min(1).max(40);

const envelopeBase = {
  v: z.literal(protocolVersion),
} as const;

export const createRoomClientMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("createRoom"),
  guestId: guestIdSchema,
  displayName: guestDisplayNameSchema.optional(),
});

export const joinRoomClientMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("joinRoom"),
  roomCode: roomCodeSchema,
  guestId: guestIdSchema,
  displayName: guestDisplayNameSchema.optional(),
});

export const gameActionClientMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("gameAction"),
  roomCode: roomCodeSchema,
  action: gameActionSchema,
});

export const claimWinClientMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("claimWin"),
  roomCode: roomCodeSchema,
});

export const echoClientMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("echo"),
  roomCode: roomCodeSchema,
  payload: z.string().max(2_000),
});

export const pingClientMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("ping"),
  nonce: z.string().max(128).optional(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  createRoomClientMessageSchema,
  joinRoomClientMessageSchema,
  gameActionClientMessageSchema,
  claimWinClientMessageSchema,
  echoClientMessageSchema,
  pingClientMessageSchema,
]);

export const roomCreatedServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("roomCreated"),
  roomCode: roomCodeSchema,
});

export const joinedServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("joined"),
  roomCode: roomCodeSchema,
  guestId: guestIdSchema,
  slot: playerSlotSchema,
});

const presencePlayerSchema = z.object({
  displayName: guestDisplayNameSchema.optional(),
});

export const presenceServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("presence"),
  roomCode: roomCodeSchema,
  players: z.object({
    A: presencePlayerSchema.nullable(),
    B: presencePlayerSchema.nullable(),
  }),
  started: z.boolean(),
});

export const stateServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("state"),
  roomCode: roomCodeSchema,
  state: gameStateSchema,
});

export const onlineMatchEndReasonSchema = z.enum([
  "opponentAbandoned",
  "opponentIdleTimeout",
]);

export const matchStatusServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("matchStatus"),
  roomCode: roomCodeSchema,
  connections: z.object({
    A: z.boolean(),
    B: z.boolean(),
  }),
  idleSlot: playerSlotSchema.nullable(),
  claimableBy: playerSlotSchema.nullable(),
  claimReason: onlineMatchEndReasonSchema.nullable(),
});

export const matchEndedServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("matchEnded"),
  roomCode: roomCodeSchema,
  winner: playerSlotSchema,
  reason: onlineMatchEndReasonSchema,
});

export const echoBroadcastServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("echoBroadcast"),
  roomCode: roomCodeSchema,
  fromGuestId: guestIdSchema,
  payload: z.string().max(2_000),
});

export const errorServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("error"),
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(240),
});

export const pongServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("pong"),
  nonce: z.string().max(128).optional(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  roomCreatedServerMessageSchema,
  joinedServerMessageSchema,
  presenceServerMessageSchema,
  stateServerMessageSchema,
  matchStatusServerMessageSchema,
  matchEndedServerMessageSchema,
  echoBroadcastServerMessageSchema,
  errorServerMessageSchema,
  pongServerMessageSchema,
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
