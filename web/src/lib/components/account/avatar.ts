const GOOGLE_AVATAR_HOST = /^lh[3-6]\.googleusercontent\.com$/;

export function allowedGoogleAvatarUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && GOOGLE_AVATAR_HOST.test(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
