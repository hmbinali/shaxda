import { fail, redirect } from "@sveltejs/kit";
import { changeUsername, setAvatarMode } from "@shaxda/db";
import {
  avatarColorForUserId,
  avatarInitial,
  avatarModeSchema,
  nextUsernameChangeAt,
  validateUsername,
} from "@shaxda/shared";
import type { Actions, PageServerLoad } from "./$types";

const dateFormatter = new Intl.DateTimeFormat("so-SO", { dateStyle: "long" });

export const load: PageServerLoad = async ({ locals, platform }) => {
  const user = requireCompleteAccount(locals);
  if (platform?.env.DB === undefined)
    throw new Error("D1 binding is unavailable.");

  const stored = await platform.env.DB.prepare(
    "SELECT username_changed_at FROM user WHERE id = ?1 LIMIT 1",
  )
    .bind(user.id)
    .first<{ username_changed_at: number | null }>();
  if (stored === null) redirect(303, "/login?returnTo=/account");

  const avatarMode = avatarModeSchema.catch("initial").parse(user.avatarMode);
  return {
    settings: {
      username: user.username,
      email: user.email,
      joinedAt: dateFormatter.format(user.createdAt),
      nextChangeAt:
        stored.username_changed_at === null
          ? null
          : dateFormatter.format(
              nextUsernameChangeAt(new Date(stored.username_changed_at)),
            ),
      avatarMode,
      imageUrl: user.image ?? null,
      avatarColor: avatarColorForUserId(user.id),
      initial: avatarInitial(user.username),
    },
  };
};

export const actions: Actions = {
  username: async ({ locals, platform, request }) => {
    const user = requireCompleteAccount(locals);
    if (platform?.env.DB === undefined)
      throw new Error("D1 binding is unavailable.");
    const form = await request.formData();
    const rawUsername = String(form.get("username") ?? "");
    const validation = validateUsername(rawUsername);
    if (!validation.ok) {
      return fail(400, {
        source: "username",
        value: rawUsername,
        error: validation.reason === "reserved" ? "reserved" : "invalid",
      });
    }

    const outcome = await changeUsername(
      platform.env.DB,
      user.id,
      validation.username,
    );
    if (outcome.kind === "changed") {
      return { source: "username", saved: true, value: validation.username };
    }
    if (outcome.kind === "cooldown") {
      return fail(409, {
        source: "username",
        value: validation.username,
        error: "cooldown",
        eligibleDate: dateFormatter.format(outcome.nextEligibleAt),
      });
    }
    return fail(outcome.kind === "taken" ? 409 : 400, {
      source: "username",
      value: validation.username,
      error: outcome.kind,
    });
  },
  avatarMode: async ({ locals, platform, request }) => {
    const user = requireCompleteAccount(locals);
    if (platform?.env.DB === undefined)
      throw new Error("D1 binding is unavailable.");
    const form = await request.formData();
    const parsed = avatarModeSchema.safeParse(form.get("avatarMode"));
    if (!parsed.success) {
      return fail(400, { source: "avatarMode", error: "invalid" });
    }
    const outcome = await setAvatarMode(platform.env.DB, user.id, parsed.data);
    if (outcome.kind === "missing") {
      return fail(404, { source: "avatarMode", error: "missing" });
    }
    return { source: "avatarMode", saved: true };
  },
};

function requireCompleteAccount(locals: App.Locals): NonNullable<
  App.Locals["user"]
> & {
  username: string;
} {
  if (locals.user === null || locals.session === null) {
    redirect(303, "/login?returnTo=/account");
  }
  if (!locals.user.username) redirect(303, "/register?returnTo=/account");
  return locals.user as NonNullable<App.Locals["user"]> & { username: string };
}
