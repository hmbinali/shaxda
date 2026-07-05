import { describe, expect, it } from "vitest";
import { designTokens } from "./index";

describe("ui package", () => {
  it("exposes shared design tokens", () => {
    expect(designTokens.radius.card).toBe("0.5rem");
  });
});
