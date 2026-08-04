import {
  allowedGoogleAvatarUrl,
  avatarColorForUserId,
  avatarInitial,
  avatarModeSchema,
  onlineIdentityStatusSchema,
  onlineIdentityTicketRequestSchema,
  onlineIdentityTicketResponseSchema,
} from "@shaxda/shared";
import {
  IDENTITY_TICKET_TTL_MS,
  mintIdentityTicket,
} from "@shaxda/shared/identity";
import { canonicalAuthOrigin } from "$lib/server/auth/options";
import type { RequestHandler } from "./$types";

export const prerender = false;

export const GET: RequestHandler = ({ locals }) => {
  if (locals.user === null) {
    return json(onlineIdentityStatusSchema.parse({ status: "signedOut" }));
  }

  const username = locals.user.username;
  if (username === null || username === undefined) {
    return json(onlineIdentityStatusSchema.parse({ status: "incomplete" }));
  }

  const avatarMode = avatarModeSchema
    .catch("initial")
    .parse(locals.user.avatarMode);
  const imageUrl =
    avatarMode === "google" ? allowedGoogleAvatarUrl(locals.user.image) : null;
  return json(
    onlineIdentityStatusSchema.parse({
      status: "complete",
      account: {
        username,
        avatar: {
          mode: avatarMode,
          imageUrl,
          color: avatarColorForUserId(locals.user.id),
          initial: avatarInitial(username),
        },
      },
    }),
  );
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (platform?.env === undefined) {
    return json({ error: "identity-unavailable" }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (
    origin !== null &&
    origin !== canonicalAuthOrigin(platform.env.AUTH_BASE_URL)
  ) {
    return json({ error: "cross-origin-request" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "invalid-content-type" }, { status: 415 });
  }

  if (locals.user === null) {
    return json({ error: "signed-out" }, { status: 401 });
  }
  const username = locals.user.username;
  if (username === null || username === undefined) {
    return json({ error: "incomplete-account" }, { status: 409 });
  }

  const secret = platform.env.ONLINE_IDENTITY_SECRET?.trim();
  if (!secret) {
    return json({ error: "identity-unavailable" }, { status: 503 });
  }

  const body = onlineIdentityTicketRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return json({ error: "invalid-request" }, { status: 400 });
  }

  const now = Date.now();
  const avatarMode = avatarModeSchema
    .catch("initial")
    .parse(locals.user.avatarMode);
  const ticket = await mintIdentityTicket(
    {
      iss: "shaxda-web",
      aud: "shaxda-rooms",
      action: body.data.action,
      ...(body.data.roomCode === undefined
        ? {}
        : { roomCode: body.data.roomCode }),
      userId: locals.user.id,
      usernameSnapshot: username,
      avatarMode,
      imageUrl:
        avatarMode === "google"
          ? allowedGoogleAvatarUrl(locals.user.image)
          : null,
      jti: randomJti(),
    },
    secret,
    now,
  );

  return json(
    onlineIdentityTicketResponseSchema.parse({
      ticket,
      expiresAt: now + IDENTITY_TICKET_TTL_MS,
    }),
  );
};

function randomJti(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}
