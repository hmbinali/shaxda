const ENCODED_BACKSLASH = /%5c/i;

function hasControlOrWhitespace(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || /\s/u.test(character)) return true;
  }
  return false;
}

export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value || value.length > 512) return fallback;
  if (hasControlOrWhitespace(value) || value.includes("\\")) return fallback;
  if (ENCODED_BACKSLASH.test(value)) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (
    hasControlOrWhitespace(decoded) ||
    decoded.includes("\\") ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    !decoded.startsWith("/") ||
    decoded.startsWith("//")
  ) {
    return fallback;
  }

  const placeholder = "https://placeholder.invalid";
  try {
    const url = new URL(value, placeholder);
    return url.origin === placeholder ? value : fallback;
  } catch {
    return fallback;
  }
}
