import { json } from "@sveltejs/kit";
import { readMatchRating } from "@shaxda/db/rating";
import { matchIdSchema, matchRatingViewSchema } from "@shaxda/shared";
import type { RequestHandler } from "./$types";

export const prerender = false;

const headers = { "cache-control": "no-store" };
function missing() {
  return json({ error: "match-not-found" }, { status: 404, headers });
}

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  const id = matchIdSchema.safeParse(params.id);
  if (!id.success || !platform?.env.DB) return missing();
  const rating = await readMatchRating(
    platform.env.DB,
    id.data,
    locals.user?.id ?? null,
  );
  return rating
    ? json(matchRatingViewSchema.parse(rating), { headers })
    : missing();
};
