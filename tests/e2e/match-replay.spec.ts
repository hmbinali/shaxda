import { expect, test } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";
import { expectMissingMatch } from "./fixtures/history";
import { seedMatches } from "./fixtures/match";

test("replays a rated match publicly and shares the current position", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const a = await seedAccount(context);
  const b = await seedAccount(context);
  const visitor = await browser.newContext({ reducedMotion: "reduce" });
  const match = await seedMatches(a.id, b.id, 1, { rated: true, sample: "M2" });
  const path = `/match/${match.ids[0]}`;
  try {
    const publicPage = await visitor.newPage();
    await visitor.grantPermissions(["clipboard-read", "clipboard-write"]);
    await publicPage.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined });
      localStorage.setItem("shaxda:sound-enabled:v1", "true");
    });
    const counter = publicPage.getByTestId("replay-counter");
    for (const [query, text] of [
      ["?a=0", "0 / 4"],
      ["?a=2", "2 / 4"],
      ["?a=500", "4 / 4"],
      ["?a=garbage", "0 / 4"],
    ]) {
      expect((await publicPage.goto(path + query))?.status()).toBe(200);
      await expect(counter).toHaveText(text);
    }
    await expect(publicPage).toHaveURL(baseURL + path);
    await expect(publicPage.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      baseURL + path,
    );

    const dataRequests: string[] = [];
    publicPage.on("request", (request) => {
      if (request.url().includes("/__data.json"))
        dataRequests.push(request.url());
    });
    const viewer = publicPage.getByTestId("replay-viewer");
    const points = viewer.getByTestId("board-point");
    await expect(points).toHaveCount(24);
    await expect(
      viewer.locator('[data-testid="board-point"][tabindex]'),
    ).toHaveCount(0);
    await expect(
      viewer.getByRole("button", { name: "Codka shid" }),
    ).toHaveAttribute("aria-pressed", "false");

    const next = viewer.getByRole("button", { name: "Tallaabada xigta" });
    await next.focus();
    await publicPage.keyboard.press("ArrowRight");
    await expect(counter).toHaveText("1 / 4");
    await expect(viewer.locator('[data-replay-cue="destination"]')).toHaveCount(
      1,
    );
    await publicPage.keyboard.press("ArrowRight");
    await expect(counter).toHaveText("2 / 4");
    await publicPage.getByTestId("share-match").click();
    const shared = `${baseURL}${path}?a=2`;
    await expect
      .poll(() => publicPage.evaluate(() => navigator.clipboard.readText()))
      .toBe(shared);
    await publicPage.keyboard.press("ArrowRight");
    await expect(counter).toHaveText("2 / 4");

    await viewer.getByLabel("Xawaare").selectOption("2");
    await viewer.getByRole("button", { name: "Ciyaar", exact: true }).click();
    const result = viewer.getByTestId("replay-result");
    await expect(result).toBeVisible();
    await expect(counter).toHaveText("4 / 4");
    await expect(result).toContainText(a.username);
    await expect(viewer.getByTestId("replay-description")).toContainText(
      b.username,
    );
    await viewer.getByRole("button", { name: "Tallaabadii hore" }).click();
    await expect(result).toHaveCount(0);
    await expect(counter).toHaveText("3 / 4");
    expect(dataRequests).toEqual([]);
    expect(
      await publicPage.evaluate(() =>
        localStorage.getItem("shaxda:sound-enabled:v1"),
      ),
    ).toBe("true");

    await page.goto(shared);
    await expect(page.getByTestId("replay-counter")).toHaveText("2 / 4");
  } finally {
    await visitor.close();
    match.cleanup();
    a.cleanup();
    b.cleanup();
  }
});

test("limits a friendly replay to both participants", async ({
  page,
  context,
  browser,
}) => {
  const opponent = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  const visitor = await browser.newContext();
  const outsider = await seedAccount(visitor);
  const match = await seedMatches(a.id, b.id, 1);
  const id = match.ids[0]!;
  try {
    const anonymous = await browser.newContext();
    try {
      await expectMissingMatch(anonymous.request, id);
    } finally {
      await anonymous.close();
    }
    await expectMissingMatch(visitor.request, id);
    for (const player of [page, await opponent.newPage()]) {
      const response = await player.goto(`/match/${id}`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()["cache-control"]).toBe("no-store");
      await player.getByRole("button", { name: "Dhammaadka" }).click();
      await expect(player.getByTestId("replay-result")).toBeVisible();
    }
  } finally {
    await opponent.close();
    await visitor.close();
    match.cleanup();
    a.cleanup();
    b.cleanup();
    outsider.cleanup();
  }
});
