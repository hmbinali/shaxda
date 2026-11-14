import { z } from "zod";

const seatRatingSchema = z.strictObject({
  before: z.number().int(),
  after: z.number().int(),
  delta: z.number().int(),
  provisional: z.boolean(),
});

const common = { updating: z.boolean(), corrected: z.boolean() };
export const matchRatingViewSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...common,
    status: z.literal("pending"),
    reason: z.null(),
    seats: z.null(),
  }),
  z.strictObject({
    ...common,
    status: z.literal("held"),
    reason: z.null(),
    seats: z.null(),
  }),
  z.strictObject({
    ...common,
    status: z.literal("skipped"),
    reason: z.enum(["friendly", "pairCap", "invalidated"]),
    seats: z.null(),
  }),
  z.strictObject({
    ...common,
    status: z.literal("processed"),
    reason: z.null(),
    seats: z.strictObject({ A: seatRatingSchema, B: seatRatingSchema }),
  }),
]);

export type MatchRatingView = z.infer<typeof matchRatingViewSchema>;

export const playerRatingViewSchema = z.discriminatedUnion("rated", [
  z.strictObject({ rated: z.literal(false) }),
  z.strictObject({
    rated: z.literal(true),
    rating: z.number().int(),
    provisional: z.boolean(),
  }),
]);

export type PlayerRatingView = z.infer<typeof playerRatingViewSchema>;
