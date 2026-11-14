import { error, redirect } from "@sveltejs/kit";
import { safeInternalPath } from "./redirects";

type AdminEnvironment = Pick<App.Platform["env"], "ADMIN_USER_IDS">;

export function isAdminUser(
  env: AdminEnvironment | undefined,
  userId: string | undefined,
): boolean {
  return Boolean(userId && env?.ADMIN_USER_IDS?.split(",").includes(userId));
}

export function requireAdmin(
  locals: App.Locals,
  env: AdminEnvironment | undefined,
  url: URL,
): NonNullable<App.Locals["user"]> {
  if (locals.user === null) {
    const query = new URLSearchParams({
      returnTo: safeInternalPath(url.pathname),
    });
    redirect(303, `/login?${query}`);
  }
  if (!isAdminUser(env, locals.user.id)) error(403);
  return locals.user;
}
