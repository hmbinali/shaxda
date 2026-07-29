import { expect, test } from "@playwright/test";

test.describe("O1 guest online game", () => {
  test("creates, joins by link, syncs a move, and reconnects after refresh", async ({
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
      await expect(
        creator.getByTestId("game-details-panel"),
      ).not.toBeAttached();
      await expect(
        joiner.locator('[data-testid^="player-rail-"]').nth(0),
      ).toHaveAttribute("data-player", "A");
      await expect(
        joiner.locator('[data-testid^="player-rail-"]').nth(1),
      ).toHaveAttribute("data-player", "B");
      await expect(joiner.getByTestId("player-rail-B")).toHaveAttribute(
        "data-rotated",
        "false",
      );

      await creator.locator('[data-point-id="O1"]').click();

      await expect(creator.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );
      await expect(joiner.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );
      await expect(joiner.getByTestId("board-place-animation")).toHaveClass(
        /shaxda-piece-pop/,
      );
      await expect(joiner.getByTestId("game-announcer")).toContainText(
        "Ayaan wuxuu dhagax dhigay barta O1",
      );

      await joiner.locator('[data-point-id="O2"]').click();
      await expect(joiner.locator('[data-point-id="O2"]')).toHaveAttribute(
        "data-occupant",
        "B",
      );
      await expect(
        joiner.locator(
          '[data-point-id="O2"] [data-testid="board-piece-b-ring"]',
        ),
      ).toBeVisible();
      await expect(joiner.getByTestId("board")).toHaveCSS("transform", "none");

      await creator.reload();

      await expect(creator.getByTestId("online-board")).toBeVisible();
      await expect(creator.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );
    } finally {
      await joinerContext.close();
    }
  });
});
