import type { D1Database } from "@cloudflare/workers-types";
import {
  onlineCounterNameSchema,
  type OnlineCounterName,
} from "@shaxda/shared/analytics/events";
import { incrementDailyEvent } from "./increment";

export async function incrementCounter(
  db: D1Database,
  name: OnlineCounterName,
  day: string,
  now: number,
): Promise<void> {
  await incrementDailyEvent(db, onlineCounterNameSchema.parse(name), day, now);
}
