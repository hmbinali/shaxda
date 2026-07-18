import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/learn",
  "/rules",
  "/privacy",
  "/terms",
  "/local",
  "/online",
];

const activeBoardFixtures = [
  "movement",
  "initialRemoval",
  "capturePending",
  "placementJare",
  "win",
] as const;

test.describe("Q1 accessibility audit", () => {
  for (const route of routes) {
    test(`${route} has no serious or critical axe violations`, async ({
      page,
    }) => {
      await page.goto(route);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blockingViolations = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );

      expect(blockingViolations).toEqual([]);
    });
  }

  for (const fixture of activeBoardFixtures) {
    test(`/board ${fixture} fixture has no axe violations`, async ({
      page,
    }) => {
      await page.goto("/board");
      const fixtureCard = page.locator(`[data-fixture="${fixture}"]`);
      await expect(fixtureCard).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include(`[data-fixture="${fixture}"]`)
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
