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
});
