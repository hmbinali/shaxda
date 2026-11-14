import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { getPlatformProxy } from "wrangler";
import { processPendingRatings } from "@shaxda/db/rating";
import {
  applyRatingAdmin,
  planRatingAdmin,
  readRatingSnapshot,
  verifyRebuild,
  type AdminRequest,
} from "@shaxda/db/rating-admin";
import { seedAccount } from "./fixtures/auth";
import { inviteRoomCode, ledgerQuery } from "./fixtures/ledger";
import { placeOnline, resignOnline } from "./fixtures/online";

test("shows confirmed ratings and a correction for a played rated match", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const opponent = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  const proxy = await getPlatformProxy<{
    DB: Parameters<typeof processPendingRatings>[0];
  }>({
    configPath: resolve("web/wrangler.e2e.jsonc"),
    persist: { path: resolve("test-results/wrangler-e2e/v3") },
    envFiles: [],
    remoteBindings: false,
  });
  try {
    const joiner = await opponent.newPage();
    await page.goto("/online");
    await expect(page.getByTestId("online-account-identity")).toBeVisible();
    await page.getByRole("radio", { name: "Tartan", exact: true }).check();
    await page.getByTestId("create-room").click();
    const share = await page.getByTestId("share-link").inputValue();
    const code = inviteRoomCode(share);
    await joiner.goto(share);
    await joiner.getByRole("button", { name: "Aqbal Tartan" }).click();
    await expect(page.getByTestId("online-match-mode")).toContainText(
      "labadiinnaba",
    );
    const pages = { A: page, B: joiner };
    for (const point of ["O1", "M1", "I1"] as const)
      await placeOnline(pages, point);
    await resignOnline(joiner);
    await expect(page.getByTestId("online-board")).toHaveAttribute(
      "data-save-status",
      "saved",
    );
    const pending = page.getByTestId("match-rating-pending");
    await expect(pending).toBeVisible();

    const [{ id } = { id: "" }] = ledgerQuery<{ id: string }>(
      `SELECT id FROM match WHERE rated = 1 AND room_code = '${code}'`,
    );
    expect(id).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$/);
    const { DB: db } = proxy.env;
    while ((await processPendingRatings(db)) === 25) {
      /* drain older friendly rows */
    }
    const numbers = page.getByTestId("match-rating-confirmed");
    await expect(numbers).toContainText("+162");
    await expect(numbers).toContainText("−162");
    expect(verifyRebuild(await readRatingSnapshot(db)).diffs).toEqual([]);
    const statusPath = `/api/matches/${id}/rating`;
    const publicResult = await browser.newContext();
    try {
      const response = await publicResult.request.get(
        new URL(statusPath, page.url()).href,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toMatchObject({
        status: "processed",
        seats: {
          A: { before: 1500, after: 1662 },
          B: { before: 1500, after: 1338 },
        },
      });
      const request: AdminRequest = {
        command: "invalidate-match",
        target: id,
        actor: "e2e",
        environment: "local",
        databaseId: "isolated-e2e",
        reason: "Confirm correction handling",
      };
      const plan = await planRatingAdmin(db, request);
      expect(await applyRatingAdmin(db, request, plan.digest)).toMatchObject({
        outcome: "applied",
      });
      const corrected = await publicResult.request.get(
        new URL(statusPath, page.url()).href,
      );
      expect(await corrected.json()).toMatchObject({
        status: "skipped",
        reason: "invalidated",
        seats: null,
        corrected: false,
      });
      expect(verifyRebuild(await readRatingSnapshot(db)).diffs).toEqual([]);
    } finally {
      await publicResult.close();
    }
  } finally {
    await proxy.dispose();
    await opponent.close();
    a.cleanup();
    b.cleanup();
  }
});
