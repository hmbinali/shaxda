import { dev } from "$app/environment";

export interface RateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export async function rateLimitStatus(
  request: Request,
  binding: RateLimitBinding | undefined,
): Promise<429 | 503 | undefined> {
  if (binding === undefined) return dev ? undefined : 503;

  try {
    const key = request.headers.get("cf-connecting-ip") || "unknown";
    return (await binding.limit({ key })).success ? undefined : 429;
  } catch {
    return 503;
  }
}
