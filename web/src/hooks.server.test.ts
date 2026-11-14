import type { Handle, RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  svelteKitHandler: vi.fn(),
  readDeletion: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("$lib/server/auth", () => ({ getAuth: authMocks.getAuth }));
vi.mock("@shaxda/db", () => ({
  readDeletion: authMocks.readDeletion,
  revokeSession: authMocks.revokeSession,
}));
vi.mock("better-auth/svelte-kit", () => ({
  svelteKitHandler: authMocks.svelteKitHandler,
}));

import { handle } from "./hooks.server";

describe("server auth hook", () => {
  beforeEach(() => {
    authMocks.getAuth.mockReset();
    authMocks.svelteKitHandler.mockReset();
    authMocks.readDeletion.mockReset();
    authMocks.revokeSession.mockReset();
    authMocks.readDeletion.mockResolvedValue({
      deletion_due_at: null,
      deleted_at: null,
    });
  });

  it.each([
    "/local",
    "/online",
    "/api/analytics/active",
    "/api/analytics/event",
  ])("resolves %s without accessing auth bindings", async (routeId) => {
    const event = requestEvent(routeId, routeId);
    const response = new Response("game");
    const resolve = vi
      .fn<Parameters<Handle>[0]["resolve"]>()
      .mockResolvedValue(response);

    await expect(handle({ event, resolve })).resolves.toBe(response);

    expect(event.locals).toMatchObject({ session: null, user: null });
    expect(resolve).toHaveBeenCalledWith(event);
    expect(authMocks.getAuth).not.toHaveBeenCalled();
    expect(authMocks.svelteKitHandler).not.toHaveBeenCalled();
  });

  it.each([
    ["/history", "/history"],
    ["/match/[id]", "/match/AAAAAAAAAAAAAAAAAAAA/__data.json"],
  ])(
    "sets no-store even when the %s page loader is skipped",
    async (routeId, path) => {
      const event = requestEvent(routeId, path, {});
      const response = new Response("partial response", {
        headers: { "x-test": "retained" },
      });
      authMocks.getAuth.mockReturnValue({
        api: { getSession: async () => null },
      });
      authMocks.svelteKitHandler.mockResolvedValue(response);
      const result = await handle({ event, resolve: vi.fn() });
      expect(result.headers.get("cache-control")).toBe("no-store");
      expect(result.headers.get("x-test")).toBe("retained");
      expect(await result.text()).toBe("partial response");
    },
  );

  it.each([
    ["/login", "/login"],
    ["/register", "/register"],
    ["/account", "/account"],
    ["/u/[username]", "/u/ayaan_7"],
    ["/api/online/identity", "/api/online/identity"],
    ["/logout", "/logout"],
    [null, "/api/auth/get-session"],
  ])("keeps auth enabled for %s", async (routeId, path) => {
    const env = { AUTH_BASE_URL: "https://shaxda.example" };
    const event = requestEvent(routeId, path, env);
    const session = { id: "session-1" };
    const user = { id: "user-1", username: "ayaan_7" };
    const getSession = vi.fn().mockResolvedValue({ session, user });
    const auth = { api: { getSession } };
    const response = new Response("authenticated");
    const resolve = vi.fn<Parameters<Handle>[0]["resolve"]>();

    authMocks.getAuth.mockReturnValue(auth);
    authMocks.svelteKitHandler.mockResolvedValue(response);

    await expect(handle({ event, resolve })).resolves.toBe(response);

    expect(authMocks.getAuth).toHaveBeenCalledWith(env);
    expect(getSession).toHaveBeenCalledWith({
      headers: event.request.headers,
    });
    expect(event.locals).toMatchObject({ session, user });
    expect(authMocks.svelteKitHandler).toHaveBeenCalledWith({
      event,
      resolve,
      auth,
      building: false,
    });
  });

  it.each([
    ["/api/online/identity", 403],
    ["/api/auth/link-social", 403],
    ["/history/__data.json", 303],
    ["/account", 303],
  ] as const)("restricts pending accounts at %s", async (path, status) => {
    const event = requestEvent(
      path.endsWith("/__data.json") ? "/history" : path,
      path,
      {},
    );
    authMocks.getAuth.mockReturnValue({
      api: {
        getSession: async () => ({
          session: { id: "session-1" },
          user: { id: "user-1" },
        }),
      },
    });
    authMocks.readDeletion.mockResolvedValue({
      deletion_due_at: 100,
      deleted_at: null,
    });
    const response = await handle({ event, resolve: vi.fn() });
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(authMocks.svelteKitHandler).not.toHaveBeenCalled();
  });
});

function requestEvent(
  routeId: string | null,
  path: string,
  env?: object,
): RequestEvent {
  return {
    locals: {},
    platform: env === undefined ? undefined : { env },
    request: new Request(`https://shaxda.example${path}`),
    url: new URL(`https://shaxda.example${path}`),
    setHeaders: vi.fn(),
    route: { id: routeId },
  } as unknown as RequestEvent;
}
