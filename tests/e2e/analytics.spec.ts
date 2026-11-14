import { expect, test } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";

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
