import { describe, expect, it } from "vitest";
import { legalContentSo, legalSectionIds } from "./legal.so";

function visibleCopy(): string {
  return JSON.stringify(legalContentSo);
}

describe("Somali legal content", () => {
  it("renders the sections in the declared order", () => {
    expect(legalContentSo.sections.map((section) => section.id)).toEqual(
      legalSectionIds,
    );
  });

  it("describes the live Google accounts and their D1 storage", () => {
    const account = legalContentSo.sections.find(
      (section) => section.id === "akoonka",
    );

    expect(account).toBeDefined();
    expect(account?.details.map((item) => item.term)).toEqual([
      "Iimaylka Google",
      "Magaca dadweynaha",
      "Sawirka bogga",
      "Fadhiga gelitaanka",
      "Habka gelitaanka Google",
    ]);

    const copy = visibleCopy();
    expect(copy).toContain("Cloudflare D1");
    expect(copy).toContain("/u/<magaca>");
    expect(copy).toContain("cinwaanka IP-ga, iyo macluumaadka biraawsarka");
  });

  it("no longer claims that accounts, Google sign-in, or D1 are absent", () => {
    const copy = visibleCopy();

    expect(copy).not.toMatch(/ma laha akoon/i);
    expect(copy).not.toMatch(/galitaan Google/i);
    expect(copy).not.toMatch(/Ma jiro kayd D1/i);
    expect(copy).not.toMatch(/kuma xirna kayd D1/i);
    expect(copy).not.toMatch(/uusan jirin akoon/i);
  });

  it("discloses pseudonymous analytics and retention", () => {
    const services = legalContentSo.sections.find(
      (section) => section.id === "adeegyada",
    );

    expect(services?.bullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("summadaha tirakoobka (90 maalmood)"),
      ]),
    );
    const usage = legalContentSo.sections.find(
      (section) => section.id === "cabbiraadda",
    );
    expect(usage?.paragraphs.join(" ")).toMatch(
      /Summaddu waa magac-beddel.*maalmaha isticmaalka waa la isku xiri karaa.*90 maalmood/,
    );
    expect(usage?.paragraphs.join(" ")).toMatch(
      /qolalka la sameeyey ama la galay.*tirooyin maalinle ah.*aqoonsi, koodh qol, ama magac la'aan/,
    );
    expect(visibleCopy()).toContain("shaxda:analytics-active:v1");
  });

  it("discloses friendly and rated match visibility and excludes guest games", () => {
    const data = legalContentSo.sections.find(
      (section) => section.id === "xogta",
    );
    expect(data?.paragraphs.join(" ")).toMatch(
      /labada ciyaaryahanba akoon ku galeen.*Shaxda waxay kaydisaa.*Ciyaaraha uu marti ka qayb qaatay lama kaydiyo/,
    );
    expect(data?.paragraphs.join(" ")).toContain(
      "Ciyaarta Saaxiibtinimada waxaa bogga ku arki kara labada ciyaaryahan oo keliya.",
    );
    expect(data?.paragraphs.join(" ")).toMatch(
      /oggolaadaan Tartan kahor bilowga, qof walba wuu arki karaa natiijada/,
    );
    expect(data?.paragraphs.join(" ")).toContain(
      "Ciyaaraha la kaydiyay way sii jiraan haddii akoon la tirtiro",
    );
    expect(visibleCopy()).not.toContain(
      "Ma bixiyo kayd joogto ah oo natiijooyinka ah",
    );
  });
});
