import { error } from "@sveltejs/kit";
import { readAnalyticsStats } from "@shaxda/db/analytics";
import {
  UTC_DAY_MS,
  clientEventNames,
  gaugeNames,
  utcDay,
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
    utcDay(today - 34 * UTC_DAY_MS),
    utcDay(today),
    [...clientEventNames.options, ...gaugeNames.options],
  );

  return {
    ...stats,
    days: Array.from({ length: 30 }, (_, index) =>
      utcDay(today - (index + 1) * UTC_DAY_MS),
    ),
    todayDay: utcDay(today),
  };
}) satisfies PageServerLoad;
