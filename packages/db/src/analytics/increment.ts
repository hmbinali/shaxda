import type { D1Database } from "@cloudflare/workers-types";

export async function incrementDailyEvent(
  db: D1Database,
  event: string,
  day: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO event_daily (day, event, count, updated_at) VALUES (?1, ?2, 1, ?3)
     ON CONFLICT (day, event) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
    )
    .bind(day, event, now)
    .run();
}
