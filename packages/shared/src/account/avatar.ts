import { z } from "zod";

// Drawn from the existing board, accent, success, and focus tokens in app.css.
export const AVATAR_PALETTE = [
  "#6e4327",
  "#332016",
  "#991b1b",
  "#047857",
  "#1e40af",
  "#8a5a35",
  "#6b3f5f",
  "#355f5a",
] as const;

export const avatarModeSchema = z.enum(["initial", "google"]);
export type AvatarMode = z.infer<typeof avatarModeSchema>;

export function avatarColorForUserId(userId: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (
    AVATAR_PALETTE[(hash >>> 0) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]
  );
}

export function avatarInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase() || "?";
}
