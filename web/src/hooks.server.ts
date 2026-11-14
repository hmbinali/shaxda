import { building } from "$app/environment";
import { svelteKitHandler } from "better-auth/svelte-kit";
import type { Handle } from "@sveltejs/kit";
import { getAuth } from "$lib/server/auth";
import {
  accountDeletePath,
  resolveAccountSession,
  restrictPendingAccount,
} from "$lib/server/auth/deletion";

const bypassAuthHook = new Set([
  "/local",
  "/online",
  // Active beacons resolve their session only after the request guards pass.
  "/api/analytics/active",
  "/api/analytics/event",
]);
const matchHistoryRouteIds = new Set(["/history", "/match/[id]"]);

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = null;
  event.locals.user = null;
  event.locals.pendingDeletion = undefined;

  if (building || bypassAuthHook.has(event.route.id ?? "")) {
    return resolve(event);
  }
  if (event.route.id === accountDeletePath) {
    event.setHeaders({
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    });
  }

  const env = event.platform?.env;
  if (env === undefined) {
    throw new Error("Cloudflare platform environment is unavailable.");
  }

  const resolved = await resolveAccountSession(env, event.request.headers);
  event.locals.session = resolved?.session ?? null;
  event.locals.user = resolved?.user ?? null;
  if (resolved?.dueAt != null) {
    event.locals.pendingDeletion = { dueAt: resolved.dueAt };
    const restricted = restrictPendingAccount(event);
    if (restricted) return restricted;
  }

  const response = await svelteKitHandler({
    event,
    resolve,
    auth: getAuth(env),
    building,
  });
  // SvelteKit can skip page loads on partial data requests, including redirects.
  if (
    matchHistoryRouteIds.has(event.route.id ?? "") &&
    response.headers.get("cache-control") !== "no-store"
  ) {
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
};
