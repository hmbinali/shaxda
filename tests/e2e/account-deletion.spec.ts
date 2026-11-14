import { expect, test } from "@playwright/test";
import { executeE2eD1, seedAccount, signInFixture } from "./fixtures/auth";
import { ledgerQuery } from "./fixtures/ledger";
import { seedMatches } from "./fixtures/match";
import { placeOnline, resignOnline } from "./fixtures/online";

test("requests deletion, gates the account, and restores access on cancellation", async ({
  page,
  context,
}) => {
  const account = await seedAccount(context, { alias: "deletion_alias" });
  try {
    await page.goto("/account");
    await page.getByRole("link", { name: "Tirtir akoonkayga" }).click();
    await page
      .getByRole("textbox", { name: /Qor magacaaga/ })
      .fill(account.username!);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Codso tirtiridda" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Codsiga waa la kaydiyay",
    );
    await expect(page.locator("time")).toHaveAttribute("datetime", /T.*Z$/);
    expect(
      (await context.cookies()).some(({ name }) =>
        name.endsWith("session_token"),
      ),
    ).toBe(false);
    expect((await page.request.get("/u/deletion_alias")).status()).toBe(404);
    await signInFixture(context, account.id);
    expect((await page.request.get("/api/online/identity")).status()).toBe(403);
    await page.goto("/history");
    await expect(page).toHaveURL(/\/account\/delete$/);
    await page.getByRole("button", { name: "Ka noqo tirtiridda" }).click();
    await expect(page.getByRole("status")).toContainText("Waad ka noqotay");
    expect((await page.request.get(`/u/${account.username}`)).status()).toBe(
      200,
    );
    expect((await page.request.get("/api/online/identity")).status()).toBe(200);
  } finally {
    account.cleanup();
  }
});

test("requires a recent session and initiates Google reauthentication", async ({
  page,
  context,
}) => {
  const account = await seedAccount(context, { complete: false });
  try {
    executeE2eD1(
      `UPDATE session SET created_at = created_at - 900001 WHERE user_id='${account.id}'`,
    );
    const response = await page.request.post("/account/delete?/request", {
      headers: { Origin: "https://example.test" },
      form: { confirm: account.email, acknowledge: "on" },
    });
    expect(response.status()).toBe(403);
    await page.goto("/account/delete");
    const pageOrigin = new URL(page.url()).origin;
    const stale = await page.request.post("/account/delete?/request", {
      headers: { Origin: pageOrigin, Accept: "application/json" },
      form: { confirm: account.email, acknowledge: "on" },
    });
    expect(await stale.json()).toMatchObject({ type: "failure", status: 403 });
    const google = await page.request.post("/account/delete?/reauth", {
      headers: { Origin: pageOrigin, Accept: "text/html" },
      form: {},
      maxRedirects: 0,
    });
    expect(google.status()).toBe(303);
    expect(new URL(google.headers().location).hostname).toBe(
      "accounts.google.com",
    );
    expect(
      (await context.cookies()).find(
        ({ name }) => name === "shaxda-delete-reauth",
      ),
    ).toMatchObject({
      httpOnly: true,
      sameSite: "Lax",
      path: "/account/delete",
    });
  } finally {
    account.cleanup();
  }
});

test("keeps a grace-period game and neutralizes the saved seat after finalization", async ({
  browser,
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const opponent = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  const rated = await seedMatches(a.id, b.id, 1, { rated: true });
  try {
    const bPage = await opponent.newPage();
    await page.goto("/online");
    await expect(page.getByTestId("online-account-identity")).toBeVisible();
    await page.getByTestId("create-room").click();
    await bPage.goto(await page.getByTestId("share-link").inputValue());
    await expect(bPage.getByTestId("online-board")).toBeVisible();
    const pages = { A: page, B: bPage };
    await placeOnline(pages, "O1");

    const settings = await opponent.newPage();
    await settings.goto("/account/delete");
    await settings
      .getByRole("textbox", { name: /Qor magacaaga/ })
      .fill(b.username!);
    await settings.getByRole("checkbox").check();
    await settings.getByRole("button", { name: "Codso tirtiridda" }).click();
    await expect(settings.getByRole("status")).toContainText(
      "Codsiga waa la kaydiyay",
    );
    await resignOnline(bPage);
    await expect(page.getByTestId("online-game-result")).toBeVisible();
    let matchId = "";
    await expect
      .poll(
        () => {
          const [row] = ledgerQuery<{ match_id: string }>(
            `SELECT mp.match_id FROM match_player mp JOIN match m ON m.id = mp.match_id
             WHERE mp.user_id = '${b.id}' AND m.rated = 0 ORDER BY mp.ended_at DESC LIMIT 1`,
          );
          matchId = row?.match_id ?? "";
          return matchId;
        },
        { timeout: 20_000 },
      )
      .not.toBe("");
    await settings.close();

    const earlier = Date.now() - 8 * 86_400_000;
    executeE2eD1(`UPDATE user SET deletion_requested_at=${earlier},
      deletion_due_at=${earlier + 7 * 86_400_000} WHERE id='${b.id}'`);
    const tick = await page.request.get("/cdn-cgi/handler/scheduled", {
      params: { cron: "16 0 * * *" },
    });
    expect(tick.ok()).toBe(true);
    await expect
      .poll(
        () =>
          ledgerQuery<{ deleted_at: number }>(
            `SELECT deleted_at FROM user WHERE id='${b.id}'`,
          )[0]?.deleted_at,
      )
      .toEqual(expect.any(Number));
    await page.goto(`/match/${matchId}`);
    await expect(
      page.getByText("Xubin la tirtiray", { exact: true }),
    ).toBeVisible();
    expect(await page.content()).not.toContain(b.username!);
    expect((await opponent.request.get(`/match/${matchId}`)).status()).toBe(
      404,
    );
    const publicPage = await opponent.newPage();
    await publicPage.goto(`/match/${rated.ids[0]}`);
    await expect(publicPage).toHaveTitle(/Xubin la tirtiray/);
    expect(await publicPage.content()).not.toContain(b.username!);
  } finally {
    await opponent.close();
    rated.cleanup();
    a.cleanup();
    b.cleanup();
  }
});
