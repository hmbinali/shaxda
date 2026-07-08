import {
  env,
  reset,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACTIVE_MAX_PER_IP,
  ACTIVE_ROOM_TTL_MS,
  CREATE_MAX_PER_IP,
} from "./room-coordinator";

const testEnv = env as {
  MATCH_COORDINATOR: DurableObjectNamespace;
};

afterEach(async () => {
  await reset();
});

describe("RoomCoordinator", () => {
  it("reserves and releases active rooms", async () => {
    await expect(reserve("ip-a", "ABCDEFGH")).resolves.toEqual({ ok: true });
    await expect(reserve("ip-a", "ABCDEFGH")).resolves.toEqual({
      ok: false,
      code: "roomCodeTaken",
    });

    await expect(release("ABCDEFGH")).resolves.toEqual({ ok: true });
    await expect(reserve("ip-a", "ABCDEFGH")).resolves.toEqual({ ok: true });
  });

  it("limits active rooms per IP", async () => {
    for (let index = 0; index < ACTIVE_MAX_PER_IP; index += 1) {
      await expect(reserve("ip-a", roomCode(index))).resolves.toEqual({
        ok: true,
      });
    }

    await expect(reserve("ip-a", "HJKLMNPQ")).resolves.toEqual({
      ok: false,
      code: "tooManyRooms",
    });
  });

  it("rate-limits room creation attempts after releases", async () => {
    for (let index = 0; index < CREATE_MAX_PER_IP; index += 1) {
      const code = roomCode(index);
      await expect(reserve("ip-a", code)).resolves.toEqual({ ok: true });
      await release(code);
    }

    await expect(reserve("ip-a", "HJKLMNPQ")).resolves.toEqual({
      ok: false,
      code: "rateLimited",
    });
  });

  it("prunes stale active rooms on alarm", async () => {
    await reserve("ip-a", "ABCDEFGH");
    await runInDurableObject(coordinatorStub(), async (_instance, state) => {
      await state.storage.put("coordinator", {
        createAttemptsByIp: {},
        activeRooms: {
          ABCDEFGH: {
            ip: "ip-a",
            createdAt: Date.now() - ACTIVE_ROOM_TTL_MS - 1_000,
          },
        },
      });
      await state.storage.setAlarm(Date.now() + 1_000);
    });

    await expect(runDurableObjectAlarm(coordinatorStub())).resolves.toBe(true);
    await runInDurableObject(coordinatorStub(), async (_instance, state) => {
      await expect(state.storage.get("coordinator")).resolves.toMatchObject({
        activeRooms: {},
      });
    });
  });
});

async function reserve(ip: string, roomCode: string): Promise<unknown> {
  const response = await coordinatorStub().fetch(
    "https://shaxda.test/internal/coordinator/reserve",
    {
      method: "POST",
      body: JSON.stringify({ ip, roomCode }),
      headers: { "Content-Type": "application/json" },
    },
  );

  return response.json();
}

async function release(roomCode: string): Promise<unknown> {
  const response = await coordinatorStub().fetch(
    "https://shaxda.test/internal/coordinator/release",
    {
      method: "POST",
      body: JSON.stringify({ roomCode }),
      headers: { "Content-Type": "application/json" },
    },
  );

  return response.json();
}

function coordinatorStub(): DurableObjectStub {
  return testEnv.MATCH_COORDINATOR.get(
    testEnv.MATCH_COORDINATOR.idFromName("global"),
  );
}

function roomCode(index: number): string {
  return `ABCDEF${String(index).padStart(2, "0")}`;
}
