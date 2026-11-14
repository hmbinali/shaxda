import { matchIdSchema, roomCodeSchema } from "@shaxda/shared";
import { z } from "zod";

export const entryRequestSchema = z.strictObject({
  roomCode: roomCodeSchema,
  matchNumber: z.number().int().positive(),
  matchId: matchIdSchema,
});
export const discardRequestSchema = entryRequestSchema.extend({
  reason: z
    .string()
    .min(1)
    .max(500)
    .refine((reason) => reason.trim().length > 0),
});

const listPageSchema = z.object({
  rooms: z.array(roomCodeSchema),
  nextAfter: roomCodeSchema.nullable(),
});

export interface MatchOpsEnv {
  MATCH_COORDINATOR: DurableObjectNamespace;
  MATCH_ROOM: DurableObjectNamespace;
  MATCH_OPS_TOKEN?: string;
  MATCH_OPS_RATE_LIMIT?: RateLimit;
}

export function opsJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleMatchOps(
  request: Request,
  env: MatchOpsEnv,
  ip: string,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return opsJson({ error: "notFound" }, 404);
  if (request.headers.has("Origin"))
    return opsJson({ error: "originForbidden" }, 403);
  if (!env.MATCH_OPS_RATE_LIMIT) return opsJson({ error: "unavailable" }, 503);
  try {
    if (!(await env.MATCH_OPS_RATE_LIMIT.limit({ key: ip })).success) {
      return opsJson({ error: "rateLimited" }, 429);
    }
  } catch {
    return opsJson({ error: "unavailable" }, 503);
  }

  const encoder = new TextEncoder();
  const expected = encoder.encode(env.MATCH_OPS_TOKEN ?? "");
  if (expected.byteLength < 32) return opsJson({ error: "unavailable" }, 503);
  const candidate = /^Bearer ([^\s]+)$/i.exec(
    request.headers.get("Authorization") ?? "",
  )?.[1];
  if (!candidate) return opsJson({ error: "unauthorized" }, 401);
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", expected),
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
  ]);
  // Workerd extends Web Crypto with a constant-time equality primitive.
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(left: ArrayBuffer, right: ArrayBuffer): boolean;
  };
  if (!subtle.timingSafeEqual(left, right))
    return opsJson({ error: "unauthorized" }, 401);

  const roomStub = (code: string) =>
    env.MATCH_ROOM.get(env.MATCH_ROOM.idFromName(code));
  if (request.method === "GET" && url.pathname === "/ops/unsaved") {
    const room = url.searchParams.get("room");
    const after = url.searchParams.get("after");
    if (room !== null) {
      if (after !== null || !roomCodeSchema.safeParse(room).success)
        return opsJson({ error: "invalidRequest" }, 400);
      return roomStub(room).fetch(
        "https://shaxda.internal/internal/ops/outbox",
      );
    }
    if (after !== null && !roomCodeSchema.safeParse(after).success)
      return opsJson({ error: "invalidRequest" }, 400);
    const coordinator = env.MATCH_COORDINATOR.get(
      env.MATCH_COORDINATOR.idFromName("global"),
    );
    const listing = new URL(
      "https://shaxda.internal/internal/coordinator/unsaved",
    );
    if (after !== null) listing.searchParams.set("after", after);
    const response = await coordinator.fetch(listing);
    if (!response.ok) return opsJson({ error: "unavailable" }, 503);
    const page = listPageSchema.parse(await response.json());
    const rooms = [];
    // Bound concurrent internal requests while keeping the coordinator cursor.
    for (let index = 0; index < page.rooms.length; index += 5) {
      const chunk = await Promise.all(
        page.rooms.slice(index, index + 5).map(async (code) => {
          const result = await roomStub(code).fetch(
            "https://shaxda.internal/internal/ops/outbox",
          );
          if (result.status === 404) return null;
          if (!result.ok) throw new Error("Unable to read held room.");
          return result.json();
        }),
      );
      rooms.push(...chunk.filter((result) => result !== null));
    }
    return opsJson({ rooms, nextAfter: page.nextAfter });
  }

  const command =
    url.pathname === "/ops/retry"
      ? "retry"
      : url.pathname === "/ops/discard"
        ? "discard"
        : null;
  if (request.method !== "POST" || command === null)
    return opsJson({ error: "notFound" }, 404);
  const body = (
    command === "retry" ? entryRequestSchema : discardRequestSchema
  ).safeParse(await request.json().catch(() => null));
  if (!body.success) return opsJson({ error: "invalidRequest" }, 400);
  return roomStub(body.data.roomCode).fetch(
    `https://shaxda.internal/internal/ops/${command}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
    },
  );
}
