import {
  avatarColorForUserId,
  avatarInitial,
  avatarModeSchema,
  type AvatarMode,
} from "@shaxda/shared";

export type PublicProfile = {
  username: string;
  avatarMode: AvatarMode;
  imageUrl: string | null;
  avatarColor: string;
  initial: string;
};

export function toPublicProfile(
  id: string,
  username: string,
  mode: string | null,
  image: string | null,
): PublicProfile {
  const avatarMode = avatarModeSchema.catch("initial").parse(mode);
  return {
    username,
    avatarMode,
    imageUrl: avatarMode === "google" ? image : null,
    avatarColor: avatarColorForUserId(id),
    initial: avatarInitial(username),
  };
}
