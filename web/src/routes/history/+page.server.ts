import { readHistoryPage, readHistorySummary } from "@shaxda/db";
import {
  encodeHistoryCursor,
  historyFilterSchema,
  parseHistoryCursor,
  type HistoryCursor,
  type HistoryFilter,
} from "@shaxda/shared";
import { participantFor } from "$lib/history/presentation";
import { requireCompleteAccount } from "$lib/server/account";
import type { PageServerLoad } from "./$types";

export const prerender = false;

function historyHref(filter: HistoryFilter, cursor?: HistoryCursor): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (cursor) params.set("after", encodeHistoryCursor(cursor));
  const query = params.toString();
  return query ? `/history?${query}` : "/history";
}

export const load: PageServerLoad = async ({
  locals,
  platform,
  setHeaders,
  url,
}) => {
  setHeaders({ "cache-control": "no-store" });
  const user = requireCompleteAccount(locals, "/history");
  const db = platform?.env.DB;
  if (!db) throw new Error("D1 binding is unavailable.");

  const filter = historyFilterSchema.parse(url.searchParams.get("filter"));
  const cursor = parseHistoryCursor(url.searchParams.get("after"));
  const [page, summary] = await Promise.all([
    readHistoryPage(db, { userId: user.id, filter, cursor }),
    cursor === null ? readHistorySummary(db, user.id) : null,
  ]);

  return {
    filter,
    filters: historyFilterSchema.unwrap().options.map((value) => ({
      value,
      href: historyHref(value),
    })),
    rows: page.rows.map(({ opponent, ...row }) => ({
      ...row,
      opponent: participantFor(opponent),
    })),
    summary,
    firstHref: cursor === null ? null : historyHref(filter),
    nextHref:
      page.nextCursor === null ? null : historyHref(filter, page.nextCursor),
  };
};
