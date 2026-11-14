export function hasAnalyticsSalt(salt: string | undefined): salt is string {
  return typeof salt === "string" && salt.trim().length >= 32;
}

export async function analyticsHash(
  salt: string | undefined,
  domain: string,
  value: string,
): Promise<string> {
  if (!hasAnalyticsSalt(salt)) throw new Error("Invalid analytics salt.");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${domain}:${value}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
