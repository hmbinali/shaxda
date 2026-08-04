import { building } from "$app/environment";
import {
  avatarColorForUserId,
  avatarInitial,
  avatarModeSchema,
} from "@shaxda/shared";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => {
  if (building || locals.user === null) return { account: null };

  const username = locals.user.username;
  if (!username) return { account: { status: "incomplete" as const } };

  const avatarMode = avatarModeSchema
    .catch("initial")
    .parse(locals.user.avatarMode);
  return {
    account: {
      status: "complete" as const,
      username,
      avatarMode,
      imageUrl: avatarMode === "google" ? (locals.user.image ?? null) : null,
      avatarColor: avatarColorForUserId(locals.user.id),
      initial: avatarInitial(username),
    },
  };
};
