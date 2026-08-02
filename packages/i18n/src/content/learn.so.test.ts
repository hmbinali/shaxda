import { describe, expect, it } from "vitest";
import { learnContentSo, learnSectionIds } from "./learn.so";

describe("Somali learn content", () => {
  it("uses the nine ordered sections and seven coordinate-free frames", () => {
    expect(learnContentSo.sections.map((section) => section.id)).toEqual(
      learnSectionIds,
    );

    const frameIds: string[] = [];

    for (const section of learnContentSo.sections) {
      for (const group of section.diagramGroups) {
        frameIds.push(...group.frames.map((frame) => frame.id));
      }
    }

    expect(frameIds).toHaveLength(7);
    expect(JSON.stringify(learnContentSo)).not.toMatch(/\b[OMI][1-8]\b/);
  });

  it("stays within the approved visible-word budget", () => {
    const count = visibleCopy(learnContentSo).reduce(
      (total, value) => total + wordCount(value),
      0,
    );

    expect(count).toBeGreaterThanOrEqual(1_250);
    expect(count).toBeLessThanOrEqual(1_400);
  });

  it("introduces the game before the guide and configures equal play actions", () => {
    expect(learnContentSo.hero.intro.indexOf("Shaxdu waa")).toBeLessThan(
      learnContentSo.hero.intro.indexOf("Hagahan"),
    );

    const irmaan = learnContentSo.sections.find(
      (section) => section.id === "irmaan",
    );
    const summary = learnContentSo.sections.find(
      (section) => section.id === "koobid",
    );

    expect(irmaan).toBeDefined();
    expect(irmaan !== undefined && "photo" in irmaan).toBe(true);

    if (irmaan !== undefined && "photo" in irmaan) {
      expect(irmaan.photo).toMatchObject({
        src: "/images/learn/irmaan-example.jpg",
        width: 960,
        height: 1280,
      });
      expect(irmaan.photo.alt).toContain("irmaan");
      expect(irmaan.photo.caption).toContain("loox dhab ah");
    }

    expect(summary?.ctas.map((cta) => cta.tone)).toEqual(["emerald", "sky"]);
    expect(summary?.ctas.every((cta) => !("description" in cta))).toBe(true);
  });

  it("keeps advice explicit and complete rules firm", () => {
    const advice = learnContentSo.sections.find(
      (section) => section.id === "talooyin",
    );
    const rules = JSON.stringify(
      learnContentSo.sections.filter((section) => section.id !== "talooyin"),
    );

    expect(advice?.callouts).toContainEqual(
      expect.objectContaining({ variant: "talo" }),
    );
    expect(rules).toContain("80 wareeg");
    expect(rules).toContain("3 jeer");
    expect(rules).toContain("wax ka yar 3 dhagax");
    expect(rules).toContain("Jare la sameeyo xilliga dhigista");
    expect(rules).toContain("16 sadar");
    expect(rules).toContain("4 khad");
  });
});

function visibleCopy(content: typeof learnContentSo): string[] {
  return [
    content.hero.eyebrow,
    content.hero.heading,
    content.hero.intro,
    ...content.sections.flatMap((section) => [
      section.navLabel,
      section.heading,
      ...section.paragraphs,
      ...section.subsections.flatMap((subsection) => [
        subsection.heading,
        ...subsection.paragraphs,
        ...subsection.rules,
      ]),
      ...section.rules,
      ...section.callouts.map((callout) => callout.body),
      ...("photo" in section ? [section.photo.caption] : []),
      ...section.diagramGroups.flatMap((group) =>
        group.frames.flatMap((frame) => [frame.title, frame.caption]),
      ),
      ...section.summary.flatMap((item) => [item.term, item.detail]),
      ...section.ctas.map((cta) => cta.label),
    ]),
  ];
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}
