import { cancelDeletion, requestDeletion } from "@shaxda/db";
import { normalizeUsername } from "@shaxda/shared";
import { error, fail, redirect } from "@sveltejs/kit";
import { z } from "zod";
import { getAuth } from "$lib/server/auth";
import {
  accountDeletePath,
  requireDeletionSession,
} from "$lib/server/auth/deletion";
import { canonicalAuthOrigin } from "$lib/server/auth/options";
import type { Actions, PageServerLoad } from "./$types";

const REAUTH_MS = 15 * 60_000;
const REAUTH_COOKIE = "shaxda-delete-reauth";
const confirmSchema = z.object({
  confirm: z.string().trim().min(1).max(254),
  acknowledge: z.literal("on"),
});

export const load: PageServerLoad = ({ locals }) => {
  const { user, session } = requireDeletionSession(locals);
  const now = Date.now();
  return {
    username: locals.pendingDeletion ? null : (user.username ?? null),
    dueAt: locals.pendingDeletion?.dueAt ?? null,
    now,
    recent: isRecent(session.createdAt, now),
  };
};

type ActionEvent = Parameters<Actions[string]>[0];
function trustedAction(event: ActionEvent) {
  const env = event.platform?.env;
  if (!env) error(503);
  const origin = canonicalAuthOrigin(env.AUTH_BASE_URL);
  if (event.request.headers.get("origin") !== origin) error(403);
  return { ...requireDeletionSession(event.locals), env, origin };
}

function isRecent(createdAt: Date, now: number) {
  const age = now - createdAt.getTime();
  return age >= 0 && age < REAUTH_MS;
}

async function reauthDigest(secret: string, userId: string, expires: number) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`shaxda:a3:reauth:${expires}:${userId}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export const actions: Actions = {
  reauth: async (event) => {
    const { user, env, origin } = trustedAction(event);
    if (event.locals.pendingDeletion) redirect(303, accountDeletePath);
    const expires = Date.now() + REAUTH_MS;
    const digest = await reauthDigest(env.BETTER_AUTH_SECRET, user.id, expires);
    const auth = getAuth(env);
    const response = await auth.api.signInSocial({
      asResponse: true,
      headers: event.request.headers,
      body: {
        provider: "google",
        callbackURL: accountDeletePath,
        errorCallbackURL: accountDeletePath,
        disableRedirect: true,
      },
    });
    const result = z
      .object({ url: z.url({ protocol: /^https$/ }) })
      .safeParse(await response.json());
    if (!response.ok || !result.success)
      return fail(503, { error: "requestFailed" });
    event.cookies.set(REAUTH_COOKIE, `${expires}.${digest}`, {
      path: accountDeletePath,
      maxAge: REAUTH_MS / 1000,
      sameSite: "lax",
      httpOnly: true,
      secure: origin.startsWith("https://"),
    });
    redirect(303, result.data.url);
  },
  request: async (event) => {
    const { session, user, env } = trustedAction(event);
    if (event.locals.pendingDeletion)
      return { dueAt: event.locals.pendingDeletion.dueAt };
    const now = Date.now();
    const reauth = event.cookies.get(REAUTH_COOKIE);
    if (reauth) {
      const [rawExpiry, digest] = reauth.split(".");
      const expires = Number(rawExpiry);
      if (
        !Number.isSafeInteger(expires) ||
        expires <= now ||
        digest !==
          (await reauthDigest(env.BETTER_AUTH_SECRET, user.id, expires)) ||
        session.createdAt.getTime() < expires - REAUTH_MS
      ) {
        return fail(403, { error: "differentAccount" });
      }
    }
    if (!isRecent(session.createdAt, now))
      return fail(403, { error: "reauth" });

    const form = await event.request.formData().catch(() => null);
    if (!form) return fail(400, { error: "requestFailed" });
    const values = confirmSchema.safeParse({
      confirm: form.get("confirm"),
      acknowledge: form.get("acknowledge"),
    });
    if (!values.success)
      return fail(400, {
        error:
          form.get("acknowledge") === "on"
            ? "confirmMismatch"
            : "acknowledgeRequired",
      });
    const matches = user.username
      ? normalizeUsername(values.data.confirm) === user.username
      : values.data.confirm.toLowerCase() === user.email.trim().toLowerCase();
    if (!matches) return fail(400, { error: "confirmMismatch" });

    const dueAt = await requestDeletion(env.DB, user.id, now);
    if (dueAt === null) return fail(409, { error: "requestFailed" });
    event.cookies.delete(REAUTH_COOKIE, { path: accountDeletePath });
    await getAuth(env).api.signOut({ headers: event.request.headers });
    event.locals.pendingDeletion = { dueAt };
    return { requested: true, dueAt };
  },
  cancel: async (event) => {
    const { user, env } = trustedAction(event);
    if (!(await cancelDeletion(env.DB, user.id, Date.now())))
      return fail(409, { error: "tooLateToCancel" });
    event.locals.pendingDeletion = undefined;
    return { cancelled: true };
  },
};
