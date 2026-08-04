import { expect, type Locator, type Page } from "@playwright/test";

// The top bar is server-rendered, so its trigger is inert until the page
// hydrates and a click that lands first is silently dropped. Retry the click
// until the panel actually opens, then wait out the fade-in: axe blends
// mid-animation opacity into its contrast maths and reports false failures.
export async function openAccountPanel(
  page: Page,
  triggerName: string | RegExp = "Fur liiska akoonka",
): Promise<Locator> {
  const panel = page.getByRole("menu", { name: "Liiska akoonka" });

  await expect(async () => {
    await page.getByRole("button", { name: triggerName }).click();
    await expect(panel).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await expect(panel).toHaveCSS("opacity", "1");

  return panel;
}
