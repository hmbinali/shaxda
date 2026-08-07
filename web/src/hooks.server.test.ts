import type { Handle, RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  svelteKitHandler: vi.fn(),
}));

vi.mock("$lib/server/auth", () => ({ getAuth: authMocks.getAuth }));
vi.mock("better-auth/svelte-kit", () => ({
  svelteKitHandler: authMocks.svelteKitHandler,
}));

import { handle } from "./hooks.server";

describe("server auth hook", () => {
  beforeEach(() => {
    authMocks.getAuth.mockReset();
    authMocks.svelteKitHandler.mockReset();
  });

  it.each(["/local", "/online"])(
    "resolves %s without accessing auth bindings",
    async (routeId) => {
      const event = requestEvent(routeId, routeId);
      const response = new Response("game");
      const resolve = vi
        .fn<Parameters<Handle>[0]["resolve"]>()
        .mockResolvedValue(response);

      await expect(handle({ event, resolve })).resolves.toBe(response);

      expect(event.locals).toEqual({ session: null, user: null });
      expect(resolve).toHaveBeenCalledWith(event);
      expect(authMocks.getAuth).not.toHaveBeenCalled();
      expect(authMocks.svelteKitHandler).not.toHaveBeenCalled();
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
    expect(event.locals).toEqual({ session, user });
    expect(authMocks.svelteKitHandler).toHaveBeenCalledWith({
      event,
      resolve,
      auth,
      building: false,
    });
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
    route: { id: routeId },
  } as unknown as RequestEvent;
}
