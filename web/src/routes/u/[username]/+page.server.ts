import { error, redirect } from "@sveltejs/kit";
import { resolveProfile } from "@shaxda/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  params,
  platform,
  setHeaders,
}) => {
  if (platform?.env.DB === undefined)
    throw new Error("D1 binding is unavailable.");
  const outcome = await resolveProfile(platform.env.DB, params.username);
  if (outcome.kind === "missing") error(404, "profile-not-found");
  if (outcome.kind === "alias") {
    setHeaders({ "cache-control": "no-store" });
    redirect(302, `/u/${encodeURIComponent(outcome.currentUsername)}`);
  }
  return { profile: outcome.profile };
};
