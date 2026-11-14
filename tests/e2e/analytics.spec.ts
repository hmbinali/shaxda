import { expect, test } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";
import { ledgerQuery } from "./fixtures/ledger";

test("runs the analytics job through the wrapped Worker without exposing its entries", async ({
  request,
}) => {
  for (const path of ["/_worker.js", "/_kit_worker.js"]) {
    expect((await request.get(path)).status()).toBe(404);
  }

  // Each tick advances a bounded step when earlier tests left ledger rows.
  await expect
    .poll(
      async () => {
        const response = await request.get("/cdn-cgi/handler/scheduled", {
          params: { cron: "15 0 * * *" },
        });
        expect(response.ok()).toBe(true);
        return ledgerQuery<{
          last_success_at: number | null;
          last_error: string | null;
        }>(
          "SELECT last_success_at, last_error FROM job_state WHERE name = 'x1.nightly'",
        );
      },
      { timeout: 60_000 },
    )
    .toEqual([{ last_success_at: expect.any(Number), last_error: null }]);
});

test("records an active browser once across a reload", async ({ page }) => {
  const active = "/api/analytics/active";
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(active)) requests.push(request.url());
  });
  const beacon = page.waitForResponse((response) =>
    response.url().endsWith(active),
  );
  await page.goto("/");
  const recorded = await beacon;
  expect(recorded.status()).toBe(200);
  const { day } = await recorded.json();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("shaxda:analytics-active:v1")),
    )
    .toBe(JSON.stringify({ guest: day }));

  await page.reload();
  // Root onMount also starts service worker registration.
  await page.waitForFunction(() =>
    navigator.serviceWorker.getRegistration().then(Boolean),
  );
  expect(requests).toHaveLength(1);
});

test("admin stats returns forbidden for a signed-in fixture without access", async ({
  page,
  context,
}) => {
  const account = await seedAccount(context);
  try {
    const response = await page.goto("/admin/stats");
    expect(response?.status()).toBe(403);
    expect(response?.headers()["cache-control"]).toBe("no-store");
    await expect(
      page.getByRole("heading", { name: "Boggan waa xiran yahay" }),
    ).toBeVisible();
  } finally {
    account.cleanup();
  }
});
