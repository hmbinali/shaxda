import { expect, test } from "@playwright/test";

const storageKey = "shaxda:local-game:v1";
const points = [
  "O1",
  "O2",
  "O3",
  "O4",
  "O5",
  "O6",
  "O7",
  "O8",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "I1",
  "I2",
  "I3",
  "I4",
  "I5",
  "I6",
  "I7",
  "I8",
] as const;
const boardWith = (
  pieces: Partial<Record<(typeof points)[number], "A" | "B">>,
) => Object.fromEntries(points.map((point) => [point, pieces[point] ?? null]));
const placementState = {
  phase: "placement",
  board: boardWith({}),
  currentPlayer: "A",
  players: {
    A: { inHand: 12, captured: 0 },
    B: { inHand: 12, captured: 0 },
  },
  startingPlayer: "A",
  firstAdvantage: null,
  initialRemoval: { removedBy: { A: false, B: false } },
  pendingCapture: null,
  draw: { turnsSinceCapture: 0, repeatedPositions: {} },
  winner: null,
  endReason: null,
};
const movementState = {
  ...placementState,
  phase: "movement",
  board: boardWith({
    O1: "A",
    O2: "A",
    O4: "A",
    O5: "B",
    O6: "B",
    O7: "B",
    M5: "B",
  }),
  players: {
    A: { inHand: 0, captured: 0 },
    B: { inHand: 0, captured: 0 },
  },
  firstAdvantage: "A",
  initialRemoval: { removedBy: { A: true, B: true } },
};
const blockedState = {
  ...movementState,
  board: boardWith({
    O1: "B",
    O2: "A",
    O8: "A",
    M1: "B",
    M2: "A",
    M8: "A",
    I1: "B",
    I2: "A",
    I8: "A",
  }),
  currentPlayer: "B",
  firstAdvantage: "B",
};
const viewports = [
  { width: 320, height: 460 },
  { width: 360, height: 520 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
] as const;

test.use({ serviceWorkers: "block" });

test.describe("tabletop layout", () => {
  for (const viewport of viewports) {
    test(`${viewport.width}×${viewport.height} keeps the shared table usable`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/local");
      await expect(page.getByTestId("tabletop")).toBeVisible();

      const geometry = await measureTabletop(page);

      expect(geometry.board.width).toBeGreaterThanOrEqual(220);
      expect(geometry.board.height).toBeGreaterThanOrEqual(220);
      if (geometry.main.height >= 450) {
        expect(geometry.board.width).toBeGreaterThanOrEqual(280);
      }
      expect(geometry.smallestTarget.width).toBeGreaterThanOrEqual(24);
      expect(geometry.smallestTarget.height).toBeGreaterThanOrEqual(24);
      expect(geometry.top.bottom).toBeLessThanOrEqual(geometry.board.top);
      expect(geometry.board.bottom).toBeLessThanOrEqual(geometry.bottom.top);
      expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width);
      expect(geometry.main.scrollHeight).toBeLessThanOrEqual(
        geometry.main.clientHeight + 1,
      );
      expect(geometry.actionOverlapsPoint).toBe(false);
    });
  }

  test("the shortest mobile actions sheet remains dismissible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 460 });
    await page.goto("/local");

    const trigger = page.locator('summary[aria-label="Ficillo kale"]');
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Ficillo kale" }),
    ).toBeVisible();
    await page.getByTestId("game-actions-close").click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await trigger.click();
    await page.getByTestId("game-actions-backdrop").click({
      position: { x: 4, y: 4 },
    });
    await expect(page.getByRole("dialog")).toBeHidden();

    await trigger.click();
    await expect(page.getByTestId("game-actions-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a centred board notice receives input above the actions trigger", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 460 });
    await page.goto("/");
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: storageKey,
      value: JSON.stringify(blockedState),
    });
    await page.goto("/local");

    const trigger = page.locator('summary[aria-label="Ficillo kale"]');
    const triggerBox = await trigger.boundingBox();
    const notice = page.getByTestId("blocked-prompt");
    const noticeBox = await notice.boundingBox();

    expect(triggerBox).not.toBeNull();
    expect(noticeBox).not.toBeNull();
    expect(rectanglesOverlap(triggerBox!, noticeBox!)).toBe(true);

    const hitTarget = await page.evaluate(
      ({ x, y }) => {
        const target = document.elementFromPoint(x, y);
        return {
          isNotice: target?.closest('[data-testid="blocked-prompt"]') !== null,
          isTrigger:
            target?.closest('summary[aria-label="Ficillo kale"]') !== null,
        };
      },
      {
        x: triggerBox!.x + triggerBox!.width / 2,
        y: triggerBox!.y + triggerBox!.height / 2,
      },
    );

    expect(hitTarget).toEqual({ isNotice: true, isTrigger: false });
  });

  test("a PWA notice reduces the measured table tier without clipping it", async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 520 });
    await page.goto("/local");
    await expect(page.getByTestId("tabletop")).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByTestId("pwa-offline-notice")).toBeVisible();

    const geometry = await measureTabletop(page);

    expect(geometry.board.width).toBeGreaterThanOrEqual(220);
    expect(geometry.smallestTarget.width).toBeGreaterThanOrEqual(24);
    expect(geometry.top.bottom).toBeLessThanOrEqual(geometry.board.top);
    expect(geometry.board.bottom).toBeLessThanOrEqual(geometry.bottom.top);
  });

  test("placement, movement, blocked, near-draw, and result states retain the compact geometry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 460 });
    await page.goto("/");

    const states = [
      { name: "placement", state: placementState, testId: null },
      { name: "movement", state: movementState, testId: null },
      {
        name: "blocked",
        state: blockedState,
        testId: "blocked-prompt",
      },
      {
        name: "near-draw",
        state: {
          ...movementState,
          draw: {
            ...movementState.draw,
            turnsSinceCapture: 60,
          },
        },
        testId: "draw-warning",
      },
      {
        name: "result",
        state: movementState,
        testId: "game-result",
      },
    ] as const;

    for (const fixture of states) {
      await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: storageKey, value: JSON.stringify(fixture.state) },
      );
      await page.goto("/local");
      await expect(
        page.getByTestId("tabletop"),
        `${fixture.name} tabletop`,
      ).toBeVisible();
      if (fixture.name === "result") {
        await page
          .getByTestId("player-rail-A")
          .getByRole("button", { name: "Is dhiib" })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Xaqiiji" })
          .click();
      }
      if (fixture.testId !== null) {
        await expect(page.getByTestId(fixture.testId)).toBeVisible();
      }

      const geometry = await measureTabletop(page);

      expect(geometry.board.width, fixture.name).toBeGreaterThanOrEqual(220);
      expect(
        geometry.smallestTarget.width,
        fixture.name,
      ).toBeGreaterThanOrEqual(24);
      expect(geometry.top.bottom, fixture.name).toBeLessThanOrEqual(
        geometry.board.top,
      );
      expect(geometry.board.bottom, fixture.name).toBeLessThanOrEqual(
        geometry.bottom.top,
      );
      expect(geometry.documentWidth, fixture.name).toBeLessThanOrEqual(320);
    }
  });

  test("below the minimum tier main scrolls instead of clipping a rail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 360 });
    await page.goto("/local");
    await expect(page.getByTestId("tabletop")).toBeVisible();

    const main = page.locator("#main-content");
    await expect
      .poll(() =>
        main.evaluate((element) => element.scrollHeight > element.clientHeight),
      )
      .toBe(true);
    await expect(page.getByTestId("player-rail-A")).toBeAttached();
    await main.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByTestId("player-rail-A")).toBeInViewport();
  });
});

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

async function measureTabletop(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const rect = (selector: string): DOMRect => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
        throw new Error(`Missing ${selector}`);
      }
      return element.getBoundingClientRect();
    };
    const plain = (value: DOMRect) => ({
      top: value.top,
      right: value.right,
      bottom: value.bottom,
      left: value.left,
      width: value.width,
      height: value.height,
    });
    const main = document.querySelector("#main-content");
    if (!(main instanceof HTMLElement)) {
      throw new Error("Missing main");
    }
    const targetRects = Array.from(
      document.querySelectorAll('[data-testid="board-hit-target"]'),
      (element) => element.getBoundingClientRect(),
    );
    const action = rect('summary[aria-label="Ficillo kale"]');
    const actionOverlapsPoint = targetRects.some(
      (target) =>
        action.left < target.right &&
        action.right > target.left &&
        action.top < target.bottom &&
        action.bottom > target.top,
    );
    const smallestTarget = targetRects.reduce((smallest, target) =>
      target.width < smallest.width ? target : smallest,
    );
    const mainRect = main.getBoundingClientRect();

    return {
      board: plain(rect('[data-testid="board"]')),
      top: plain(rect('[data-testid="player-rail-B"]')),
      bottom: plain(rect('[data-testid="player-rail-A"]')),
      smallestTarget: plain(smallestTarget),
      actionOverlapsPoint,
      documentWidth: document.documentElement.scrollWidth,
      main: {
        ...plain(mainRect),
        clientHeight: main.clientHeight,
        scrollHeight: main.scrollHeight,
      },
    };
  });
}
