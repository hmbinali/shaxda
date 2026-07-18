import { expect, test } from "@playwright/test";

test.describe("Q1 mobile responsive smoke", () => {
  test("public pages, local play, and online lobby fit a phone viewport", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Shaxda", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("#main-content").getByRole("link", {
        name: "Ciyaar qalabkan",
      }),
    ).toBeVisible();

    const menuButton = page.getByRole("button", { name: "Fur hagaha" });
    await menuButton.click();
    const drawer = page.getByRole("dialog", { name: "Hagaha bogga" });
    await expect(drawer).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menuButton).toBeFocused();

    await page.goto("/local");
    await expect(
      page.getByRole("heading", { name: "Ciyaar qalabkan", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("board")).toBeInViewport();
    await page.locator('[data-point-id="O1"]').click();
    await expect(page.locator('[data-point-id="O1"]')).toHaveAttribute(
      "data-occupant",
      "A",
    );

    await page.goto("/online");
    await expect(
      page.getByRole("heading", { name: "Ciyaar marti ah" }),
    ).toBeVisible();
    await page.getByLabel("Magaca martida").fill("Ayaan");
    await expect(page.getByTestId("create-room")).toBeVisible();
    await expect(page.getByTestId("join-room")).toBeVisible();
  });
});
