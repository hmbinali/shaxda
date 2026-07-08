import { env, reset, SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import worker from "./index";
import { CREATE_MAX_PER_IP } from "./room-coordinator";

describe("worker", () => {
  afterEach(async () => {
    await reset();
  });

  it("responds to health checks", async () => {
    const response = await SELF.fetch("https://shaxda.test/health");

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "shaxda",
    });
  });

  it("bypasses Turnstile locally when no secret is configured", async () => {
    const response = await SELF.fetch("https://shaxda.test/rooms", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      type: "roomCreated",
    });
  });

  it("fails room creation when Turnstile is configured without a token", async () => {
    const response = await worker.fetch(
      new Request("https://shaxda.test/rooms", { method: "POST" }),
      {
        ...(env as {
          MATCH_ROOM: DurableObjectNamespace;
          MATCH_COORDINATOR: DurableObjectNamespace;
        }),
        TURNSTILE_SECRET: "secret",
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "turnstileFailed",
      code: "turnstileFailed",
    });
  });

  it("returns stable rate-limit codes from room creation", async () => {
    for (let index = 0; index < CREATE_MAX_PER_IP; index += 1) {
      const response = await SELF.fetch("https://shaxda.test/rooms", {
        method: "POST",
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { roomCode?: string };
      if (!body.roomCode) {
        throw new Error("Expected created room code.");
      }
      await releaseRoom(body.roomCode);
    }

    const limited = await SELF.fetch("https://shaxda.test/rooms", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });

    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({
      error: "rateLimited",
      code: "rateLimited",
    });
  });
});

async function releaseRoom(roomCode: string): Promise<void> {
  const testEnv = env as {
    MATCH_COORDINATOR: DurableObjectNamespace;
  };
  const coordinator = testEnv.MATCH_COORDINATOR.get(
    testEnv.MATCH_COORDINATOR.idFromName("global"),
  );
  await coordinator.fetch("https://shaxda.test/internal/coordinator/release", {
    method: "POST",
    body: JSON.stringify({ roomCode }),
    headers: { "Content-Type": "application/json" },
  });
}
