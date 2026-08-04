import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./redirects";

describe("safeInternalPath", () => {
  it.each([
    ["/account", "/account"],
    ["/ok?next=//evil.com", "/ok?next=//evil.com"],
    ["//evil.com", "/fallback"],
    ["/\\evil.com", "/fallback"],
    ["/%5cevil.com", "/fallback"],
    ["%2f%2fevil.com", "/fallback"],
    ["https://evil.com", "/fallback"],
    ["javascript:alert(1)", "/fallback"],
    ["/a%zz", "/fallback"],
    ["/a\nb", "/fallback"],
    ["", "/fallback"],
  ])("maps %j to %j", (value, expected) => {
    expect(safeInternalPath(value, "/fallback")).toBe(expected);
  });

  it("rejects overlong return paths", () => {
    expect(safeInternalPath(`/${"a".repeat(512)}`, "/fallback")).toBe(
      "/fallback",
    );
  });
});
