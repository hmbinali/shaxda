import { isProvisional } from "@shaxda/rating";

export async function readPlayerRating(
  db: App.Platform["env"]["DB"],
  username: string,
  asOf: number,
) {
  const row = await db
    .prepare(
      `
    SELECT r.rating, r.rd, r.volatility, r.last_rated_at
      FROM user u LEFT JOIN player_rating r ON r.user_id = u.id
     WHERE u.username = ?
  `,
    )
    .bind(username)
    .first<
      | { rating: null }
      | {
          rating: number;
          rd: number;
          volatility: number;
          last_rated_at: number;
        }
    >();
  if (!row) return null;
  if (row.rating === null) return { rated: false };
  return {
    rated: true,
    rating: Math.round(row.rating),
    provisional: isProvisional(row, row.last_rated_at, asOf),
  };
}
