import { fail, redirect } from "@sveltejs/kit";
import { claimUsername } from "@shaxda/db";
import {
  avatarColorForUserId,
  avatarModeSchema,
  suggestUsernames,
  validateUsername,
} from "@shaxda/shared";
import { safeInternalPath } from "$lib/server/redirects";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
  const returnTo = safeInternalPath(url.searchParams.get("returnTo"), "/");
  if (locals.user?.username) redirect(303, returnTo);

  if (locals.user === null) {
    return { returnTo, registration: null, suggestions: [] };
  }

  return {
    returnTo,
    registration: {
      imageUrl: locals.user.image ?? null,
      avatarColor: avatarColorForUserId(locals.user.id),
    },
    suggestions: suggestUsernames(locals.user.email),
  };
};

export const actions: Actions = {
  confirm: async ({ locals, platform, request }) => {
    if (locals.user === null || locals.session === null) {
      redirect(303, "/login?returnTo=/register");
    }

    const form = await request.formData();
    const rawUsername = String(form.get("username") ?? "");
    const returnTo = safeInternalPath(String(form.get("returnTo") ?? ""), "/");
    const validation = validateUsername(rawUsername);
    const avatarResult = avatarModeSchema.safeParse(form.get("avatarMode"));

    if (!validation.ok) {
      return fail(400, {
        values: {
          username: rawUsername,
          avatarMode: String(form.get("avatarMode") ?? "initial"),
        },
        error: validation.reason === "reserved" ? "reserved" : "invalid",
      });
    }
    if (!avatarResult.success) {
      return fail(400, {
        values: { username: validation.username, avatarMode: "initial" },
        error: "invalid",
      });
    }
    if (platform?.env.DB === undefined)
      throw new Error("D1 binding is unavailable.");

    const outcome = await claimUsername(
      platform.env.DB,
      locals.user.id,
      validation.username,
      avatarResult.data,
    );
    if (outcome.kind === "claimed") redirect(303, returnTo);

    return fail(outcome.kind === "taken" ? 409 : 400, {
      values: { username: validation.username, avatarMode: avatarResult.data },
      error: outcome.kind,
    });
  },
};
