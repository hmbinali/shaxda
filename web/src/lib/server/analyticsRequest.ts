import { canonicalAuthOrigin } from "./auth/options";
import { rateLimitStatus } from "./rateLimit";

const MAX_BODY_BYTES = 1024;
const noStore = { "cache-control": "no-store" };

export function analyticsResponse(status: number, data?: object): Response {
  return data === undefined
    ? new Response(null, { status, headers: noStore })
    : Response.json(data, { status, headers: noStore });
}

export async function acceptAnalyticsRequest<T>(
  request: Request,
  env: App.Platform["env"] | undefined,
  schema: {
    safeParse(input: unknown): { success: true; data: T } | { success: false };
  },
): Promise<Response | { env: App.Platform["env"]; data: T }> {
  if (env === undefined) return analyticsResponse(503);
  if (env.ANALYTICS_ENABLED !== "true") return analyticsResponse(204);

  try {
    if (
      request.headers.get("origin") !== canonicalAuthOrigin(env.AUTH_BASE_URL)
    ) {
      return analyticsResponse(403);
    }
  } catch {
    return analyticsResponse(503);
  }

  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") return analyticsResponse(415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return analyticsResponse(413);
  }

  const reader = request.body?.getReader();
  if (!reader) return analyticsResponse(400);

  let size = 0;
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let data: T;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (size + part.value.byteLength > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return analyticsResponse(413);
      }
      bytes.set(part.value, size);
      size += part.value.byteLength;
    }
    const parsed = schema.safeParse(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          bytes.subarray(0, size),
        ),
      ),
    );
    if (!parsed.success) return analyticsResponse(400);
    data = parsed.data;
  } catch {
    return analyticsResponse(400);
  } finally {
    reader.releaseLock();
  }

  const status = await rateLimitStatus(request, env.ANALYTICS_RATE_LIMIT);
  return status === undefined ? { env, data } : analyticsResponse(status);
}
