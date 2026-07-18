import { expect, test } from "@playwright/test";

const storageKey = "shaxda:local-game:v1";
const movementJareState = JSON.stringify({
  phase: "movement",
  board: {
    O1: "A",
    O2: "A",
    O3: null,
    O4: "A",
    O5: "B",
    O6: "B",
    O7: "B",
    O8: null,
    M1: null,
    M2: null,
    M3: null,
    M4: null,
    M5: "B",
    M6: null,
    M7: null,
    M8: null,
    I1: null,
    I2: null,
    I3: null,
    I4: null,
    I5: null,
    I6: null,
    I7: null,
    I8: null,
  },
  currentPlayer: "A",
  players: {
    A: { inHand: 0, captured: 0 },
    B: { inHand: 0, captured: 0 },
  },
  startingPlayer: "A",
  firstAdvantage: "A",
  initialRemoval: {
    removedBy: { A: true, B: true },
  },
  pendingCapture: null,
  draw: {
    turnsSinceCapture: 2,
    repeatedPositions: {},
  },
  winner: null,
  endReason: null,
});

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

    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: storageKey,
      value: movementJareState,
    });
    await page.reload();
    await page.locator('[data-point-id="O4"]').click();
    await page.locator('[data-point-id="O3"]').click();
    await page.getByTestId("board-move-animation").evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });

    const pieceBox = await page
      .locator('[data-point-id="O3"] [data-testid="board-piece"]')
      .boundingBox();
    const hitBox = await page
      .locator('[data-point-id="O3"] [data-testid="board-hit-target"]')
      .boundingBox();

    expect(pieceBox).not.toBeNull();
    expect(hitBox).not.toBeNull();
    expect(
      Math.hypot(
        (pieceBox?.x ?? 0) +
          (pieceBox?.width ?? 0) / 2 -
          ((hitBox?.x ?? 0) + (hitBox?.width ?? 0) / 2),
        (pieceBox?.y ?? 0) +
          (pieceBox?.height ?? 0) / 2 -
          ((hitBox?.y ?? 0) + (hitBox?.height ?? 0) / 2),
      ),
    ).toBeLessThan((hitBox?.width ?? 0) / 2);

    await page.goto("/online");
    await expect(
      page.getByRole("heading", { name: "Ciyaar marti ah" }),
    ).toBeVisible();
    await page.getByLabel("Magaca martida").fill("Ayaan");
    await expect(page.getByTestId("create-room")).toBeVisible();
    await expect(page.getByTestId("join-room")).toBeVisible();
  });
});
