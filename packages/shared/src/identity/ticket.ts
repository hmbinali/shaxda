import { z } from "zod";
import { avatarModeSchema } from "../account/avatar";
import { usernameSchema } from "../account/username";
import { roomCodeSchema } from "../schemas";

export const IDENTITY_TICKET_TTL_MS = 90_000;
export const IDENTITY_TICKET_SKEW_MS = 5_000;
export const IDENTITY_TICKET_MAX_LENGTH = 1_024;

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
const httpsUrlSchema = z
  .string()
  .max(512)
  .url()
  .refine((value) => new URL(value).protocol === "https:");

export const ticketActionSchema = z.enum(["create", "join", "reconnect"]);
export type TicketAction = z.infer<typeof ticketActionSchema>;

export const identityTicketPayloadSchema = z
  .object({
    iss: z.literal("shaxda-web"),
    aud: z.literal("shaxda-rooms"),
    action: ticketActionSchema,
    roomCode: roomCodeSchema.optional(),
    userId: z.string().min(1).max(64),
    usernameSnapshot: usernameSchema,
    avatarMode: avatarModeSchema,
    imageUrl: z.union([httpsUrlSchema, z.null()]),
    jti: z.string().min(16).max(64).regex(base64UrlPattern),
    iat: z.number().int().positive(),
    exp: z.number().int().positive(),
  })
  .superRefine((payload, ctx) => {
    if (payload.action === "create" && payload.roomCode !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["roomCode"],
        message: "Create tickets must not carry a room code.",
      });
    }
    if (payload.action !== "create" && payload.roomCode === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["roomCode"],
        message: "Join and reconnect tickets require a room code.",
      });
    }
    if (payload.exp <= payload.iat) {
      ctx.addIssue({
        code: "custom",
        path: ["exp"],
        message: "Ticket expiry must follow its issued time.",
      });
    }
  });

export type IdentityTicketPayload = z.infer<typeof identityTicketPayloadSchema>;
export type IdentityTicketMintPayload = Omit<
  IdentityTicketPayload,
  "iat" | "exp"
>;

export const identityTicketSchema = z
  .string()
  .max(IDENTITY_TICKET_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

export type IdentityTicketVerifyCode =
  "malformed" | "signature" | "payload" | "expired" | "scope";

export type IdentityTicketVerifyResult =
  | { ok: true; payload: IdentityTicketPayload }
  | { ok: false; code: IdentityTicketVerifyCode };

export interface IdentityTicketExpectedScope {
  allowedActions: readonly TicketAction[];
  roomCode?: string;
}

export async function mintIdentityTicket(
  payload: IdentityTicketMintPayload,
  secret: string,
  now: number,
): Promise<string> {
  if (secret.length === 0) {
    throw new Error("An online identity secret is required.");
  }

  const claims = identityTicketPayloadSchema.parse({
    ...payload,
    iat: now,
    exp: now + IDENTITY_TICKET_TTL_MS,
  });
  const encodedPayload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(claims)),
  );
  const signature = await sign(encodedPayload, secret);
  const ticket = `${encodedPayload}.${encodeBase64Url(signature)}`;
  return identityTicketSchema.parse(ticket);
}

export async function verifyIdentityTicket(
  ticket: string,
  secrets: readonly string[],
  expected: IdentityTicketExpectedScope,
  now: number,
): Promise<IdentityTicketVerifyResult> {
  if (!identityTicketSchema.safeParse(ticket).success) {
    return { ok: false, code: "malformed" };
  }

  const [encodedPayload, encodedSignature] = ticket.split(".") as [
    string,
    string,
  ];
  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = decodeBase64Url(encodedSignature);
  } catch {
    return { ok: false, code: "malformed" };
  }

  const usableSecrets = secrets.filter((secret) => secret.length > 0);
  const signatureChecks = await Promise.all(
    usableSecrets.map(async (secret) => {
      const key = await importHmacKey(secret, ["verify"]);
      return crypto.subtle.verify(
        "HMAC",
        key,
        signature,
        new TextEncoder().encode(encodedPayload),
      );
    }),
  );
  if (!signatureChecks.some(Boolean)) {
    return { ok: false, code: "signature" };
  }

  let decodedPayload: unknown;
  try {
    decodedPayload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        decodeBase64Url(encodedPayload),
      ),
    );
  } catch {
    return { ok: false, code: "payload" };
  }

  const parsed = identityTicketPayloadSchema.safeParse(decodedPayload);
  if (!parsed.success) {
    return { ok: false, code: "payload" };
  }

  const payload = parsed.data;
  if (
    payload.iat > now + IDENTITY_TICKET_SKEW_MS ||
    payload.exp <= now - IDENTITY_TICKET_SKEW_MS ||
    payload.exp - payload.iat > IDENTITY_TICKET_TTL_MS
  ) {
    return { ok: false, code: "expired" };
  }

  if (
    !expected.allowedActions.includes(payload.action) ||
    (expected.roomCode !== undefined &&
      payload.roomCode !== expected.roomCode) ||
    (expected.roomCode === undefined && payload.roomCode !== undefined)
  ) {
    return { ok: false, code: "scope" };
  }

  return { ok: true, payload };
}

async function sign(value: string, secret: string): Promise<ArrayBuffer> {
  const key = await importHmacKey(secret, ["sign"]);
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}

async function importHmacKey(
  secret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!base64UrlPattern.test(value)) throw new Error("Invalid base64url.");
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
