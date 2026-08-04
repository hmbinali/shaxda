import { expect, test } from "@playwright/test";

const sectionIds = [
  "guudmar",
  "xogta",
  "kaydka-qalabka",
  "ciyaarta-martida",
  "cabbiraadda",
  "ilaalinta",
  "adeegyada",
  "carruurta",
  "xuquuqda",
  "shuruudaha",
  "isticmaal-fiican",
  "milkiyadda",
  "dammaanad",
  "isbeddel",
  "xiriirka",
] as const;

test.describe("combined legal page", () => {
  test("renders every anchored section once, in order", async ({ page }) => {
    await page.goto("/legal");

    const renderedIds = await page
      .locator("[data-legal-section]")
      .evaluateAll((elements) => elements.map((element) => element.id));

    expect(renderedIds).toEqual(sectionIds);
    expect(new Set(renderedIds).size).toBe(sectionIds.length);
  });

  test("reads as one plain column without a contents sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/legal");

    await expect(
      page.locator('nav[aria-label="Qaybaha sharciga"]'),
    ).toHaveCount(0);

    for (const id of sectionIds) {
      await expect(page.locator(`a[href="#${id}"]`)).toHaveCount(0);
    }
  });

  test("opens a deep-linked section with its heading visible", async ({
    page,
  }) => {
    await page.goto("/legal#xuquuqda");

    await expect(page.locator("#xuquuqda h2")).toBeInViewport();
    await expect(page).toHaveURL(/\/legal#xuquuqda$/);
  });

  test("keeps every section anchor reachable by a fresh deep link", async ({
    page,
  }) => {
    for (const id of ["kaydka-qalabka", "ilaalinta", "xiriirka"]) {
      await page.goto("about:blank");
      await page.goto(`/legal#${id}`);

      await expect(page.locator(`#${id} h2`)).toBeInViewport();
    }
  });
});
