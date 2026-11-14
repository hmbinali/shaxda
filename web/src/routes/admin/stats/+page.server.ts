import { error } from "@sveltejs/kit";
import { readAnalyticsStats } from "@shaxda/db/analytics";
import {
  UTC_DAY_MS,
  clientEventNames,
  gaugeNames,
  onlineFunnelNames,
  utcDay,
  utcWeekStart,
} from "@shaxda/shared/analytics/events";
import { requireAdmin } from "$lib/server/admin";
import type { PageServerLoad } from "./$types";

export const prerender = false;

export const load = (async ({ locals, platform, setHeaders, url }) => {
  setHeaders({ "cache-control": "no-store", "x-robots-tag": "noindex" });
  const env = platform?.env;
  requireAdmin(locals, env, url);
  if (!env?.DB) error(503);

  const today = Date.parse(utcDay(Date.now()));
  const stats = await readAnalyticsStats(
    env.DB,
    utcDay(utcWeekStart(today) - 49 * UTC_DAY_MS),
    utcDay(today),
    [...clientEventNames.options, ...gaugeNames.options, ...onlineFunnelNames],
  );

  return {
    ...stats,
    days: Array.from({ length: 30 }, (_, index) =>
      utcDay(today - (index + 1) * UTC_DAY_MS),
    ),
    todayDay: utcDay(today),
    weeks: Array.from({ length: 8 }, (_, index) => {
      const monday = utcWeekStart(today) - index * 7 * UTC_DAY_MS;
      return { day: utcDay(monday), mature: monday + 14 * UTC_DAY_MS <= today };
    }),
    cohortWindows: [
      { event: "cohort_d7", delay: 7 },
      { event: "cohort_d30", delay: 30 },
      { event: "cohort_within_7d", delay: 7 },
    ].map(({ event, delay }) => ({
      event,
      pendingDay: utcDay(today - UTC_DAY_MS),
      days: Array.from({ length: 8 }, (_, index) =>
        utcDay(today - (delay + index + 1) * UTC_DAY_MS),
      ),
    })),
  };
}) satisfies PageServerLoad;
