import { expect, test } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";

test.describe("V1.1-A2 online account identity", () => {
  test("a signed-in account and guest play, refresh, and expose no account id", async ({
    browser,
    context,
    page: creator,
  }) => {
    const account = await seedAccount(context);
    if (account.username === null)
      throw new Error("Expected complete account.");

    const joinerContext = await browser.newContext();
    try {
      await creator.goto("/online");
      await expect(creator.getByLabel("Magaca martida")).not.toBeAttached();
      await expect(
        creator.getByTestId("online-account-identity"),
      ).toContainText(`@${account.username}`);
      await creator.getByTestId("create-room").click();
      await expect(creator.getByTestId("online-lobby")).toBeVisible();
      await expect(
        creator.getByRole("link", { name: `@${account.username}` }),
      ).toHaveAttribute("href", `/u/${account.username}`);
      await expect(creator.locator("body")).not.toContainText(account.id);

      const shareLink = await creator.getByTestId("share-link").inputValue();
      const joiner = await joinerContext.newPage();
      await joiner.goto(shareLink);
      await joiner.getByLabel("Magaca martida").fill("Cabdi");
      await joiner.getByTestId("join-room").click();

      await expect(creator.getByTestId("online-board")).toBeVisible();
      await expect(joiner.getByTestId("online-board")).toBeVisible();
      await expect(creator.getByTestId("player-rail-A")).toContainText(
        `@${account.username}`,
      );
      await creator.locator('[data-point-id="O1"]').click();
      await expect(joiner.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );

      await creator.reload();
      await expect(creator.getByTestId("online-board")).toBeVisible();
      await expect(creator.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );
      await expect(creator.locator("body")).not.toContainText(account.id);
    } finally {
      await joinerContext.close();
      account.cleanup();
    }
  });

  test("an incomplete account sees registration guidance and can stay a guest", async ({
    context,
    page,
  }) => {
    const account = await seedAccount(context, { complete: false });
    try {
      await page.goto("/online?room=ABCDEFGH");
      await expect(
        page.getByText("Diiwaangelinta lama dhammaystirin", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Dhammaystir diiwaangelinta" }),
      ).toHaveAttribute(
        "href",
        "/register?returnTo=%2Fonline%3Froom%3DABCDEFGH",
      );
      await expect(page.getByLabel("Magaca martida")).toBeVisible();
    } finally {
      account.cleanup();
    }
  });
});
