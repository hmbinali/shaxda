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
