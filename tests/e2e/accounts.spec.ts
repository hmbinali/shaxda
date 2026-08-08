import { expect, test, type Page } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";
import { openAccountPanel } from "./fixtures/panel";

test("signed-out and incomplete accounts get the correct navigation", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await openAccountPanel(page);
  await expect(page.getByRole("menuitem", { name: "Gal" })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Isdiiwaangeli" }),
  ).toBeVisible();

  const account = await seedAccount(context, { complete: false });
  try {
    await page.reload();
    await openAccountPanel(page);
    await expect(
      page.getByRole("menuitem", { name: "Dhammee isdiiwaangelinta" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Ka bax akoonka" }),
    ).toBeVisible();
  } finally {
    account.cleanup();
  }
});

test("registration never pre-fills a username derived from the private email", async ({
  page,
  context,
}) => {
  const account = await seedAccount(context, { complete: false });
  const emailPrefix = account.email.split("@")[0];
  try {
    await page.goto("/register");
    const username = page.getByRole("textbox");
    const confirm = page.getByRole("button", { name: "Xaqiiji akoonka" });

    await expect(username).toHaveValue("");
    await expect(confirm).toBeDisabled();

    const suggestion = page
      .getByRole("button", { name: new RegExp(`^@${emailPrefix}`) })
      .first();
    await expect(suggestion).toBeVisible();
    const suggested = (await suggestion.textContent())?.trim().slice(1) ?? "";

    // Only an explicit click may move an email-derived name into the field, and
    // the chip is inert until the server-rendered page hydrates.
    await expect(async () => {
      await suggestion.click();
      await expect(username).toHaveValue(suggested, { timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(confirm).toBeEnabled();

    await username.fill("cabdi_shaxda_e2e");
    await expect(confirm).toBeEnabled();
    await username.fill("");
    await expect(confirm).toBeDisabled();
  } finally {
    account.cleanup();
  }
});

test("a complete account resolves through Better Auth and keeps private data private", async ({
  page,
  context,
}) => {
  const account = await seedAccount(context, { alias: "old_e2e_alias" });
  if (account.username === null)
    throw new Error("Expected a complete account.");
  try {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: `@${account.username}` }),
    ).toBeVisible();
    await openAccountPanel(page, `@${account.username}`);
    await expect(
      page.getByRole("menuitem", { name: `@${account.username}` }),
    ).toBeVisible();

    await page.goto("/account");
    await expect(page.getByText(account.email)).toBeVisible();
    await page.goto(`/u/${account.username}`);
    await expect(
      page.getByRole("heading", { name: `@${account.username}` }),
    ).toBeVisible();
    await expect(page.getByText(account.email)).not.toBeVisible();

    await page.goto("/u/old_e2e_alias");
    await expect(page).toHaveURL(new RegExp(`/u/${account.username}$`));

    await page.goto("/login?returnTo=https://evil.example");
    await expect(page).toHaveURL("http://127.0.0.1:4173/");
  } finally {
    account.cleanup();
  }
});

test("auth API reaches the handler and logout clears the session", async ({
  page,
  context,
}) => {
  const response = await page.request.get("/api/auth/get-session");
  expect(response.status()).toBe(200);
  expect(await response.json()).toBeNull();

  const account = await seedAccount(context);
  try {
    await page.goto("/");
    if (account.username === null)
      throw new Error("Expected a complete account.");
    await openAccountPanel(page, `@${account.username}`);
    await page.getByRole("menuitem", { name: "Ka bax akoonka" }).click();
    await expect(page).toHaveURL("http://127.0.0.1:4173/");
    await openAccountPanel(page);
    await expect(page.getByRole("menuitem", { name: "Gal" })).toBeVisible();
  } finally {
    account.cleanup();
  }
});

test("sharing copies the canonical URL of the current username", async ({
  page,
  context,
}) => {
  const account = await seedAccount(context, { alias: "share_e2e_alias" });
  if (account.username === null)
    throw new Error("Expected a complete account.");
  const canonical = `http://127.0.0.1:4173/u/${account.username}`;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  try {
    // An old alias still redirects, and the page it lands on shares only the
    // current username.
    await page.goto("/u/share_e2e_alias");
    await expect(page).toHaveURL(canonical);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonical,
    );

    await share(page, "share-profile", "Xiriiriyaha bogga waa la koobiyeeyay.");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(canonical);
    expect(copied).not.toContain(account.email);
    expect(copied).not.toContain(account.id);
    expect(copied).not.toContain("share_e2e_alias");

    await page.goto("/account");
    await share(
      page,
      "share-my-profile",
      "Xiriiriyaha bogga waa la koobiyeeyay.",
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      canonical,
    );
  } finally {
    account.cleanup();
  }
});

test("the profile share action uses the Web Share sheet when available", async ({
  page,
  context,
}) => {
  const account = await seedAccount(context);
  if (account.username === null)
    throw new Error("Expected a complete account.");
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        (window as unknown as { __shared?: ShareData }).__shared = data;
        return Promise.resolve();
      },
    });
  });
  try {
    await page.goto(`/u/${account.username}`);
    await share(page, "share-profile", "Bogga waa la wadaagay.");

    const shared = await page.evaluate(
      () => (window as unknown as { __shared?: ShareData }).__shared,
    );
    expect(shared?.url).toBe(`http://127.0.0.1:4173/u/${account.username}`);
    expect(JSON.stringify(shared)).not.toContain(account.email);
    expect(JSON.stringify(shared)).not.toContain(account.id);
  } finally {
    account.cleanup();
  }
});

test("unknown public profiles use the Somali 404 page", async ({ page }) => {
  const response = await page.goto("/u/definitely_missing_e2e");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Bogga lama helin" }),
  ).toBeVisible();
});

/**
 * Both share buttons live on server-rendered pages, so a click that lands
 * before hydration does nothing; retry until the status region reports back.
 */
async function share(
  page: Page,
  testId: string,
  expected: string,
): Promise<void> {
  const status = page.getByRole("status", { name: "Xaaladda wadaagista" });
  await expect(async () => {
    await page.getByTestId(testId).click();
    await expect(status).toHaveText(expected, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}
