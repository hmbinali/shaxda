import { createHash } from "node:crypto";
import { messages } from "@shaxda/i18n";
import { RATED_DISCLOSURE_V } from "@shaxda/shared/rated-play";
import { describe, expect, it } from "vitest";
import { ratedLabel } from "./label";

describe("rating labels", () => {
  const copy = messages.so.ratedPlay;

  it("pins the displayed Somali disclosure by version", () => {
    const hashes: Record<number, string> = {
      1: "bf60c6bf41e0eaa3617e1b37c8dbc560b885ef6c904df8aded074ee069b24906",
    };
    expect(
      createHash("sha256")
        .update(JSON.stringify(copy.disclosure))
        .digest("hex"),
    ).toBe(hashes[RATED_DISCLOSURE_V]);
  });

  it("shows pending, held, and processed rated outcomes", () => {
    expect(ratedLabel(true)).toMatchObject({
      mode: "Tartan",
      detail: copy.status.pending,
    });
    expect(ratedLabel(true, { status: "held" })).toMatchObject({
      mode: "Tartan",
      detail: copy.status.held,
    });
    expect(ratedLabel(true, { status: "processed" })).toMatchObject({
      mode: "Tartan",
      detail: null,
    });
  });

  it("keeps the rated label for a skipped public match", () => {
    expect(
      ratedLabel(true, { status: "skipped", reason: "pairCap" }),
    ).toMatchObject({
      mode: "Tartan",
      status: copy.status.notCounted,
      detail: copy.reason.pairCap,
    });
    expect(
      ratedLabel(true, { status: "skipped", reason: "invalidated" }),
    ).toMatchObject({
      mode: "Tartan",
      status: copy.status.removed,
      detail: copy.reason.invalidated,
    });
  });

  it("only displays the friendly label and its privacy reminder for friendly matches", () => {
    expect(
      ratedLabel(false, { status: "skipped", reason: "friendly" }),
    ).toEqual({
      mode: "Saaxiibtinimo",
      detail: copy.friendlyPrivate,
    });
  });
});
