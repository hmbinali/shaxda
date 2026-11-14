import { decodeCompactReplay, serialize } from "@shaxda/game-engine";
import { describe, expect, it } from "vitest";
import { fullGameActionScripts } from "./fixtures";
import {
  MAX_STORED_REPLAY_BYTES,
  matchPayloadHash,
  matchPayloadSchema,
  parseStoredReplay,
} from "./match";
import { sampleMatchPayloads } from "./match-fixtures";
import { writesLedgerRow } from "./rated-play";
import { matchStatusServerMessageSchema, roomOptionsSchema } from "./schemas";
import { encodeCompactReplay } from "@shaxda/game-engine";

describe("H1 ledger contracts", () => {
  it("round-trips the full-game scripts", () => {
    for (const {
      actions,
      expectedFinalState,
      startingPlayer,
    } of fullGameActionScripts) {
      const compact = encodeCompactReplay(startingPlayer, actions);
      const decoded = decodeCompactReplay(
        parseStoredReplay(JSON.stringify(compact)),
      );
      expect(decoded.ok && serialize(decoded.state)).toEqual(
        serialize(expectedFinalState),
      );
    }
  });

  it("checks UTF-8 length before parsing", () => {
    expect(() =>
      parseStoredReplay("é".repeat(MAX_STORED_REPLAY_BYTES / 2) + "!"),
    ).toThrow("byte limit");
    expect(() =>
      parseStoredReplay('{"v":1,"s":"A","a":["P:O1\\n"]}'),
    ).toThrow();
  });

  it("checks ledger invariants and hashes immutable columns in canonical order", async () => {
    const sample = sampleMatchPayloads.M2;
    const hash = await matchPayloadHash(sample);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    await expect(
      matchPayloadHash({
        ...sample,
        statsV: 1,
        statsStatus: "ok",
        statsJson: "{}",
      }),
    ).resolves.toBe(hash);
    await expect(
      matchPayloadHash({ ...sample, endedAt: sample.endedAt + 1 }),
    ).resolves.not.toBe(hash);
    for (const difference of [
      { mode: "quick" },
      { consentPolicyV: 1 },
      { rated: 1 },
      { firstAdvantageSeat: "A" },
      { winnerSeat: null },
      { endReason: "bothBlocked" },
      { onlineEndReason: "idle", endReason: "opponentBelowThree" },
      { endedAt: 0 },
      { statsJson: "{}" },
      { statsStatus: "error" },
      { actionCount: 0 },
      {
        players: [
          sample.players[0],
          { ...sample.players[1], userId: sample.players[0].userId },
        ],
      },
    ]) {
      expect(
        matchPayloadSchema.safeParse({ ...sample, ...difference }).success,
        JSON.stringify(difference),
      ).toBe(false);
    }
  });

  it("defines the persistable result predicate and additive status", () => {
    const seatKinds = { A: "account", B: "account" } as const;
    expect(
      writesLedgerRow({ seatKinds, playBegan: true, endedBy: "action" }),
    ).toBe(true);
    expect(
      writesLedgerRow({ seatKinds, playBegan: true, endedBy: "claim" }),
    ).toBe(true);
    expect(
      writesLedgerRow({ seatKinds, playBegan: false, endedBy: "claim" }),
    ).toBe(false);
    expect(writesLedgerRow({ seatKinds, playBegan: true, endedBy: null })).toBe(
      false,
    );
    expect(
      writesLedgerRow({
        seatKinds: { ...seatKinds, B: "guest" },
        playBegan: true,
        endedBy: "action",
      }),
    ).toBe(false);
    expect(roomOptionsSchema.parse({})).toEqual({ ratedRequest: false });
    expect(roomOptionsSchema.safeParse({ mode: "quick" }).success).toBe(false);
    const old = matchStatusServerMessageSchema.omit({
      save: true,
      rated: true,
      mode: true,
      ratedRequest: true,
      consent: true,
    });
    const legacy = {
      v: 1,
      type: "matchStatus",
      roomCode: "ABCDEFGH",
      connections: { A: true, B: true },
      idleSlot: null,
      claimableBy: null,
      claimReason: null,
    };
    const next = {
      ...legacy,
      mode: "invite",
      rated: false,
      save: {
        status: "saved",
        matchNumber: 1,
        matchId: sampleMatchPayloads.M2.id,
      },
    };
    expect(old.parse(next)).toEqual(legacy);
    expect(matchStatusServerMessageSchema.parse(next)).toEqual(next);
  });
});
