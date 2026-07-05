import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("worker", () => {
  it("responds to health checks", async () => {
    const response = await SELF.fetch("https://shaxda.test/health");

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "shaxda",
    });
  });
});
