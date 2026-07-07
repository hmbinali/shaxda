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

    await expect(
      page.getByRole("link", { name: "Ciyaar qalabkan" }),
    ).toHaveAttribute("href", "/local");
    await expect(
      page.getByRole("link", { name: "Ciyaar marti ah" }),
    ).toHaveAttribute("href", "/online");
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
