import { expect, test } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";
import { expectMissingMatch } from "./fixtures/history";
import { seedMatches } from "./fixtures/match";

test("keeps history owner-only and preserves filters across pagination", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login\?returnTo=\/history$/);
  const opponentContext = await browser.newContext();
  const owner = await seedAccount(context);
  const opponent = await seedAccount(opponentContext, {
    alias: "history_old_name",
  });
  try {
    await page.goto("/account");
    await page.getByRole("link", { name: "Ciyaarahayga" }).click();
    await expect(page.getByText("Weli ciyaar lama kaydin")).toBeVisible();
    const seeded = await seedMatches(owner.id, opponent.id, 25);
    try {
      const response = await page.goto("/history");
      expect(response?.headers()["cache-control"]).toBe("no-store");
      expect(await response?.text()).not.toContain(owner.id);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex",
      );
      await expect(
        page.getByText("Dhammaan ciyaarahaaga la kaydiyay"),
      ).toBeVisible();
      const rows = page.getByTestId("history-row");
      await expect(rows).toHaveCount(20);
      await expect(
        rows.first().locator(`a[href="/u/${opponent.username}"]`),
      ).toBeVisible();
      await expect(page.locator('a[href="/u/history_old_name"]')).toHaveCount(
        0,
      );
      await page.getByRole("link", { name: "Ciyaaro ka hor" }).click();
      await expect(rows).toHaveCount(5);
      await expect(
        page.getByText("Dhammaan ciyaarahaaga la kaydiyay"),
      ).toHaveCount(0);
      await page.getByRole("link", { name: "Guulaha" }).click();
      await expect(rows).toHaveCount(9);
      await expect(rows.first()).toContainText("Guul");
      await page.getByRole("link", { name: "Tartan", exact: true }).click();
      await expect(
        page.getByText("Shaandhadan ciyaar kuma jirto."),
      ).toBeVisible();
    } finally {
      seeded.cleanup();
    }
  } finally {
    await opponentContext.close();
    owner.cleanup();
    opponent.cleanup();
  }
});

test("gates friendly HTML and data, shares rated pages, and excludes matches from the PWA cache", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const anonymous = await browser.newContext();
  const outsider = await browser.newContext();
  const opponentContext = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponentContext);
  const c = await seedAccount(outsider);
  const friendly = await seedMatches(a.id, b.id, 1);
  const rated = await seedMatches(a.id, b.id, 1, { rated: true });
  const id = friendly.ids[0]!;
  const ratedId = rated.ids[0]!;
  let opponentDeleted = false;
  try {
    await expectMissingMatch(anonymous.request, id);
    const partial = await anonymous.request.get(
      `/match/${id}/__data.json?x-sveltekit-invalidated=10`,
    );
    expect(partial.headers()["cache-control"]).toBe("no-store");
    await expectMissingMatch(outsider.request, id);
    const response = await page.goto(`/match/${id}?a=12`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toBe("no-store");
    await expect(page).toHaveTitle("Ciyaar Shaxda ah | Shaxda");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
    const head = await page.locator("head").innerHTML();
    expect(head).not.toContain(a.username);
    expect(head).not.toContain(b.username);
    expect(head).not.toMatch(/guuleystay|guuldarro/i);
    await expect(page.getByTestId("match-player-A")).toContainText("(Adiga)");
    await expect(page.getByTestId("match-player-B")).not.toContainText(
      "(Adiga)",
    );
    await expect(
      page.getByText("Ciyaartan waxaa arki kara labada ciyaaryahan oo keliya."),
    ).toBeVisible();
    await expect(page.getByTestId("share-match")).toHaveCount(0);

    await page.goto("/local");
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then(() => undefined),
    );
    await page.goto("/history");
    await page.goto(`/match/${id}`);
    const entries = await page.evaluate(async () => {
      const names = await caches.keys();
      const lists = await Promise.all(
        names.map(async (name) => (await caches.open(name)).keys()),
      );
      return lists.flatMap((keys) =>
        keys.map((key) => new URL(key.url).pathname),
      );
    });
    expect(
      entries.some((path) => /^\/(match\/|history(?:\/|$))/.test(path)),
    ).toBe(false);
    const sw = await context.request.get("/sw.js");
    expect(await sw.text()).not.toMatch(/url:\s*["']\/?(?:history|match\/)/);
    await context.setOffline(true);
    try {
      await expect(page.reload({ timeout: 7000 })).rejects.toThrow();
    } finally {
      await context.setOffline(false);
    }

    const publicPage = await anonymous.newPage();
    await anonymous.grantPermissions(["clipboard-read", "clipboard-write"]);
    await publicPage.addInitScript(() =>
      Object.defineProperty(navigator, "share", { value: undefined }),
    );
    await publicPage.goto(`/match/${ratedId}`);
    await expect(
      publicPage.locator('meta[property="og:title"]'),
    ).toHaveAttribute("content", `@${a.username} iyo @${b.username} | Shaxda`);
    await expect(
      publicPage.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", /ka guuleystay/);
    await expect(publicPage.locator('meta[name="robots"]')).toHaveCount(0);
    const status = publicPage.getByRole("status", {
      name: "Xaaladda wadaagista",
    });
    await expect(async () => {
      await publicPage.getByTestId("share-match").click();
      await expect(status).toHaveText(
        "Xiriiriyaha ciyaarta waa la koobiyeeyay.",
        { timeout: 1_000 },
      );
    }).toPass({ timeout: 10_000 });
    expect(
      await publicPage.evaluate(() => navigator.clipboard.readText()),
    ).toBe(`${baseURL}/match/${ratedId}`);

    b.cleanup();
    opponentDeleted = true;
    await publicPage.reload();
    await expect(publicPage.getByTestId("match-player-B")).toContainText(
      "Xubin la tirtiray",
    );
    await expect(
      publicPage.getByTestId("match-player-B").locator("a, img"),
    ).toHaveCount(0);
    await expect(
      publicPage.locator('meta[property="og:title"]'),
    ).toHaveAttribute(
      "content",
      `@${a.username} iyo Xubin la tirtiray | Shaxda`,
    );
    await page.goto("/history");
    await expect(page.getByTestId("history-row").first()).toContainText(
      "Xubin la tirtiray",
    );
  } finally {
    await Promise.all([
      anonymous.close(),
      outsider.close(),
      opponentContext.close(),
    ]);
    friendly.cleanup();
    rated.cleanup();
    a.cleanup();
    if (!opponentDeleted) b.cleanup();
    c.cleanup();
  }
});
