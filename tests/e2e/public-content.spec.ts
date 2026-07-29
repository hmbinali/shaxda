import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", heading: "Shaxda" },
  { path: "/learn", heading: "Baro shaxda" },
  { path: "/rules", heading: "Xeerarka shaxda" },
  { path: "/privacy", heading: "Asturnaanta" },
  { path: "/terms", heading: "Shuruudaha" },
] as const;

const excludedVisibleTerms = [
  "login",
  "accounts",
  "leaderboard",
  "sponsors",
  "sponsor",
  "ads",
  "payments",
  "payment",
  "affiliate",
  "chat",
  "tournament",
  "language toggle",
];

test.describe("C1 public content", () => {
  for (const route of routes) {
    test(`${route.path} loads with Somali metadata`, async ({ page }) => {
      await page.goto(route.path);

      await expect(
        page.getByRole("heading", { name: route.heading, exact: true }),
      ).toBeVisible();

      const description = page.locator("meta[name='description']");
      await expect(description).toHaveAttribute("content", /.+/);
      await expect(description).not.toHaveAttribute(
        "content",
        /Free Somali shaxda board game/,
      );
      await expect(page.locator("link[rel='canonical']")).toHaveAttribute(
        "href",
        new RegExp(`${route.path === "/" ? "/" : route.path}$`),
      );
      await expect(page.locator("meta[property='og:title']")).toHaveAttribute(
        "content",
        /Shaxda|Baro shaxda|Xeerarka shaxda|Asturnaanta|Shuruudaha/,
      );
      const ogDescription = page.locator("meta[property='og:description']");
      await expect(ogDescription).toHaveAttribute("content", /.+/);
      await expect(ogDescription).not.toHaveAttribute(
        "content",
        /Free Somali shaxda board game/,
      );
      await expect(page.locator("meta[property='og:url']")).toHaveAttribute(
        "content",
        new RegExp(`${route.path === "/" ? "/" : route.path}$`),
      );
      await expect(page.locator("meta[property='og:image']")).toHaveAttribute(
        "content",
        /\/og-image\.png$/,
      );
      await expect(
        page.locator("meta[property='og:image:width']"),
      ).toHaveAttribute("content", "1200");
      await expect(
        page.locator("meta[property='og:image:height']"),
      ).toHaveAttribute("content", "630");
      await expect(
        page.locator("meta[property='og:image:type']"),
      ).toHaveAttribute("content", "image/png");
      await expect(
        page.locator("link[rel='apple-touch-icon']"),
      ).toHaveAttribute("href", /\/apple-touch-icon\.png$/);
      await expect(page.locator("link[rel='icon']")).toHaveAttribute(
        "href",
        /\/favicon\.png$/,
      );
      await expect(page.locator("meta[name='twitter:title']")).toHaveAttribute(
        "content",
        /Shaxda|Baro shaxda|Xeerarka shaxda|Asturnaanta|Shuruudaha/,
      );

      const bodyText = (await page.locator("body").innerText()).toLowerCase();
      expect(bodyText).not.toContain("/en");
      expect(bodyText).not.toContain("language-toggle");

      for (const term of excludedVisibleTerms) {
        expect(bodyText).not.toContain(term);
      }
    });
  }

  test("homepage links to planned play routes without requiring them to exist", async ({
    page,
  }) => {
    await page.goto("/");
    const main = page.locator("#main-content");

    await expect(
      main.getByRole("link", { name: "Ciyaar qalabkan" }),
    ).toHaveAttribute("href", "/local");
    await expect(
      main.getByRole("link", { name: "Ciyaar marti ah" }),
    ).toHaveAttribute("href", "/online");
  });

  test("the global top bar persists while drawer navigation changes routes", async ({
    page,
  }) => {
    await page.goto("/learn");
    const topBar = page.getByTestId("app-top-bar");
    await topBar.evaluate((element) => {
      element.setAttribute("data-persistence-check", "present");
    });

    await page.getByRole("button", { name: "Fur hagaha" }).click();
    const navigation = page.getByRole("navigation", { name: "Hagaha bogga" });

    await expect(
      navigation.getByRole("link", { name: "Baro" }),
    ).toHaveAttribute("aria-current", "page");

    await navigation.getByRole("link", { name: "Ciyaar qalabkan" }).click();

    await expect(page).toHaveURL(/\/local$/);
    await expect(
      page.getByRole("heading", { name: "Ciyaar qalabkan", exact: true }),
    ).toBeVisible();
    await expect(topBar).toHaveAttribute("data-persistence-check", "present");

    await page.getByRole("button", { name: "Fur hagaha" }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Hagaha bogga" })
        .getByRole("link", { name: "Ciyaar qalabkan" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("desktop uses the same overlay drawer without taking layout width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/learn");

    const main = page.locator("#main-content");
    const mainWidthBefore = await main.evaluate(
      (element) => element.getBoundingClientRect().width,
    );

    expect(await page.getByTestId("desktop-sidebar").count()).toBe(0);
    await page.getByRole("button", { name: "Fur hagaha" }).click();
    const drawer = page.getByRole("dialog", { name: "Hagaha bogga" });
    await expect(drawer).toBeVisible();
    await expect(main).toHaveCSS("overflow-y", "hidden");
    const mainWidthWithDrawer = await main.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    expect(mainWidthWithDrawer).toBe(mainWidthBefore);

    for (const name of [
      "Hoy",
      "Ciyaar qalabkan",
      "Ciyaar marti ah",
      "Baro",
      "Xeerarka",
      "Asturnaanta",
      "Shuruudaha",
    ]) {
      await expect(
        drawer.getByRole("link", { name, exact: true }),
      ).toBeVisible();
    }

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(main).toHaveCSS("overflow-y", "auto");
    await expect(
      page.getByRole("button", { name: "Fur hagaha" }),
    ).toBeFocused();
  });

  test("offers a keyboard skip link to the main content", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "U bood nuxurka" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("homepage does not prerender an empty PWA notice region", async ({
    request,
  }) => {
    const response = await request.get("/");

    expect(response.ok()).toBe(true);
    expect(await response.text()).not.toContain('data-testid="pwa-notices"');
  });

  test("rules page includes required draw, win, and jare-line content", async ({
    page,
  }) => {
    await page.goto("/rules");

    await expect(page.getByText("Dhammaan 16-ka sadar ee jare")).toBeVisible();
    await expect(page.getByText("O1 - O2 - O3")).toBeVisible();
    await expect(page.getByText("O8 - M8 - I8")).toBeVisible();
    await expect(page.getByText(/80 dhaqaaq/)).toBeVisible();
    await expect(page.getByText(/saddex jeer soo noqdo/)).toBeVisible();
    await expect(page.getByText(/wax ka yar 3 dhagax/)).toBeVisible();
    await expect(
      page.getByText(/Dhagax lama saaro xilligii dhigista/),
    ).toBeVisible();
  });

  test("manifest uses Somali public copy", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");

    expect(response.ok()).toBe(true);

    const manifest = await response.json();

    expect(manifest.lang).toBe("so");
    expect(manifest.description).toContain("Shaxda");
    expect(manifest.description).toContain("Soomaali");
    expect(manifest.description).not.toContain("Free Somali shaxda board game");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/icon-maskable-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        }),
        expect.objectContaining({
          src: "/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        }),
      ]),
    );
  });
});
