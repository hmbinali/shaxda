import { expect, test } from "@playwright/test";

const storageKey = "shaxda:local-game:v1";
const soundPreferenceKey = "shaxda:sound-enabled:v1";
const nearTerminalCaptureState = JSON.stringify({
  phase: "capture",
  board: {
    O1: "A",
    O2: "A",
    O3: "A",
    O4: null,
    O5: "B",
    O6: "B",
    O7: null,
    O8: "B",
    M1: null,
    M2: null,
    M3: null,
    M4: null,
    M5: null,
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
  pendingCapture: { player: "A", formedAt: "O3" },
  draw: {
    turnsSinceCapture: 0,
    repeatedPositions: {},
  },
  winner: null,
  endReason: null,
});
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
const blockedPlayerState = JSON.stringify({
  phase: "movement",
  board: {
    O1: "B",
    O2: "A",
    O3: null,
    O4: null,
    O5: null,
    O6: null,
    O7: null,
    O8: "A",
    M1: "B",
    M2: "A",
    M3: null,
    M4: null,
    M5: null,
    M6: null,
    M7: null,
    M8: "A",
    I1: "B",
    I2: "A",
    I3: null,
    I4: null,
    I5: null,
    I6: null,
    I7: null,
    I8: "A",
  },
  currentPlayer: "B",
  players: {
    A: { inHand: 0, captured: 0 },
    B: { inHand: 0, captured: 0 },
  },
  startingPlayer: "A",
  firstAdvantage: "B",
  initialRemoval: {
    removedBy: { A: true, B: true },
  },
  pendingCapture: null,
  draw: {
    turnsSinceCapture: 0,
    repeatedPositions: {},
  },
  winner: null,
  endReason: null,
});

test.describe("L1 local game", () => {
  test("loads without a language toggle", async ({ page }) => {
    await page.goto("/local");

    await expect(
      page.getByRole("heading", { name: "Ciyaar qalabkan", exact: true }),
    ).toBeVisible();

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(bodyText).not.toContain("language toggle");
    expect(bodyText).not.toContain("/en");
  });

  test("click placement creates a piece and persists", async ({ page }) => {
    await page.goto("/local");

    await page.locator('[data-point-id="O1"]').click();

    await expect(page.locator('[data-point-id="O1"]')).toHaveAttribute(
      "data-occupant",
      "A",
    );
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
      .not.toBeNull();
  });

  test("persists the local sound preference", async ({ page }) => {
    await page.goto("/local");

    await page.getByRole("button", { name: "Codka dami" }).click();

    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), soundPreferenceKey),
      )
      .toBe("false");

    await page.reload();

    const soundButton = page.getByRole("button", { name: "Codka shid" });
    await expect(soundButton).toHaveAttribute("aria-pressed", "false");
  });

  test("resumes a near-terminal state and displays game over", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: storageKey, value: nearTerminalCaptureState },
    );
    await page.goto("/local");

    await expect(page.locator('[data-point-id="O5"]')).toHaveAttribute(
      "data-capture-target",
      "true",
    );

    await page.locator('[data-point-id="O5"]').click();

    await expect(page.getByTestId("game-result")).toContainText(
      "Guuleystay: Ciyaaryahan A",
    );
    await expect(page.getByTestId("game-result")).toContainText(
      "wax ka yar saddex dhagax",
    );
  });

  test("moves into a jare, captures, and moves into the captured point", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: storageKey, value: movementJareState },
    );
    await page.goto("/local");

    await page.locator('[data-point-id="O4"]').click();
    await page.locator('[data-point-id="O3"]').click();

    await expect(page.locator('[data-point-id="O3"]')).toHaveAttribute(
      "data-occupant",
      "A",
    );
    await expect(page.locator('[data-point-id="O5"]')).toHaveAttribute(
      "data-capture-target",
      "true",
    );

    await page.locator('[data-point-id="O5"]').click();

    await expect(page.locator('[data-point-id="O5"]')).toHaveAttribute(
      "data-occupant",
      "empty",
    );

    await page.locator('[data-point-id="O6"]').click();
    await expect(page.locator('[data-point-id="O5"]')).toHaveAttribute(
      "data-legal-hint",
      "true",
    );
    await page.locator('[data-point-id="O5"]').click();

    await expect(page.locator('[data-point-id="O5"]')).toHaveAttribute(
      "data-occupant",
      "B",
    );
  });

  test("prompts for blocked-player space making", async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: storageKey, value: blockedPlayerState },
    );
    await page.goto("/local");

    await expect(page.getByTestId("blocked-prompt")).toBeVisible();

    await page.locator('[data-point-id="O2"]').click();
    await expect(page.locator('[data-point-id="O3"]')).toHaveAttribute(
      "data-legal-hint",
      "true",
    );
    await page.locator('[data-point-id="O3"]').click({ force: true });

    await expect(page.locator('[data-point-id="O3"]')).toHaveAttribute(
      "data-occupant",
      "A",
    );
  });

  test("announces invalid local actions", async ({ page }) => {
    await page.goto("/local");

    await page.locator('[data-point-id="O1"]').click();
    await page.locator('[data-point-id="O1"]').click();

    await expect(page.getByTestId("invalid-feedback")).toHaveAttribute(
      "role",
      "status",
    );
    await expect(page.getByTestId("invalid-feedback")).toBeVisible();
  });

  test("reloads local play offline and resumes the saved game", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );

    await page.goto("/local");
    await expect(
      page.getByRole("heading", { name: "Ciyaar qalabkan", exact: true }),
    ).toBeVisible();
    await page.locator('[data-point-id="O1"]').click();
    await expect(page.locator('[data-point-id="O1"]')).toHaveAttribute(
      "data-occupant",
      "A",
    );
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
      .not.toBeNull();

    try {
      await context.setOffline(true);
      await page.reload({ waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("heading", { name: "Ciyaar qalabkan", exact: true }),
      ).toBeVisible();
      await expect(page.locator('[data-point-id="O1"]')).toHaveAttribute(
        "data-occupant",
        "A",
      );
    } finally {
      await context.setOffline(false);
    }
  });
});
