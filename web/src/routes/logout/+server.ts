import { error, redirect } from "@sveltejs/kit";
import { getAuth } from "$lib/server/auth";
import { canonicalAuthOrigin } from "$lib/server/auth/options";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ platform, request }) => {
  if (platform?.env === undefined)
    throw new Error("Cloudflare platform is unavailable.");
  const origin = request.headers.get("origin");
  if (
    origin !== null &&
    origin !== canonicalAuthOrigin(platform.env.AUTH_BASE_URL)
  ) {
    error(403, "cross-origin-request");
  }

  await getAuth(platform.env).api.signOut({ headers: request.headers });
  redirect(303, "/");
};
