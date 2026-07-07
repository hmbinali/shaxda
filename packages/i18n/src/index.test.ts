import { describe, expect, it } from "vitest";
import { defaultLocale, locales, messages, siteContent } from "./index";

describe("i18n scaffold", () => {
  it("defaults to Somali as the only V1.0 locale", () => {
    expect(defaultLocale).toBe("so");
    expect(locales).toEqual(["so"]);
    expect(messages.so.appName).toBe("Shaxda");
  });

  it("provides metadata for every C1 public page", () => {
    const pages = siteContent.so.pages;

    expect(Object.keys(pages).sort()).toEqual([
      "home",
      "learn",
      "privacy",
      "rules",
      "terms",
    ]);

    for (const page of Object.values(pages)) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
      expect(page.path).toMatch(/^\//);
    }
  });

  it("preserves required Somali game terms in public content", () => {
    const content = JSON.stringify(siteContent.so).toLowerCase();

    expect(content).toContain("shaxda");
    expect(content).toContain("jare");
    expect(content).toContain("irmaan");
  });

  it("lists every valid jare line on the rules page", () => {
    expect(siteContent.so.pages.rules.jareLines).toHaveLength(16);
    expect(siteContent.so.pages.rules.jareLines).toContain("O1 - O2 - O3");
    expect(siteContent.so.pages.rules.jareLines).toContain("O8 - M8 - I8");
  });

  it("covers every current local game end reason", () => {
    expect(Object.keys(messages.so.localGame.result.reasons).sort()).toEqual([
      "bothBlocked",
      "drawTermination",
      "forcedJareSpaceMaking",
      "opponentBelowThree",
      "opponentCapturedAll",
      "resignation",
    ]);
  });
});
