import { expect, test } from "@playwright/test";
import { placeOnline, resignOnline } from "./fixtures/online";

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

      const pages = { A: creator, B: joiner };
      const starter = await placeOnline(pages, "O1");
      const observer = pages[starter === "A" ? "B" : "A"];
      await expect(observer.getByTestId("board-place-animation")).toHaveClass(
        /shaxda-piece-pop/,
      );
      await expect(observer.getByTestId("game-announcer")).toContainText(
        `${starter === "A" ? "Ayaan" : "Cabdi"} wuxuu dhagax dhigay barta O1`,
      );
      const second = await placeOnline(pages, "O2");
      expect(second).not.toBe(starter);
      await expect(joiner.getByTestId("board")).toHaveCSS("transform", "none");

      await creator.reload();

      await expect(creator.getByTestId("online-board")).toBeVisible();
      await expect(creator.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        starter,
      );
    } finally {
      await joinerContext.close();
    }
  });

  test("agrees a rematch, plays the fresh match, and leaves for a clean lobby", async ({
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

      const pages = { A: creator, B: joiner };
      const starter = await placeOnline(pages, "O1");
      await placeOnline(pages, "O2");
      await resignOnline(creator);
      await expect(creator.getByTestId("online-game-result")).toBeVisible();
      await expect(joiner.getByTestId("online-game-result")).toBeVisible();

      // One request alone must not restart the game.
      await joiner.getByTestId("online-rematch").click();
      await expect(
        joiner.getByTestId("online-game-result-notice"),
      ).toContainText("sug ciyaaryahanka kale");
      await expect(joiner.getByTestId("online-rematch")).not.toBeAttached();
      await expect(
        creator.getByTestId("online-game-result-notice"),
      ).toContainText("codsaday");
      await expect(creator.getByTestId("online-game-result")).toBeVisible();
      await expect(creator.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        starter,
      );

      await creator.getByTestId("online-rematch").click();

      await expect(
        creator.getByTestId("online-game-result"),
      ).not.toBeAttached();
      await expect(joiner.getByTestId("online-game-result")).not.toBeAttached();
      for (const page of [creator, joiner]) {
        for (const point of ["O1", "O2"]) {
          await expect(
            page.locator(`[data-point-id="${point}"]`),
          ).toHaveAttribute("data-occupant", "empty");
        }
      }

      expect(await placeOnline(pages, "M1")).not.toBe(starter);
      await placeOnline(pages, "M2");

      await resignOnline(creator);
      await expect(joiner.getByTestId("online-game-result")).toBeVisible();
      await joiner.getByTestId("online-new-match").click();

      await expect(joiner).toHaveURL(/\/online$/);
      await expect(joiner.getByTestId("online-page")).toBeVisible();
      await expect(joiner.getByLabel("Koodhka qolka")).toHaveValue("");
      await expect(joiner.getByTestId("online-board")).not.toBeAttached();

      await joiner.reload();
      await expect(joiner.getByTestId("create-room")).toBeVisible();
      await expect(joiner.getByTestId("online-board")).not.toBeAttached();
    } finally {
      await joinerContext.close();
    }
  });
});
