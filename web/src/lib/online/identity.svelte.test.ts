import { describe, expect, it, vi } from "vitest";
import { createOnlineIdentity } from "./identity.svelte";

const TICKET = `${"a".repeat(24)}.${"b".repeat(43)}`;

describe("OnlineIdentity", () => {
  it.each(["signedOut", "incomplete"] as const)(
    "maps the %s status",
    async (status) => {
      const identity = createOnlineIdentity({
        fetchFn: vi.fn(async () => Response.json({ status })) as never,
      });
      await identity.refresh();
      expect(identity.status).toBe(status);
      expect(identity.account).toBeNull();
    },
  );

  it("maps a complete public account", async () => {
    const identity = createOnlineIdentity({
      fetchFn: vi.fn(async () =>
        Response.json({
          status: "complete",
          account: {
            username: "ayaan_7",
            avatar: {
              mode: "initial",
              imageUrl: null,
              color: "#332016",
              initial: "A",
            },
          },
        }),
      ) as never,
    });
    await identity.refresh();
    expect(identity.status).toBe("complete");
    expect(identity.account?.username).toBe("ayaan_7");
  });

  it("mints a fresh ticket for every connect", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST"
          ? Response.json({ ticket: TICKET, expiresAt: 2_000 })
          : Response.json({
              status: "complete",
              account: {
                username: "ayaan_7",
                avatar: {
                  mode: "initial",
                  imageUrl: null,
                  color: "#332016",
                  initial: "A",
                },
              },
            }),
    );
    const fetchFn = fetchMock as unknown as typeof fetch;
    const identity = createOnlineIdentity({ fetchFn, now: () => 1_000 });
    await identity.refresh();
    await expect(identity.requestTicket("join", "ABCDEFGH")).resolves.toBe(
      TICKET,
    );
    await expect(identity.requestTicket("reconnect", "ABCDEFGH")).resolves.toBe(
      TICKET,
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ action: "join", roomCode: "ABCDEFGH" }),
    );
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({ action: "reconnect", roomCode: "ABCDEFGH" }),
    );
  });

  it("becomes unavailable when status or minting fails", async () => {
    const identity = createOnlineIdentity({
      fetchFn: vi.fn(async () => new Response(null, { status: 503 })) as never,
    });
    await identity.refresh();
    expect(identity.status).toBe("unavailable");

    identity.status = "complete";
    await expect(identity.requestTicket("create")).rejects.toThrow();
    expect(identity.status).toBe("unavailable");
  });
});
