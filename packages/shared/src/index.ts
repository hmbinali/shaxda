import { z } from "zod";

export * from "./fixtures";
export * from "./learning-fixtures";
export * from "./schemas";
export * from "./account";
export * from "./history/schemas";

export const appMetadata = {
  id: "shaxda",
  name: "Shaxda",
  description:
    "Shaxda waa ciyaar Soomaali ah oo lagu barto xeerarka, lagu ciyaaro hal qalab, laguna diyaariyay ciyaar marti ah.",
} as const;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal(appMetadata.id),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export {
  compactReplaySchema,
  parseStoredReplay,
  matchPayloadSchema,
  matchPayloadHash,
  MAX_STORED_REPLAY_BYTES,
} from "./match";
export type { MatchPayload } from "./match";

export { matchRatingViewSchema, playerRatingViewSchema } from "./rating";
export type { MatchRatingView } from "./rating";
