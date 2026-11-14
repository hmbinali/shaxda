import {
  COMPACT_ACTION_PATTERN,
  MAX_REPLAY_ACTIONS,
} from "@shaxda/game-engine";
import { z } from "zod";
import { gameEndReasonSchema, playerIdSchema, roomCodeSchema } from "./schemas";

export { matchIdSchema, roomOptionsSchema } from "./schemas";

export const MAX_STORED_REPLAY_BYTES = 16_384;
export const compactReplaySchema = z.strictObject({
  v: z.literal(1),
  s: playerIdSchema,
  a: z.array(z.string().regex(COMPACT_ACTION_PATTERN)).max(MAX_REPLAY_ACTIONS),
});

export function parseStoredReplay(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_STORED_REPLAY_BYTES) {
    throw new Error("Stored replay exceeds the byte limit.");
  }
  return compactReplaySchema.parse(JSON.parse(text));
}

const resultSchema = z.enum(["win", "loss", "draw"]);
const matchPlayerPayloadSchema = z.strictObject({
  seat: playerIdSchema,
  userId: z.string().min(1),
  result: resultSchema,
  piecesLeft: z.number().int().min(0).max(12),
  captured: z.number().int().min(0).max(12),
});

import { matchIdSchema } from "./schemas";

export const matchPayloadSchema = z
  .strictObject({
    id: matchIdSchema,
    roomCode: roomCodeSchema,
    roomCreatedAt: z.number().int(),
    matchNumber: z.number().int().positive(),
    mode: z.enum(["invite", "quick"]),
    rated: z.union([z.literal(0), z.literal(1)]),
    consentPolicyV: z.number().int().nullable(),
    rulesV: z.number().int().positive(),
    replayV: z.literal(1),
    replay: z.string(),
    startingSeat: playerIdSchema,
    firstAdvantageSeat: playerIdSchema.nullable(),
    firstAdvantageBy: z.enum(["placementJare", "noJareFallback"]).nullable(),
    winnerSeat: playerIdSchema.nullable(),
    endReason: gameEndReasonSchema,
    onlineEndReason: z.enum(["abandoned", "idle"]).nullable(),
    actionCount: z.number().int().positive().max(MAX_REPLAY_ACTIONS),
    statsV: z.number().int().nullable(),
    statsStatus: z.enum(["none", "ok", "error"]),
    statsJson: z.string().nullable(),
    startedAt: z.number().int(),
    endedAt: z.number().int(),
    players: z.tuple([
      matchPlayerPayloadSchema.extend({ seat: z.literal("A") }),
      matchPlayerPayloadSchema.extend({ seat: z.literal("B") }),
    ]),
  })
  .refine((p) => p.endedAt >= p.startedAt, { path: ["endedAt"] })
  .refine((p) => (p.rated === 1) === (p.consentPolicyV !== null), {
    path: ["consentPolicyV"],
  })
  .refine((p) => p.mode === "invite" || p.rated === 1, { path: ["rated"] })
  .refine(
    (p) => (p.firstAdvantageSeat === null) === (p.firstAdvantageBy === null),
    { path: ["firstAdvantageBy"] },
  )
  .refine(
    (p) =>
      (p.winnerSeat === null) ===
      ["drawTermination", "bothBlocked", "forcedJareSpaceMaking"].includes(
        p.endReason,
      ),
    { path: ["winnerSeat"] },
  )
  .refine((p) => p.onlineEndReason === null || p.endReason === "resignation", {
    path: ["onlineEndReason"],
  })
  .refine((p) => (p.statsStatus === "ok") === (p.statsJson !== null), {
    path: ["statsJson"],
  })
  .refine((p) => p.statsStatus === "none" || p.statsV !== null, {
    path: ["statsV"],
  })
  .refine(
    (p) =>
      p.players[0].userId !== p.players[1].userId &&
      p.players.every(
        ({ seat, result }) =>
          result ===
          (p.winnerSeat === null
            ? "draw"
            : p.winnerSeat === seat
              ? "win"
              : "loss"),
      ),
    { path: ["players"] },
  );

export type MatchPayload = z.infer<typeof matchPayloadSchema>;

export async function matchPayloadHash(p: MatchPayload): Promise<string> {
  // Keep the key order explicit, including in each participant. A stalled
  // replay diagnostic can be hashed even when it cannot pass ledger validation.
  const immutable = {
    id: p.id,
    roomCode: p.roomCode,
    roomCreatedAt: p.roomCreatedAt,
    matchNumber: p.matchNumber,
    mode: p.mode,
    rated: p.rated,
    consentPolicyV: p.consentPolicyV,
    rulesV: p.rulesV,
    replayV: p.replayV,
    replay: p.replay,
    startingSeat: p.startingSeat,
    firstAdvantageSeat: p.firstAdvantageSeat,
    firstAdvantageBy: p.firstAdvantageBy,
    winnerSeat: p.winnerSeat,
    endReason: p.endReason,
    onlineEndReason: p.onlineEndReason,
    actionCount: p.actionCount,
    startedAt: p.startedAt,
    endedAt: p.endedAt,
    players: p.players.map(
      ({ seat, userId, result, piecesLeft, captured }) => ({
        seat,
        userId,
        result,
        piecesLeft,
        captured,
      }),
    ),
  };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(immutable)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
