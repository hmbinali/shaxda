import { building } from "$app/environment";
import { svelteKitHandler } from "better-auth/svelte-kit";
import type { Handle } from "@sveltejs/kit";
import { getAuth } from "$lib/server/auth";

const bypassAuthHook = new Set([
  "/local",
  "/online",
  // Active beacons resolve their session only after the request guards pass.
  "/api/analytics/active",
  "/api/analytics/event",
]);

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = null;
  event.locals.user = null;

  if (building || bypassAuthHook.has(event.route.id ?? "")) {
    return resolve(event);
  }

  const env = event.platform?.env;
  if (env === undefined) {
    throw new Error("Cloudflare platform environment is unavailable.");
  }

  const auth = getAuth(env);
  const resolved = await auth.api.getSession({
    headers: event.request.headers,
  });
  event.locals.session = resolved?.session ?? null;
  event.locals.user = resolved?.user ?? null;

  return svelteKitHandler({ event, resolve, auth, building });
};
