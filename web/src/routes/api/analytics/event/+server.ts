import { incrementLocalEvent } from "@shaxda/db/analytics";
import { clientEventSchema, utcDay } from "@shaxda/shared/analytics/events";
import {
  acceptAnalyticsRequest,
  analyticsResponse,
} from "$lib/server/analyticsRequest";
import type { RequestHandler } from "./$types";

export const prerender = false;

export const POST: RequestHandler = async ({ request, platform }) => {
  const now = Date.now();
  const accepted = await acceptAnalyticsRequest(
    request,
    platform?.env,
    clientEventSchema,
  );
  if (accepted instanceof Response) return accepted;

  try {
    await incrementLocalEvent(
      accepted.env.DB,
      accepted.data.event,
      utcDay(now),
      now,
    );
    return analyticsResponse(204);
  } catch {
    return analyticsResponse(503);
  }
};
