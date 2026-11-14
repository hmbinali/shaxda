import { redirect } from "@sveltejs/kit";

export function requireCompleteAccount(
  { user, session }: App.Locals,
  returnPath: "/account" | "/history",
): NonNullable<App.Locals["user"]> & { username: string } {
  if (user === null || session === null) {
    redirect(303, `/login?returnTo=${returnPath}`);
  }
  if (!user.username) redirect(303, `/register?returnTo=${returnPath}`);
  return { ...user, username: user.username };
}
