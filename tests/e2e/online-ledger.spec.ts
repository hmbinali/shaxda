import {
  decodeCompactReplay,
  serialize,
} from "../../packages/game-engine/src/index";
import {
  parseStoredReplay,
  serverMessageSchema,
} from "../../packages/shared/src/index";
import { expect, test, type Page } from "@playwright/test";
import { ledgerQuery, inviteRoomCode } from "./fixtures/ledger";
import { seedAccount } from "./fixtures/auth";
import {
  actingSeat,
  isolateRoomQuota,
  placeOnline,
  resignOnline,
} from "./fixtures/online";

type LedgerRow = {
  id: string;
  match_number: number;
  rated: number;
  starting_seat: "A" | "B";
  winner_seat: "A" | "B";
  action_count: number;
  end_reason: string;
  replay: string;
};

function observeFinalState(page: Page) {
  let state: string | undefined;
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      if (typeof payload !== "string") return;
      const result = serverMessageSchema.safeParse(JSON.parse(payload));
      if (
        result.success &&
        result.data.type === "state" &&
        result.data.state.phase === "gameOver"
      ) {
        state = serialize(result.data.state);
      }
    });
  });
  return () => state;
}

test("saves a played account game and rematch in the web Worker's D1", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await isolateRoomQuota(page, 14);
  const opponent = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  try {
    const bPage = await opponent.newPage();
    const pages = { A: page, B: bPage };
    const final = observeFinalState(page);
    await page.goto("/online");
    await expect(page.getByTestId("online-account-identity")).toBeVisible();
    await page.getByTestId("create-room").click();
    const shareLink = await page.getByTestId("share-link").inputValue();
    const code = inviteRoomCode(shareLink);
    await bPage.goto(shareLink);
    await expect(bPage.getByTestId("online-board")).toBeVisible();

    const starter = await placeOnline(pages, "O1");
    await placeOnline(pages, "O2");
    await placeOnline(pages, "O3");
    expect(await actingSeat(page)).not.toBe(starter);
    await resignOnline(pages[starter]);
    for (const player of Object.values(pages)) {
      await expect(player.getByTestId("online-board")).toHaveAttribute(
        "data-save-status",
        "saved",
      );
    }

    const first = ledgerQuery<LedgerRow>(
      `SELECT * FROM match WHERE room_code = '${code}'`,
    );
    const winner = starter === "A" ? "B" : "A";
    expect(first).toMatchObject([
      {
        match_number: 1,
        rated: 0,
        action_count: 4,
        end_reason: "resignation",
        starting_seat: starter,
        winner_seat: winner,
      },
    ]);
    const id = first[0]?.id;
    expect(id).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$/);
    const players = ledgerQuery(
      `SELECT seat, user_id, result FROM match_player JOIN match ON id=match_id WHERE room_code = '${code}' ORDER BY seat`,
    );
    expect(players).toEqual([
      { seat: "A", user_id: a.id, result: winner === "A" ? "win" : "loss" },
      { seat: "B", user_id: b.id, result: winner === "B" ? "win" : "loss" },
    ]);
    const replay = decodeCompactReplay(parseStoredReplay(first[0]!.replay));
    expect(replay.ok && serialize(replay.state)).toBe(final());

    await page.getByTestId("online-rematch").click();
    await expect(bPage.getByTestId("online-game-result-notice")).toContainText(
      "codsaday",
    );
    await bPage.getByTestId("online-rematch").click();
    const rematchStarter = await placeOnline(pages, "M1");
    expect(rematchStarter).toBe(winner);
    await resignOnline(pages[rematchStarter]);
    await expect
      .poll(
        () =>
          ledgerQuery<LedgerRow>(
            `SELECT match_number, starting_seat FROM match WHERE room_code = '${code}' ORDER BY match_number`,
          ),
        { timeout: 20_000 },
      )
      .toEqual([
        { match_number: 1, starting_seat: starter },
        { match_number: 2, starting_seat: rematchStarter },
      ]);
  } finally {
    await opponent.close();
    a.cleanup();
    b.cleanup();
  }
});
