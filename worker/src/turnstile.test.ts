import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

describe("verifyTurnstile", () => {
  it("bypasses verification when no secret is configured", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;

    await expect(
      verifyTurnstile(undefined, undefined, "127.0.0.1", fetchFn),
    ).resolves.toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fails when a secret is configured without a token", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;

    await expect(
      verifyTurnstile(undefined, "secret", "127.0.0.1", fetchFn),
    ).resolves.toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("passes successful siteverify responses", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ success: true }),
    ) as unknown as typeof fetch;

    await expect(
      verifyTurnstile("token", "secret", "127.0.0.1", fetchFn),
    ).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("fails unsuccessful siteverify responses", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ success: false }),
    ) as unknown as typeof fetch;

    await expect(
      verifyTurnstile("token", "secret", "127.0.0.1", fetchFn),
    ).resolves.toBe(false);
  });
});
