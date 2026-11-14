import { expect, test, type Page } from "@playwright/test";
import { seedAccount } from "./fixtures/auth";
import { inviteRoomCode, ledgerQuery } from "./fixtures/ledger";
import {
  actingSeat,
  isolateRatedRoomQuota,
  placeOnline,
  resignOnline,
} from "./fixtures/online";

test("records two-account agreement and a mixed-vote friendly rematch", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await isolateRatedRoomQuota(page, 11);
  const opponent = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  try {
    const joiner = await opponent.newPage();
    const { code, pages } = await createRatedInvite(page, joiner);
    const starter = pages[await actingSeat(page)];
    await starter.locator('[data-point-id="O1"]').click();
    const warning = starter.getByRole("dialog");
    await expect(warning).toContainText("Oggolaanshaha Tartanka");
    await warning.getByRole("button", { name: "Sug", exact: true }).click();
    await expect(starter.locator('[data-point-id="O1"]')).not.toHaveAttribute(
      "data-occupant",
      /^[AB]$/,
    );

    await joiner.getByRole("button", { name: "Aqbal Tartan" }).click();
    for (const player of Object.values(pages)) {
      await expect(player.getByTestId("online-match-mode")).toContainText(
        "labadiinnaba",
      );
    }
    await placeOnline(pages, "O1");
    await placeOnline(pages, "O2");
    await placeOnline(pages, "O3");
    await resignOnline(joiner);
    await expectSaved(page);
    await expect(page.getByTestId("rated-label")).toContainText("Tartan");
    const first = matchRows(code)[0];
    expect(first).toMatchObject({
      match_number: 1,
      rated: 1,
      consent_policy_v: 1,
      winner_seat: "A",
      action_count: 4,
    });
    await expect(page.getByTestId("match-rating-pending")).toBeVisible();
    const sweep = await page.request.get("/cdn-cgi/handler/scheduled", {
      params: { cron: "* * * * *" },
    });
    expect(sweep.ok()).toBe(true);
    await expect(page.getByTestId("match-rating-confirmed")).toContainText(
      "+162",
    );
    await expect(joiner.getByTestId("match-rating-confirmed")).toContainText(
      "−162",
    );
    expect(
      ledgerQuery(
        `SELECT rating_policy_v, rating_status FROM match_rating WHERE match_id = '${first!.id}'`,
      ),
    ).toEqual([{ rating_policy_v: 1, rating_status: "processed" }]);

    await page.getByTestId("online-rated-rematch").click();
    await expect(joiner.getByTestId("online-game-result-notice")).toContainText(
      "dib-u-ciyaar Tartan",
    );
    await joiner.getByTestId("online-rematch").click();
    await expect(joiner.getByTestId("online-match-mode")).toContainText(
      "Dib-u-ciyaarkani waa Saaxiibtinimo",
    );
    await placeOnline(pages, "M1");
    await resignOnline(joiner);
    await expectSaved(page);
    expect(matchRows(code)[1]).toMatchObject({
      match_number: 2,
      rated: 0,
      consent_policy_v: null,
    });
    await expect(page.getByTestId("rated-label")).toContainText(
      "Saaxiibtinimo",
    );
  } finally {
    await opponent.close();
    a.cleanup();
    b.cleanup();
  }
});

test("saves a declined rated invitation as friendly", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await isolateRatedRoomQuota(page, 12);
  const opponent = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  try {
    const joiner = await opponent.newPage();
    const { code, pages } = await createRatedInvite(page, joiner);
    await joiner
      .getByRole("button", { name: "Ku ciyaar Saaxiibtinimo" })
      .click();
    await expect(page.getByTestId("online-match-mode")).toContainText(
      "Tartan lama wada oggolaan",
    );
    await placeOnline(pages, "O1");
    await resignOnline(joiner);
    await expectSaved(page);
    expect(matchRows(code)).toMatchObject([
      { match_number: 1, rated: 0, consent_policy_v: null },
    ]);
  } finally {
    await opponent.close();
    a.cleanup();
    b.cleanup();
  }
});

async function createRatedInvite(creator: Page, joiner: Page) {
  await creator.goto("/online");
  await expect(creator.getByTestId("online-account-identity")).toBeVisible();
  await expect(
    creator.getByRole("radio", { name: "Saaxiibtinimo" }),
  ).toBeChecked();
  await creator.getByRole("radio", { name: "Tartan", exact: true }).check();
  await expect(creator.getByTestId("rated-disclosure")).toContainText(
    "qof walba wuu arki karaa",
  );
  await creator.getByTestId("create-room").click();
  await expect(creator.getByTestId("waiting-match-mode")).toHaveText("Tartan");
  const share = await creator.getByTestId("share-link").inputValue();
  await joiner.goto(share);
  await expect(joiner.getByTestId("rated-consent")).toBeVisible();
  await expect(creator.getByTestId("online-match-mode")).toContainText(
    "sugayaa",
  );
  return { code: inviteRoomCode(share), pages: { A: creator, B: joiner } };
}

async function expectSaved(page: Page) {
  await expect(page.getByTestId("online-board")).toHaveAttribute(
    "data-save-status",
    "saved",
  );
}

function matchRows(code: string) {
  return ledgerQuery<{ id: string; rated: number }>(
    `SELECT id, match_number, rated, consent_policy_v, winner_seat, action_count FROM match WHERE room_code = '${code}' ORDER BY match_number`,
  );
}
