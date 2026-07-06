import { messages } from "@shaxda/i18n";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it } from "vitest";

describe("board fixture copy", () => {
  it("covers every canonical fixture rendered by the board gallery", () => {
    const fixtureKeys = Object.keys(gameFixtures).sort();
    const copy = messages.so.boardGallery;

    expect(Object.keys(copy.fixtureLabels).sort()).toEqual(fixtureKeys);
    expect(Object.keys(copy.fixtureDescriptions).sort()).toEqual(fixtureKeys);
  });
});
