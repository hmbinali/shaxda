import { z } from "zod";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
});

export async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  ip: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  body.set("remoteip", ip);

  const response = await fetchFn(TURNSTILE_VERIFY_URL, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    return false;
  }

  const parsed = turnstileResponseSchema.safeParse(
    await response.json().catch(() => null),
  );

  return parsed.success && parsed.data.success;
}
