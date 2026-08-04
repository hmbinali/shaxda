import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", heading: "Shaxda" },
  { path: "/learn", heading: "Baro shaxda" },
  { path: "/legal", heading: "Sharciga iyo asturnaanta" },
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
        /Shaxda|Baro shaxda|Sharciga/,
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
        /Shaxda|Baro shaxda|Sharciga/,
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

  test("the global top bar persists while account navigation changes routes", async ({
    page,
  }) => {
    await page.goto("/");
    const topBar = page.getByTestId("app-top-bar");
    await topBar.evaluate((element) => {
      element.setAttribute("data-persistence-check", "present");
    });

    await page.getByRole("button", { name: "Fur liiska akoonka" }).click();
    await page
      .getByRole("menu", { name: "Liiska akoonka" })
      .getByRole("menuitem", { name: "Baro xeerarka" })
      .click();

    await expect(page).toHaveURL(/\/learn$/);
    await expect(
      page.getByRole("heading", { name: "Baro shaxda", exact: true }),
    ).toBeVisible();
    await expect(topBar).toHaveAttribute("data-persistence-check", "present");
    await expect(
      topBar.getByRole("button", { name: "Fur liiska akoonka" }),
    ).toHaveCount(0);
  });

  test("desktop uses the compact account panel without taking layout width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const main = page.locator("#main-content");
    const mainWidthBefore = await main.evaluate(
      (element) => element.getBoundingClientRect().width,
    );

    expect(await page.getByTestId("desktop-sidebar").count()).toBe(0);
    await expect(page.getByRole("button", { name: "Fur hagaha" })).toHaveCount(
      0,
    );
    const accountButton = page.getByRole("button", {
      name: "Fur liiska akoonka",
    });
    await accountButton.click();
    const panel = page.getByRole("menu", { name: "Liiska akoonka" });
    await expect(panel).toBeVisible();
    await expect(main).toHaveCSS("overflow-y", "auto");
    const mainWidthWithPanel = await main.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    expect(mainWidthWithPanel).toBe(mainWidthBefore);

    for (const name of [
      "Gal",
      "Isdiiwaangeli",
      "Baro xeerarka",
      "Caawin",
      "Sharciga",
    ]) {
      await expect(
        panel.getByRole("menuitem", { name, exact: true }),
      ).toBeVisible();
    }

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(main).toHaveCSS("overflow-y", "auto");
    await expect(accountButton).toBeFocused();
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

  test("learn page includes every required draw, win, and jare-line group", async ({
    page,
  }) => {
    await page.goto("/learn");

    await expect(page.getByText(/16 sadar oo jare ah/)).toBeVisible();
    await expect(
      page.getByText(/4 dhinac oo afar-geeska dibadda ah/),
    ).toBeVisible();
    await expect(page.getByText(/4 kan dhexe ah/)).toBeVisible();
    await expect(page.getByText(/4 kan gudaha ah/)).toBeVisible();
    await expect(
      page.getByText(/4 khad oo bartamaha dhinacyada/),
    ).toBeVisible();
    await expect(page.getByText(/80 wareeg/)).toBeVisible();
    await expect(page.getByText(/3 jeer soo noqda/)).toBeVisible();
    await expect(page.getByText(/wax ka yar 3 dhagax/)).toBeVisible();
    await expect(
      page.getByText(
        /Jare la sameeyo xilliga dhigista qabasho ama ka saarid ma keeno/,
      ),
    ).toBeVisible();
  });

  test("retired rules route returns a Somali 404 page", async ({ page }) => {
    const response = await page.goto("/rules");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Bogga lama helin" }),
    ).toBeVisible();
    await expect(page.getByText("Not Found", { exact: true })).toHaveCount(0);
  });

  for (const route of ["/privacy", "/terms"] as const) {
    test(`${route} is retired and returns the Somali 404 page`, async ({
      page,
    }) => {
      const response = await page.goto(route);

      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { name: "Bogga lama helin" }),
      ).toBeVisible();
      await expect(page.getByText("Not Found", { exact: true })).toHaveCount(0);
    });
  }

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
