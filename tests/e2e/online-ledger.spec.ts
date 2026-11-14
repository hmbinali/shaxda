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
import { expectMissingMatch } from "./fixtures/history";
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

test("saves an account game and rematch and opens the history for both players", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await isolateRoomQuota(page, 14);
  const opponent = await browser.newContext();
  const guest = await browser.newContext();
  const outsider = await browser.newContext();
  const a = await seedAccount(context);
  const b = await seedAccount(opponent);
  const c = await seedAccount(outsider);
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

    // Follow the rematch from both result overlays once H1 acknowledges it.
    const rematch = ledgerQuery<LedgerRow>(
      `SELECT id FROM match WHERE room_code = '${code}' AND match_number = 2`,
    );
    const matchId = rematch[0]!.id;
    const href = `/match/${matchId}`;
    const winningAccount = rematchStarter === "A" ? b : a;
    for (const seat of ["A", "B"] as const) {
      const player = pages[seat];
      const link = player.getByTestId("online-view-match");
      await expect(link).toHaveAttribute("href", href);
      await expect(player.getByTestId("online-rematch")).toBeFocused();
      await link.click();
      await expect(player.getByRole("heading", { level: 1 })).toContainText(
        `@${winningAccount.username}`,
      );
      await expect(
        player.getByText("Ciyaaryahan ayaa is dhiibay."),
      ).toBeVisible();
      for (const account of [a, b]) {
        await expect(
          player.getByRole("link", { name: `@${account.username}` }),
        ).toBeVisible();
      }
      await player.goto("/history");
      const row = player.getByTestId("history-row").filter({
        has: player.locator(`a[href="${href}"]`),
      });
      await expect(row).toContainText(
        seat === rematchStarter ? "Guuldarro" : "Guul",
      );
      await expect(row).toContainText("Saaxiibtinimo");
      const data = await player.request.get(`${href}/__data.json`);
      expect(data.headers()["cache-control"]).toBe("no-store");
      const body = await data.text();
      for (const value of [a.id, b.id, a.email, b.email, code]) {
        expect(body).not.toContain(value);
      }
    }
    await expectMissingMatch(guest.request, matchId);
    await expectMissingMatch(outsider.request, matchId);
  } finally {
    await Promise.all([opponent.close(), guest.close(), outsider.close()]);
    a.cleanup();
    b.cleanup();
    c.cleanup();
  }
});
