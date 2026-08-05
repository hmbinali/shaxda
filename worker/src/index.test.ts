import { env, reset, SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import {
  IDENTITY_TICKET_SKEW_MS,
  IDENTITY_TICKET_TTL_MS,
  mintIdentityTicket,
} from "@shaxda/shared/identity";
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

  it("accepts a valid create ticket without storing creator identity", async () => {
    const testEnv = environment();
    const ticket = await createTicket(testEnv.ONLINE_IDENTITY_SECRET);
    const response = await worker.fetch(roomRequest(ticket), testEnv);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      type: "roomCreated",
    });
  });

  it.each([
    ["invalid", 0, "create"],
    ["expired", IDENTITY_TICKET_TTL_MS + IDENTITY_TICKET_SKEW_MS, "create"],
    ["scope", 0, "join"],
  ] as const)("rejects an %s create ticket", async (_name, age, action) => {
    const testEnv = environment();
    let ticket = await createTicket(
      testEnv.ONLINE_IDENTITY_SECRET,
      Date.now() - age,
      action,
    );
    if (_name === "invalid") {
      const [payload, signature = ""] = ticket.split(".");
      ticket = `${payload}.${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
    }
    const response = await worker.fetch(roomRequest(ticket), testEnv);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code:
        _name === "invalid"
          ? "identityInvalid"
          : _name === "expired"
            ? "identityExpired"
            : "identityScope",
    });
  });

  it("fails closed when a create ticket is present without a secret", async () => {
    const ticket = await createTicket("temporary-test-secret");
    const testEnv = environment();
    delete testEnv.ONLINE_IDENTITY_SECRET;
    const response = await worker.fetch(roomRequest(ticket), testEnv);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "identityUnavailable",
      code: "identityUnavailable",
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

type WorkerEnvironment = {
  MATCH_ROOM: DurableObjectNamespace;
  MATCH_COORDINATOR: DurableObjectNamespace;
  ONLINE_IDENTITY_SECRET?: string;
};

function environment(): WorkerEnvironment {
  return {
    ...(env as WorkerEnvironment),
    ONLINE_IDENTITY_SECRET:
      (env as WorkerEnvironment).ONLINE_IDENTITY_SECRET ??
      "shaxda-online-identity-dev-test-secret-000000000001",
  };
}

function roomRequest(identityTicket: string): Request {
  return new Request("https://shaxda.test/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityTicket }),
  });
}

async function createTicket(
  secret: string | undefined,
  now = Date.now(),
  action: "create" | "join" = "create",
): Promise<string> {
  if (!secret) throw new Error("Expected test identity secret.");
  return mintIdentityTicket(
    {
      iss: "shaxda-web",
      aud: "shaxda-rooms",
      action,
      ...(action === "join" ? { roomCode: "ABCDEFGH" } : {}),
      userId: "user-id-a",
      usernameSnapshot: "ayaan_7",
      avatarMode: "initial",
      imageUrl: null,
      jti: "createticket00001",
    },
    secret,
    now,
  );
}

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
