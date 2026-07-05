import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./index";

describe("healthResponseSchema", () => {
  it("accepts the scaffold health payload", () => {
    expect(healthResponseSchema.parse({ ok: true, service: "shaxda" })).toEqual(
      {
        ok: true,
        service: "shaxda",
      },
    );
  });
});
