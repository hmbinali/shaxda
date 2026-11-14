import { readDeletion, revokeSession } from "@shaxda/db";
import { redirect } from "@sveltejs/kit";
import { getAuth } from ".";
import type { AuthEnvironment } from "./options";

export const accountDeletePath = "/account/delete";
const pendingAuthPaths = new Set([
  "/api/auth/sign-in/social",
  "/api/auth/callback/google",
  "/api/auth/get-session",
  "/api/auth/sign-out",
]);
const accountPages = new Set([
  "/login",
  "/register",
  "/account",
  "/history",
  "/admin/stats",
]);

export async function resolveAccountSession(
  env: AuthEnvironment,
  headers: Headers,
) {
  const result = await getAuth(env).api.getSession({ headers });
  if (!result) return null;
  const deletion = await readDeletion(env.DB, result.user.id);
  if (!deletion || deletion.deleted_at !== null) {
    await revokeSession(env.DB, result.session.id, result.user.id);
    return null;
  }
  return { ...result, dueAt: deletion.deletion_due_at };
}

export function restrictPendingAccount(event: {
  url: URL;
  request: Request;
  locals: App.Locals;
}): Response | undefined {
  const path = decodeURIComponent(event.url.pathname)
    .replace(/\/__data\.json$/, "")
    .replace(/\/+$/, "");
  if (
    path === accountDeletePath ||
    (path === "/logout" && event.request.method === "POST") ||
    pendingAuthPaths.has(path)
  )
    return;
  if (
    path === "/api/online/identity" ||
    path.startsWith("/api/auth/") ||
    path === "/api/auth"
  ) {
    return Response.json(
      { error: "account-pending-deletion" },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  if (accountPages.has(path)) {
    return new Response(null, {
      status: 303,
      headers: { Location: accountDeletePath, "Cache-Control": "no-store" },
    });
  }
  event.locals.session = null;
  event.locals.user = null;
}

export function requireDeletionSession(locals: App.Locals) {
  if (!locals.session || !locals.user)
    redirect(303, `/login?returnTo=${accountDeletePath}`);
  return { session: locals.session, user: locals.user };
}
