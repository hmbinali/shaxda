import type { PublicProfile } from "@shaxda/db";
import { siteContent } from "@shaxda/i18n";
import { profilePath } from "$lib/site/metadata";

export type Participant =
  | {
      kind: "member";
      profile: PublicProfile;
      href: ReturnType<typeof profilePath>;
    }
  | { kind: "neutral" };

export function participantFor(profile: PublicProfile | null): Participant {
  return profile === null
    ? { kind: "neutral" }
    : { kind: "member", profile, href: profilePath(profile.username) };
}

export function participantName(participant: Participant): string {
  return participant.kind === "member"
    ? `@${participant.profile.username}`
    : siteContent.so.neutralMember;
}

export function interpolate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (placeholder, key: string) => values[key] ?? placeholder,
  );
}
