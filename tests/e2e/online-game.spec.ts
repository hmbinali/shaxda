import { expect, test } from "@playwright/test";

test.describe("O1 guest online game", () => {
  test("creates, joins by link, and syncs an authoritative move", async ({
    browser,
    page: creator,
  }) => {
    await creator.goto("/online");
    await creator.getByLabel("Magaca martida").fill("Ayaan");
    await creator.getByTestId("create-room").click();

    await expect(creator.getByTestId("online-lobby")).toContainText(
      "Sug ciyaaryahanka kale.",
    );
    const shareLink = await creator.getByTestId("share-link").inputValue();

    const joinerContext = await browser.newContext();
    const joiner = await joinerContext.newPage();
    try {
      await joiner.goto(shareLink);
      await joiner.getByLabel("Magaca martida").fill("Cabdi");
      await joiner.getByTestId("join-room").click();

      await expect(creator.getByTestId("online-board")).toBeVisible();
      await expect(joiner.getByTestId("online-board")).toBeVisible();

      await creator.locator('[data-point-id="O1"]').click();

      await expect(creator.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );
      await expect(joiner.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );
    } finally {
      await joinerContext.close();
    }
  });
});
