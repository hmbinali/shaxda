import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { ratedPlaySo } from "../../i18n/src/content/rated-play.so";
import { z } from "zod";
import {
  clientMessageSchema,
  rematchStatusServerMessageSchema,
  matchStatusServerMessageSchema,
  protocolVersion,
} from "./schemas";
import { RATED_DISCLOSURE_V } from "./rated-play";

const envelope = { v: protocolVersion, roomCode: "ABCDEFGH" } as const;

describe("rated play protocol", () => {
  it("pins the Somali disclosure strings by version", () => {
    const hashes: Record<number, string> = {
      1: "bf60c6bf41e0eaa3617e1b37c8dbc560b885ef6c904df8aded074ee069b24906",
    };
    expect(
      createHash("sha256")
        .update(JSON.stringify(ratedPlaySo.disclosure))
        .digest("hex"),
    ).toBe(hashes[RATED_DISCLOSURE_V]);
  });
  it("requires the match generation and disclosure version for consent", () => {
    const message = {
      ...envelope,
      type: "rateConsent",
      matchNumber: 1,
      accept: true,
      disclosureV: RATED_DISCLOSURE_V,
    };
    expect(clientMessageSchema.parse(message)).toEqual(message);
    expect(
      clientMessageSchema.safeParse({ ...message, matchNumber: undefined })
        .success,
    ).toBe(false);
    expect(
      clientMessageSchema.safeParse({ ...message, disclosureV: undefined })
        .success,
    ).toBe(false);
  });

  it("accepts both old and rated rematch votes", () => {
    const legacy = { ...envelope, type: "rematch", vote: "accept" };
    const rated = {
      ...legacy,
      matchNumber: 2,
      rated: true,
      disclosureV: RATED_DISCLOSURE_V,
    };
    expect(clientMessageSchema.parse(legacy)).toEqual(legacy);
    expect(clientMessageSchema.parse(rated)).toEqual(rated);
  });

  it("keeps the original v1 status shapes readable by cached clients", () => {
    const legacyMatch = matchStatusServerMessageSchema.omit({
      mode: true,
      ratedRequest: true,
      consent: true,
      rated: true,
      save: true,
    });
    const legacyRematch = rematchStatusServerMessageSchema.omit({
      ratedVotes: true,
    });
    const legacy = z.discriminatedUnion("type", [legacyMatch, legacyRematch]);
    const match = {
      ...envelope,
      type: "matchStatus",
      connections: { A: true, B: true },
      idleSlot: null,
      claimableBy: null,
      claimReason: null,
    };
    const rematch = {
      ...envelope,
      type: "rematchStatus",
      matchNumber: 1,
      votes: { A: "accept", B: null },
    };
    expect(
      legacy.parse({
        ...match,
        mode: "invite",
        ratedRequest: true,
        consent: { A: true, B: true },
        rated: true,
        save: { status: "pending", matchNumber: 1 },
      }),
    ).toEqual(match);
    expect(
      legacy.parse({ ...rematch, ratedVotes: { A: true, B: null } }),
    ).toEqual(rematch);
  });
});
