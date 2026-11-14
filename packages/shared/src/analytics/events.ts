import { z } from "zod";
import { guestIdSchema } from "../schemas";
import { usernameSchema } from "../account/username";

export const clientEventNames = z.enum(["local_started", "local_completed"]);
export type ClientEventName = z.infer<typeof clientEventNames>;

export const gaugeNames = z.enum([
  "active_browsers_1d",
  "active_browsers_7d",
  "active_browsers_30d",
  "active_accounts_1d",
  "active_accounts_7d",
  "active_accounts_30d",
  "registrations",
  "saved_rated",
  "saved_friendly",
  "week_players",
  "week_returning",
  "cohort_size",
  "cohort_d7",
  "cohort_d30",
  "cohort_within_7d",
]);

export const activeBeaconSchema = z.strictObject({
  v: z.literal(1),
  guestId: guestIdSchema,
});

export const clientEventSchema = z.strictObject({
  v: z.literal(1),
  event: clientEventNames,
});

export const analyticsDaySchema = z.iso.date();
export const activeIdentitySchema = z.union([
  z.literal("guest"),
  z.literal("account"),
  z.templateLiteral(["account:", usernameSchema]),
]);
export type ActiveIdentity = z.infer<typeof activeIdentitySchema>;

export const activeBeaconResponseSchema = z.strictObject({
  day: analyticsDaySchema,
  identity: activeIdentitySchema,
});

export const UTC_DAY_MS = 86_400_000;

export function utcDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function utcWeekStart(day: number): number {
  const weekday = new Date(day).getUTCDay();
  return day - ((weekday + 6) % 7) * UTC_DAY_MS;
}
