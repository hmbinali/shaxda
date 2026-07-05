import { describe, expect, it } from "vitest";
import { databasePackage } from "./index";

describe("database package", () => {
  it("declares the D1 package boundary", () => {
    expect(databasePackage.runtime).toBe("cloudflare-d1");
  });
});
