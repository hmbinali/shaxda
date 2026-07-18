import { applyAction, type GameAction } from "@shaxda/game-engine";
import { messages } from "@shaxda/i18n";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it } from "vitest";
import { buildAnnouncement, buildStateSummary } from "./announce";
import { buildGameStatus } from "./status";

const copy = messages.so.localGame;
const playerName = (player: "A" | "B") => copy.playerNames[player];

describe("game announcements", () => {
  it.each([
    [
      { type: "place", player: "A", point: "O1" },
      gameFixtures.midPlacement,
      copy.announce.placed,
    ],
    [
      { type: "removeInitial", player: "B", point: "O1" },
      gameFixtures.initialRemoval,
      copy.announce.removedInitial,
    ],
    [
      { type: "capture", player: "A", point: "O5" },
      gameFixtures.capturePending,
      copy.announce.captured,
    ],
    [{ type: "resign", player: "B" }, gameFixtures.win, copy.announce.resigned],
  ] as const)("announces an action with %s copy", (action, state, phrase) => {
    const announcement = buildAnnouncement(
      { action, nonce: 1 },
      buildGameStatus(state),
      playerName,
    );

    expect(announcement).toContain(phrase);
    expect(announcement).toContain(playerName(action.player));
  });

  it("announces both movement endpoints and a newly formed jare", () => {
    const action = {
      type: "move",
      player: "A",
      from: "O4",
      to: "O3",
    } as const satisfies GameAction;

    expect(
      buildAnnouncement(
        { action, nonce: 1 },
        buildGameStatus(gameFixtures.capturePending),
        playerName,
      ),
    ).toContain(
      `${copy.announce.moved} O4 ${copy.announce.movedTo} O3. ${copy.announce.jareFormed}`,
    );
  });

  it("announces the winner after an action ends the game", () => {
    const result = applyAction(gameFixtures.capturePending, {
      type: "capture",
      player: "A",
      point: "O5",
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(
      buildAnnouncement(
        {
          action: { type: "capture", player: "A", point: "O5" },
          nonce: 1,
        },
        buildGameStatus(result.state),
        playerName,
      ),
    ).toContain(`${copy.announce.winner}: ${copy.playerNames.A}`);
  });

  it("summarizes a resynchronized state", () => {
    const summary = buildStateSummary(
      buildGameStatus(gameFixtures.blockedPlayer),
      playerName,
    );

    expect(summary).toContain(copy.announce.stateSynced);
    expect(summary).toContain(copy.announce.spaceMaking);
  });
});
