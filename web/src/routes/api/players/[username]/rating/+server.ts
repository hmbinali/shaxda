import { json } from "@sveltejs/kit";
import { playerRatingViewSchema, usernameSchema } from "@shaxda/shared";
import { readPlayerRating } from "$lib/server/playerRating";
import type { RequestHandler } from "./$types";

export const prerender = false;
const headers = { "cache-control": "no-store" };

export const GET: RequestHandler = async ({ params, platform }) => {
  const username = usernameSchema.safeParse(params.username);
  const rating =
    username.success && platform?.env.DB
      ? await readPlayerRating(platform.env.DB, username.data, Date.now())
      : null;
  return rating
    ? json(playerRatingViewSchema.parse(rating), { headers })
    : json({ error: "player-not-found" }, { status: 404, headers });
};
