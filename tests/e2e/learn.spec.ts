import { expect, test } from "@playwright/test";

const sectionIds = [
  "bilowga",
  "wejiyada",
  "dhaqdhaqaaqa",
  "jare",
  "irmaan",
  "xannibaad",
  "dhammaadka",
  "talooyin",
  "koobid",
] as const;

test.describe("complete learn guide", () => {
  test("renders nine anchored sections, four groups, and seven teaching frames", async ({
    page,
  }) => {
    await page.goto("/learn");

    const sections = page.locator("[data-learn-section]");
    const renderedIds = await sections.evaluateAll((elements) =>
      elements.map((element) => element.id),
    );

    expect(renderedIds).toEqual(sectionIds);
    expect(new Set(renderedIds).size).toBe(sectionIds.length);
    await expect(page.locator("ol[aria-label]")).toHaveCount(4);
    await expect(page.locator("figure[data-diagram-id]")).toHaveCount(7);

    const irmaanPhoto = page.getByTestId("irmaan-photo");
    const image = irmaanPhoto.locator("img");

    await expect(irmaanPhoto).toHaveCount(1);
    await expect(image).toHaveAttribute(
      "src",
      /^(?:\.)?\/images\/learn\/irmaan-example\.jpg$/,
    );
    await expect(image).toHaveAttribute("width", "960");
    await expect(image).toHaveAttribute("height", "1280");
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("decoding", "async");
    await expect(image).toHaveAttribute("alt", /xaalad irmaan ah/);
    await expect(irmaanPhoto.locator("figcaption")).toContainText(
      "Tusaale loox dhab ah",
    );

    for (const id of sectionIds) {
      await expect(page.locator(`a[href="#${id}"]`)).toHaveCount(2);
    }

    const diagramIds = await page
      .locator("figure[data-diagram-id]")
      .evaluateAll((figures) =>
        figures.map((figure) => figure.getAttribute("data-diagram-id")),
      );

    expect(new Set(diagramIds).size).toBe(7);
  });

  test("keeps diagram copy coordinate-free and every board specifically described", async ({
    page,
  }) => {
    await page.goto("/learn");

    const figures = page.locator("figure[data-diagram-id]");

    for (let index = 0; index < (await figures.count()); index += 1) {
      const figure = figures.nth(index);
      const board = figure.locator(".shaxda-board-svg");
      const descriptionId = await board.getAttribute("aria-describedby");

      expect(await board.getAttribute("aria-label")).toBeTruthy();
      expect(descriptionId).toBeTruthy();
      await expect(figure.locator(`[id="${descriptionId}"]`)).toHaveCount(1);
      await expect(
        figure.locator('[data-testid="board-overlay"]'),
      ).toHaveAttribute("aria-hidden", "true");
    }

    const visibleCopy = await page.getByTestId("learn-page").innerText();
    expect(visibleCopy).not.toMatch(/\b[OMI][1-8]\b/);

    const definitionIds = await page
      .locator("figure defs [id]")
      .evaluateAll((definitions) =>
        definitions.map((definition) => definition.id),
      );
    expect(new Set(definitionIds).size).toBe(definitionIds.length);
  });

  test("separates advice from rules and links both play modes", async ({
    page,
  }) => {
    await page.goto("/learn");

    const advice = page.locator("#talooyin");
    await expect(advice.getByText("Xeer ma aha · Talo")).toBeVisible();
    await expect(
      advice.getByText(/ma beddelayso xeerarka ku qoran qaybaha kore/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Ku ciyaar qalabkan/ }),
    ).toHaveAttribute("href", "/local");
    await expect(
      page.getByRole("link", { name: /Samee ciyaar marti ah/ }),
    ).toHaveAttribute("href", "/online");

    const actions = page.getByTestId("learn-actions").getByRole("link");

    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toHaveAttribute("data-tone", "emerald");
    await expect(actions.nth(1)).toHaveAttribute("data-tone", "sky");

    const actionHeights = await actions.evaluateAll((links) =>
      links.map((link) => link.getBoundingClientRect().height),
    );
    expect(actionHeights[0]).toBe(actionHeights[1]);
  });

  test("uses exact learn metadata and includes the full guide in raw HTML", async ({
    page,
    request,
  }) => {
    await page.goto("/learn");

    await expect(page).toHaveTitle("Sida loo ciyaaro shaxda | Shaxda");
    await expect(page.locator("meta[name='description']")).toHaveAttribute(
      "content",
      "Bar sida loo ciyaaro shaxda: dhigista, horraynta, ka saarista bilowga, dhaqdhaqaaqa, jare, irmaan, xannibaad, guul iyo barbaro.",
    );

    const response = await request.get("/learn");
    const html = await response.text();

    expect(response.ok()).toBe(true);
    expect(html).toContain('id="bilowga"');
    expect(html).toContain('id="koobid"');
    expect(html).toContain("Jare, qabasho, iyo soo noqnoqosho");
    expect(html).toContain("80 wareeg oo dhaqdhaqaaq");
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/learn");

      const main = page.locator("#main-content");
      const dimensions = await main.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(
        dimensions.clientWidth + 1,
      );
    });
  }

  test("mobile chips use normal anchors and progressively track the section", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn");

    const mobileNav = page.locator('nav[aria-label="Qaybaha hagaha"]:visible');
    const jareLink = mobileNav.locator('a[href="#jare"]');
    const bilowgaLink = mobileNav.locator('a[href="#bilowga"]');

    await jareLink.click();
    await expect(page).toHaveURL(/\/learn#jare$/);
    await expect(jareLink).toHaveAttribute("aria-current", "location");

    await bilowgaLink.click();
    await expect(page).toHaveURL(/\/learn#bilowga$/);
    await expect(bilowgaLink).toHaveAttribute("aria-current", "location");
    await expect(jareLink).not.toHaveAttribute("aria-current", "location");
    await expect(mobileNav.locator("..")).toHaveCSS("position", "sticky");
  });

  for (const width of [390, 1440]) {
    test(`keeps only a modest trailing gutter at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/learn");

      const main = page.locator("#main-content");
      const actions = page.getByTestId("learn-actions");

      await main.evaluate((element) => {
        element.style.scrollBehavior = "auto";
        element.scrollTop = element.scrollHeight;
      });
      await expect
        .poll(() => main.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await expect(actions).toBeVisible();

      const trailingGutter = await actions.evaluate((element) => {
        const mainContent = document.getElementById("main-content");

        if (mainContent === null) {
          throw new Error("main content is missing");
        }

        return (
          mainContent.getBoundingClientRect().bottom -
          element.getBoundingClientRect().bottom
        );
      });

      expect(trailingGutter).toBeGreaterThanOrEqual(32);
      expect(trailingGutter).toBeLessThanOrEqual(64);
    });
  }

  test("desktop uses a sticky 15rem contents rail", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/learn");

    const desktopNav = page.locator('nav[aria-label="Qaybaha hagaha"]:visible');
    const railWidth = await desktopNav
      .locator("..")
      .evaluate((element) => element.getBoundingClientRect().width);

    await expect(desktopNav).toHaveCSS("position", "sticky");
    expect(railWidth).toBeGreaterThanOrEqual(239);
    expect(railWidth).toBeLessThanOrEqual(241);
  });
});
