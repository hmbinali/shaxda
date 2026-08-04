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
      "account",
      "home",
      "learn",
      "legal",
      "login",
      "profile",
      "register",
    ]);

    for (const page of Object.values(pages)) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
      expect(page.path).toMatch(/^\//);
    }
  });

  it("provides one complete combined legal destination", () => {
    const { legal } = siteContent.so.pages;
    const sectionIds = legal.sections.map((section) => section.id);

    expect(legal.path).toBe("/legal");
    expect(sectionIds.length).toBeGreaterThan(0);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(legal.sections.every((section) => section.heading.length > 0)).toBe(
      true,
    );
    expect(sectionIds.every((id) => /^[a-z-]+$/.test(id))).toBe(true);
    expect(siteContent.so.nav).not.toHaveProperty("privacy");
    expect(siteContent.so.nav).not.toHaveProperty("terms");
  });

  it("preserves required Somali game terms in public content", () => {
    const content = JSON.stringify(siteContent.so).toLowerCase();

    expect(content).toContain("shaxda");
    expect(content).toContain("jare");
    expect(content).toContain("irmaan");
  });

  it("uses learn as the only public rules destination", () => {
    expect(siteContent.so.pages.learn.path).toBe("/learn");
    expect(siteContent.so.nav).not.toHaveProperty("rules");
    expect(siteContent.so.pages).not.toHaveProperty("rules");
  });

  it("provides Somali copy for not-found and unexpected errors", () => {
    expect(siteContent.so.errorPage).toMatchObject({
      notFound: { title: "Bogga lama helin" },
      unexpected: { title: "Waxbaa khaldamay" },
    });
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

  it("covers online resilience result reasons", () => {
    expect(Object.keys(messages.so.onlineGame.result.reasons).sort()).toEqual([
      "opponentAbandoned",
      "opponentIdleTimeout",
    ]);
    for (const reason of Object.values(messages.so.onlineGame.result.reasons)) {
      expect(reason.winner.length).toBeGreaterThan(0);
      expect(reason.loser.length).toBeGreaterThan(0);
    }
  });
});
