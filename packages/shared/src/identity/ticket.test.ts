import { describe, expect, it } from "vitest";
import {
  IDENTITY_TICKET_SKEW_MS,
  IDENTITY_TICKET_TTL_MS,
  identityTicketPayloadSchema,
  mintIdentityTicket,
  verifyIdentityTicket,
} from "./ticket";

const NOW = 1_800_000_000_000;
const SECRET = "shared-test-secret-with-enough-entropy";
const BASE_PAYLOAD = {
  iss: "shaxda-web" as const,
  aud: "shaxda-rooms" as const,
  action: "join" as const,
  roomCode: "ABCDEFGH",
  userId: "user_123",
  usernameSnapshot: "ayaan_7",
  avatarMode: "google" as const,
  imageUrl: "https://lh3.googleusercontent.com/a/photo",
  jti: "abcdefghijklmnop",
};

function mutatePart(ticket: string, part: 0 | 1): string {
  const pieces = ticket.split(".");
  const value = pieces[part] ?? "";
  pieces[part] = `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`;
  return pieces.join(".");
}

describe("online identity tickets", () => {
  it("round-trips a scoped ticket", async () => {
    const ticket = await mintIdentityTicket(BASE_PAYLOAD, SECRET, NOW);
    await expect(
      verifyIdentityTicket(
        ticket,
        [SECRET],
        { allowedActions: ["join", "reconnect"], roomCode: "ABCDEFGH" },
        NOW,
      ),
    ).resolves.toMatchObject({
      ok: true,
      payload: { ...BASE_PAYLOAD, iat: NOW, exp: NOW + IDENTITY_TICKET_TTL_MS },
    });
  });

  it.each([
    ["malformed", "not-a-ticket"],
    ["malformed", `${"a".repeat(1_025)}.x`],
  ] as const)("rejects %s wire input", async (code, ticket) => {
    await expect(
      verifyIdentityTicket(ticket, [SECRET], { allowedActions: ["join"] }, NOW),
    ).resolves.toEqual({ ok: false, code });
  });

  it("rejects payload and signature tampering", async () => {
    const ticket = await mintIdentityTicket(BASE_PAYLOAD, SECRET, NOW);
    for (const tampered of [mutatePart(ticket, 0), mutatePart(ticket, 1)]) {
      await expect(
        verifyIdentityTicket(
          tampered,
          [SECRET],
          { allowedActions: ["join"], roomCode: "ABCDEFGH" },
          NOW,
        ),
      ).resolves.toEqual({ ok: false, code: "signature" });
    }
  });

  it("rejects the wrong secret and accepts the previous secret", async () => {
    const ticket = await mintIdentityTicket(BASE_PAYLOAD, SECRET, NOW);
    await expect(
      verifyIdentityTicket(
        ticket,
        ["wrong-secret"],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW,
      ),
    ).resolves.toEqual({ ok: false, code: "signature" });
    await expect(
      verifyIdentityTicket(
        ticket,
        ["new-secret", SECRET],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW,
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("enforces expiry, future-issued time, and maximum lifetime", async () => {
    const expired = await mintIdentityTicket(BASE_PAYLOAD, SECRET, NOW);
    await expect(
      verifyIdentityTicket(
        expired,
        [SECRET],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW + IDENTITY_TICKET_TTL_MS + IDENTITY_TICKET_SKEW_MS,
      ),
    ).resolves.toEqual({ ok: false, code: "expired" });

    const future = await mintIdentityTicket(
      { ...BASE_PAYLOAD, jti: "futurefuturefuture1" },
      SECRET,
      NOW + IDENTITY_TICKET_SKEW_MS + 1,
    );
    await expect(
      verifyIdentityTicket(
        future,
        [SECRET],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW,
      ),
    ).resolves.toEqual({ ok: false, code: "expired" });

    const longPayload = identityTicketPayloadSchema.parse({
      ...BASE_PAYLOAD,
      jti: "longlonglonglong",
      iat: NOW,
      exp: NOW + IDENTITY_TICKET_TTL_MS + 1,
    });
    const long = await mintIdentityTicket(
      { ...longPayload, exp: undefined, iat: undefined },
      SECRET,
      NOW,
      IDENTITY_TICKET_TTL_MS + 1,
    );
    await expect(
      verifyIdentityTicket(
        long,
        [SECRET],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW,
      ),
    ).resolves.toEqual({ ok: false, code: "expired" });
  });

  it("accepts both time-skew boundaries", async () => {
    const ticket = await mintIdentityTicket(BASE_PAYLOAD, SECRET, NOW);
    await expect(
      verifyIdentityTicket(
        ticket,
        [SECRET],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW - IDENTITY_TICKET_SKEW_MS,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      verifyIdentityTicket(
        ticket,
        [SECRET],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW + IDENTITY_TICKET_TTL_MS + IDENTITY_TICKET_SKEW_MS - 1,
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("enforces action and room scope", async () => {
    const ticket = await mintIdentityTicket(BASE_PAYLOAD, SECRET, NOW);
    for (const expected of [
      { allowedActions: ["create"] as const },
      { allowedActions: ["join"] as const, roomCode: "BCDEFGHJ" },
    ]) {
      await expect(
        verifyIdentityTicket(ticket, [SECRET], expected, NOW),
      ).resolves.toEqual({ ok: false, code: "scope" });
    }
  });

  it.each([
    [{ ...BASE_PAYLOAD, action: "create", roomCode: "ABCDEFGH" }, "payload"],
    [{ ...BASE_PAYLOAD, roomCode: undefined }, "payload"],
    [{ ...BASE_PAYLOAD, usernameSnapshot: "Ayaan" }, "payload"],
    [
      { ...BASE_PAYLOAD, imageUrl: `https://example.com/${"x".repeat(500)}` },
      "payload",
    ],
  ] as const)("rejects invalid payload %#", async (payload, code) => {
    await expect(mintIdentityTicket(payload, SECRET, NOW)).rejects.toThrow();
    expect(code).toBe("payload");
  });
});
