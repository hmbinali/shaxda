import { expect, test, type APIRequestContext } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";
import { inviteRoomCode } from "./fixtures/ledger";
import { seedMatches } from "./fixtures/match";
import { isolateRoomQuota, placeOnline, resignOnline } from "./fixtures/online";

const unknownId = "Y".repeat(20);

async function expectMissingMatch(request: APIRequestContext, id: string) {
  for (const suffix of ["", "/__data.json"]) {
    const [denied, unknown] = await Promise.all(
      [id, unknownId].map((matchId) =>
        request.get(`/match/${matchId}${suffix}`),
      ),
    );
    // SvelteKit carries loader error codes in the data response's error node.
    expect(denied!.status()).toBe(unknown!.status());
    expect(denied!.headers()["cache-control"]).toBe("no-store");
    expect(unknown!.headers()["cache-control"]).toBe("no-store");
    const body = await denied!.text();
    expect(body.replaceAll(id, unknownId)).toBe(await unknown!.text());
    if (suffix) expect(body).toContain('"status":404');
    else expect(denied!.status()).toBe(404);
  }
}

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

test("opens a real saved account game from both overlays and histories", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90_000);
  await isolateRoomQuota(page, 13);
  const opponent = await browser.newContext();
  const guest = await browser.newContext();
  const outsider = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  const c = await seedAccount(outsider);
  try {
    const bPage = await opponent.newPage();
    await page.goto("/online");
    await expect(page.getByTestId("online-account-identity")).toBeVisible();
    await page.getByTestId("create-room").click();
    const invite = await page.getByTestId("share-link").inputValue();
    await bPage.goto(invite);
    const pages = { A: page, B: bPage };
    await placeOnline(pages, "O1");
    await placeOnline(pages, "O2");
    await resignOnline(page);
    const hrefs: string[] = [];
    for (const player of Object.values(pages)) {
      const link = player.getByTestId("online-view-match");
      await expect(link).toBeVisible();
      await expect(player.getByTestId("online-rematch")).toBeFocused();
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^\/match\/[A-Z2-9]{20}$/);
      hrefs.push(href!);
      await link.click();
      await expect(player.getByRole("heading", { level: 1 })).toContainText(
        `@${b.username}`,
      );
      await expect(
        player.getByText("Ciyaaryahan ayaa is dhiibay."),
      ).toBeVisible();
      await expect(
        player.getByRole("link", { name: `@${a.username}` }),
      ).toBeVisible();
      await player.goto("/history");
      const row = player
        .getByTestId("history-row")
        .filter({ has: player.locator(`a[href="${href}"]`) });
      await expect(row).toContainText(player === page ? "Guuldarro" : "Guul");
      await expect(row).toContainText("Saaxiibtinimo");
      const data = await player.request.get(`${href}/__data.json`);
      expect(data.headers()["cache-control"]).toBe("no-store");
      const serialized = await data.text();
      for (const value of [
        a.id,
        b.id,
        a.email,
        b.email,
        inviteRoomCode(invite),
      ]) {
        expect(serialized).not.toContain(value);
      }
    }
    expect(hrefs[0]).toBe(hrefs[1]);
    const id = hrefs[0]!.split("/").pop()!;
    await expectMissingMatch(guest.request, id);
    await expectMissingMatch(outsider.request, id);
  } finally {
    await Promise.all([opponent.close(), guest.close(), outsider.close()]);
    a.cleanup();
    b.cleanup();
    c.cleanup();
  }
});
