import { incrementCounter } from "@shaxda/db/counters";
import {
  utcDay,
  type OnlineCounterName,
} from "@shaxda/shared/analytics/events";

export interface OnlineCounterEnv {
  ANALYTICS_ENABLED?: string;
  DB?: D1Database;
}

export function recordOnlineCounter(
  env: OnlineCounterEnv,
  ctx: Pick<ExecutionContext, "waitUntil">,
  name: OnlineCounterName,
  now: number,
): void {
  if (env.ANALYTICS_ENABLED !== "true") return;
  const db = env.DB;
  if (!db) {
    console.warn("analyticsCounterFailed", {
      name,
      errorClass: "MissingBinding",
    });
    return;
  }
  ctx.waitUntil(
    incrementCounter(db, name, utcDay(now), now).catch((error: unknown) => {
      console.warn("analyticsCounterFailed", {
        name,
        errorClass: error instanceof Error ? error.name : "UnknownError",
      });
    }),
  );
}
