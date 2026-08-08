export const fallbackSiteOrigin = "https://shaxda.example";
export const ogImagePath = "/og-image.png";

export function siteOrigin(): string {
  const configuredOrigin = import.meta.env.PUBLIC_SITE_ORIGIN?.trim();
  const origin =
    configuredOrigin && configuredOrigin.length > 0
      ? configuredOrigin
      : fallbackSiteOrigin;

  return origin.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${siteOrigin()}${normalizedPath}`;
}

/**
 * Canonical path of a public profile. Callers must pass the account's current
 * username: an old alias only ever redirects, so it must never be shared or
 * used as a canonical URL.
 */
export function profilePath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export function profileUrl(username: string): string {
  return absoluteUrl(profilePath(username));
}
