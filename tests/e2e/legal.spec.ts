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
  test("renders every anchored section and one visible contents link per section", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/legal");

    const renderedIds = await page
      .locator("[data-legal-section]")
      .evaluateAll((elements) => elements.map((element) => element.id));
    const navigation = page.locator(
      'nav[aria-label="Qaybaha sharciga"]:visible',
    );

    expect(renderedIds).toEqual(sectionIds);
    expect(new Set(renderedIds).size).toBe(sectionIds.length);
    await expect(navigation.getByRole("link")).toHaveCount(sectionIds.length);

    for (const id of sectionIds) {
      await expect(navigation.locator(`a[href="#${id}"]`)).toHaveCount(1);
    }
  });

  test("contents links move their headings into view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/legal");

    const navigation = page.locator(
      'nav[aria-label="Qaybaha sharciga"]:visible',
    );
    await navigation.locator('a[href="#cabbiraadda"]').click();

    await expect(page).toHaveURL(/\/legal#cabbiraadda$/);
    await expect(page.locator("#cabbiraadda h2")).toBeInViewport();
    await expect(navigation.locator('a[href="#cabbiraadda"]')).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  test("opens a deep-linked section with its heading visible", async ({
    page,
  }) => {
    await page.goto("/legal#cabbiraadda");

    await expect(page.locator("#cabbiraadda h2")).toBeInViewport();
    await expect(page).toHaveURL(/\/legal#cabbiraadda$/);
  });
});
