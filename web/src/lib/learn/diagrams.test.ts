import { describe, expect, it } from "vitest";
import { getLearnDiagram, learnDiagramIds, learnDiagrams } from "./diagrams";

describe("learn diagram registry", () => {
  it("resolves all seven static teaching frames", () => {
    expect(learnDiagramIds).toHaveLength(7);

    for (const id of learnDiagramIds) {
      expect(getLearnDiagram(id)).toBe(learnDiagrams[id]);
    }
  });

  it("keeps implementation coordinates out of visible overlay labels", () => {
    for (const diagram of Object.values(learnDiagrams)) {
      for (const mark of diagram.marks) {
        expect(mark.label).not.toMatch(/\b[OMI][1-8]\b/);
      }
    }
  });
});
