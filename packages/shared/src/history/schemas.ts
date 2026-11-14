import { z } from "zod";
import { matchIdSchema } from "../schemas";

export const historyFilterSchema = z
  .enum(["all", "wins", "losses", "draws", "rated", "friendly"])
  .catch("all");

const historyCursorSchema = z.object({
  endedAt: z.number().int().nonnegative(),
  matchId: matchIdSchema,
});

export type HistoryFilter = z.infer<typeof historyFilterSchema>;
export type HistoryCursor = z.infer<typeof historyCursorSchema>;

export function encodeHistoryCursor({
  endedAt,
  matchId,
}: HistoryCursor): string {
  return btoa(`${endedAt}:${matchId}`)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function parseHistoryCursor(value: string | null): HistoryCursor | null {
  if (!value || !/^[A-Za-z0-9_-]{28,50}$/.test(value)) return null;

  try {
    const decoded = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const [timestamp, matchId] = decoded.split(":");
    if (!timestamp || !/^\d+$/.test(timestamp)) return null;

    const parsed = historyCursorSchema.safeParse({
      endedAt: Number(timestamp),
      matchId,
    });
    return parsed.success && encodeHistoryCursor(parsed.data) === value
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
