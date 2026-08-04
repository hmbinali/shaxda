import { redirect } from "@sveltejs/kit";
import { safeInternalPath } from "$lib/server/redirects";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
  const returnTo = safeInternalPath(url.searchParams.get("returnTo"), "/");

  if (locals.user?.username) redirect(303, returnTo);
  if (locals.user !== null) {
    redirect(303, `/register?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return { returnTo };
};
