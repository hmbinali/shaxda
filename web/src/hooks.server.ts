import { building } from "$app/environment";
import { svelteKitHandler } from "better-auth/svelte-kit";
import type { Handle } from "@sveltejs/kit";
import { getAuth } from "$lib/server/auth";

const prerenderedGameRouteIds = new Set(["/local", "/online"]);

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = null;
  event.locals.user = null;

  if (building || prerenderedGameRouteIds.has(event.route.id ?? "")) {
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
