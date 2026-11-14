import { recordActivity } from "@shaxda/db/analytics";
import { activeBeaconSchema, utcDay } from "@shaxda/shared/analytics/events";
import { analyticsHash, hasAnalyticsSalt } from "@shaxda/shared/analytics/hash";
import {
  acceptAnalyticsRequest,
  analyticsResponse,
} from "$lib/server/analyticsRequest";
import { resolveAccountSession } from "$lib/server/auth/deletion";
import type { RequestHandler } from "./$types";

export const prerender = false;

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  const now = Date.now();
  const accepted = await acceptAnalyticsRequest(
    request,
    platform?.env,
    activeBeaconSchema,
  );
  if (accepted instanceof Response) return accepted;

  const { env, data } = accepted;
  const salt = env.ANALYTICS_SALT;
  if (!hasAnalyticsSalt(salt)) return analyticsResponse(503);

  try {
    const resolved = await resolveAccountSession(env, request.headers);
    const active = resolved?.dueAt === null ? resolved : null;
    locals.session = active?.session ?? null;
    locals.user = active?.user ?? null;

    const user = locals.user;
    const day = utcDay(now);
    const [guestHash, accountHash] = await Promise.all([
      analyticsHash(salt, "guest", data.guestId),
      user === null ? null : analyticsHash(salt, "account", user.id),
    ]);
    await recordActivity(env.DB, day, [
      { anonId: guestHash, kind: "guest" },
      ...(accountHash === null
        ? []
        : [{ anonId: accountHash, kind: "account" as const }]),
    ]);
    return analyticsResponse(200, {
      day,
      identity:
        user === null
          ? "guest"
          : user.username
            ? `account:${user.username}`
            : "account",
    });
  } catch {
    return analyticsResponse(503);
  }
};
