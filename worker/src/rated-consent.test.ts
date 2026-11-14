import {
  applyD1Migrations,
  env,
  evictDurableObject,
  reset,
  runInDurableObject,
  SELF,
  type D1Migration,
} from "cloudflare:test";
import { deserialize, getActingPlayer } from "@shaxda/game-engine";
import {
  protocolVersion,
  serverMessageSchema,
  type ServerMessage,
} from "@shaxda/shared";
import { mintIdentityTicket } from "@shaxda/shared/identity";
import { RATED_DISCLOSURE_V } from "@shaxda/shared/rated-play";
import { afterEach, describe, expect, it } from "vitest";
import { MatchRoom } from "./match-room";

const bindings = env as {
  DB: D1Database;
  MATCH_COORDINATOR: DurableObjectNamespace;
  MATCH_ROOM: DurableObjectNamespace;
  ONLINE_IDENTITY_SECRET: string;
  TEST_MIGRATIONS: D1Migration[];
};
type Seat = "A" | "B";
type StoredRoom = {
  gameState: Parameters<typeof deserialize>[0];
  turnStartedAt: number;
  lastActivityAt: number;
  consent: Record<Seat, { accept: boolean; disclosureV: number } | null>;
};

afterEach(() => reset());

describe("rated consent", () => {
  it.each([
    { answers: [], expected: false },
    { answers: [false], expected: false },
    { answers: [false, true], expected: true },
    { answers: [true], expected: true },
  ])(
    "freezes $expected when the joiner answers $answers",
    async ({ answers, expected }) => {
      await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
      const room = await openRoom();
      await room.answer("A", true);
      for (const value of answers) await room.answer("B", value);
      await room.placeFirst();
      expect(room.latest("B", "matchStatus")).toMatchObject({
        rated: expected,
      });
      await room.error("B", consent(true), "consentClosed");
      await room.finish("B");
      await expect(
        bindings.DB.prepare(
          "SELECT rated, consent_policy_v, winner_seat FROM match",
        ).first(),
      ).resolves.toEqual({
        rated: Number(expected),
        consent_policy_v: expected ? RATED_DISCLOSURE_V : null,
        winner_seat: "A",
      });
    },
  );

  it("keeps consent through eviction and resyncs a repeat without changing activity or alarms", async () => {
    const room = await openRoom();
    const original = await room.state();
    await room.answer("A", true);
    const accepted = await room.state();
    expect(accepted.room.turnStartedAt).toEqual(original.room.turnStartedAt);
    expect(accepted.alarm).toEqual(original.alarm);
    await evictDurableObject(room.stub);
    await room.answer("A", true);
    expect(await room.state()).toEqual(accepted);
  });

  it("refuses stale, outdated, closed, and ineligible consent without recording it", async () => {
    const room = await openRoom();
    const original = await room.state();
    await room.error("A", { ...consent(true), matchNumber: 2 }, "staleMatch");
    await room.error(
      "A",
      { ...consent(true), disclosureV: 2 },
      "disclosureOutdated",
    );
    expect(await room.state()).toEqual(original);
    await room.finish("A");
    await room.error("A", consent(true), "consentClosed");
    const friendly = await openRoom({ ratedRequest: false });
    await friendly.error("A", consent(true), "consentUnavailable");
    await friendly.finish("A");
    await friendly.error("A", ratedVote(), "consentUnavailable");
    const guest = await openRoom({ guest: true });
    await guest.error("A", consent(true), "consentUnavailable");
  });

  it.each([undefined, "false", "TRUE"])(
    "refuses new consent with switch %s and keeps complete consent",
    async (flag) => {
      const room = await openRoom();
      await room.answer("A", true);
      const original = await room.state();
      await room.error("B", consent(true), "ratedPlayDisabled", { flag });
      expect(await room.state()).toEqual(original);
      await room.answer("B", true);
      await room.placeFirst({ flag });
      expect(room.latest("B", "matchStatus")).toMatchObject({ rated: true });
      await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
      await room.finish("A");
      await room.error("A", ratedVote(), "ratedPlayDisabled", { flag });
      expect(room.latest("A", "rematchStatus")).toMatchObject({
        votes: { A: null, B: null },
      });
    },
  );

  it("writes no match or outbox when an agreed room ends before play", async () => {
    const room = await openRoom();
    await room.answer("A", true);
    await room.answer("B", true);
    await room.finish("A");
    expect((await room.state()).keys).not.toContain("outbox:1");
    expect(room.latest("A", "matchStatus")).toMatchObject({ rated: null });
  });
});

describe("rated rematches", () => {
  it.each([
    [false, false, false],
    [true, false, false],
    [true, true, true],
  ])("freezes fresh votes %s and %s as rated = %s", async (a, b, rated) => {
    const room = await openRoom();
    await room.answer("A", true);
    await room.answer("B", true);
    await room.finish("A");
    await room.send("A", a ? ratedVote() : plainVote);
    expect(room.latest("B", "rematchStatus")).toMatchObject({
      ratedVotes: { A: a, B: null },
    });
    await room.send("B", b ? ratedVote() : plainVote);
    await room.error(
      "A",
      { ...consent(true), matchNumber: 2 },
      "consentClosed",
    );
    await room.placeFirst();
    expect(room.latest("B", "matchStatus")).toMatchObject({ rated });
  });

  it("supports changed flags, idempotent repeats, declines and old stored votes", async () => {
    const room = await openRoom();
    await room.finish("B");
    await room.error(
      "A",
      { ...ratedVote(), disclosureV: undefined },
      "disclosureOutdated",
    );
    await room.send("A", plainVote);
    await room.send("A", ratedVote());
    const accepted = await room.state();
    await room.send("A", ratedVote());
    expect(await room.state()).toEqual(accepted);
    await room.send("B", { type: "rematch", vote: "decline" });
    expect(room.latest("A", "rematchStatus")).toMatchObject({
      ratedVotes: { A: null, B: null },
    });
    await room.send("A", plainVote);
    await runInDurableObject(room.stub, async (_instance, { storage }) => {
      const stored = await storage.get<Record<string, unknown>>("room");
      if (!stored) throw new Error("Missing room");
      delete stored.rematchDisclosure;
      await storage.put("room", stored);
    });
    await room.send("B", ratedVote());
    await room.placeFirst();
    expect(room.latest("B", "matchStatus")).toMatchObject({ rated: false });
  });

  it("uses queue consent and requires rated accepts in a quick room", async () => {
    const room = await openRoom();
    await runInDurableObject(room.stub, async (_instance, { storage }) => {
      const stored = await storage.get("room");
      const accepted = { accept: true, disclosureV: RATED_DISCLOSURE_V };
      await storage.put("room", {
        ...(stored as StoredRoom),
        options: { mode: "quick", ratedRequest: true },
        consent: { A: accepted, B: accepted },
      });
    });
    await room.error("A", consent(true), "consentClosed");
    await room.finish("A");
    await room.error("A", plainVote, "ratedOnlyRematch");
    await room.send("A", ratedVote());
    await room.send("B", ratedVote());
    await room.placeFirst();
    expect(room.latest("B", "matchStatus")).toMatchObject({
      mode: "quick",
      rated: true,
    });
  });
});

function consent(accept: boolean) {
  return {
    type: "rateConsent",
    matchNumber: 1,
    accept,
    disclosureV: RATED_DISCLOSURE_V,
  };
}

const plainVote = { type: "rematch", vote: "accept" };
function ratedVote() {
  return { ...plainVote, rated: true, disclosureV: RATED_DISCLOSURE_V };
}

async function openRoom({ ratedRequest = true, guest = false } = {}) {
  const response = await SELF.fetch("https://shaxda.test/rooms", {
    method: "POST",
    body: JSON.stringify({ options: { ratedRequest } }),
  });
  const created = serverMessageSchema.parse(await response.json());
  if (created.type !== "roomCreated") throw new Error("Room creation failed");
  const { roomCode } = created;
  const stub = bindings.MATCH_ROOM.get(
    bindings.MATCH_ROOM.idFromName(roomCode),
  );
  const messages: Record<Seat, ServerMessage[]> = { A: [], B: [] };
  for (const seat of ["A", "B"] as const) {
    const { webSocket } = await SELF.fetch(
      `https://shaxda.test/rooms/${roomCode}/ws`,
      {
        headers: { Upgrade: "websocket" },
      },
    );
    if (!webSocket) throw new Error("WebSocket upgrade failed");
    webSocket.accept();
    webSocket.addEventListener("message", ({ data }) => {
      messages[seat].push(serverMessageSchema.parse(JSON.parse(String(data))));
    });
    const identityTicket =
      guest && seat === "B"
        ? undefined
        : await mintIdentityTicket(
            {
              iss: "shaxda-web",
              aud: "shaxda-rooms",
              action: "join",
              roomCode,
              userId: `rated-test-account-${seat}`,
              usernameSnapshot: seat === "A" ? "ayaan_7" : "cabdi_8",
              avatarMode: "initial",
              imageUrl: null,
              jti: crypto.randomUUID(),
            },
            bindings.ONLINE_IDENTITY_SECRET,
            Date.now(),
          );
    // The test drives the whole handler to completion so no terminal save is
    // still in flight when the Workers pool resets between cases.
    await runInDurableObject(stub, async (instance, ctx) => {
      const socket = ctx
        .getWebSockets()
        .find((peer) => peer.deserializeAttachment()?.slot === undefined);
      if (!socket) throw new Error("No unjoined socket");
      await (instance as MatchRoom).webSocketMessage(
        socket,
        JSON.stringify({
          v: protocolVersion,
          type: "joinRoom",
          roomCode,
          guestId: `rated-device-${seat}`,
          identityTicket,
        }),
      );
    });
    await expect
      .poll(() => messages[seat].find((message) => message.type === "joined"))
      .toMatchObject({ slot: seat });
  }

  async function state() {
    return runInDurableObject(stub, async (_instance, { storage }) => {
      const room = await storage.get<StoredRoom>("room");
      if (!room) throw new Error("Missing room");
      return {
        room,
        alarm: await storage.getAlarm(),
        keys: [...(await storage.list()).keys()],
      };
    });
  }
  function latest<T extends ServerMessage["type"]>(seat: Seat, type: T) {
    return messages[seat].findLast((message) => message.type === type);
  }
  async function send(seat: Seat, body: object, override?: { flag?: string }) {
    const count = messages[seat].length;
    await runInDurableObject(stub, async (instance, ctx) => {
      const socket = ctx
        .getWebSockets()
        .find((peer) => peer.deserializeAttachment()?.slot === seat);
      if (!socket) throw new Error(`Missing seat ${seat}`);
      const engine = override
        ? new MatchRoom(ctx, { ...bindings, RATED_PLAY_ENABLED: override.flag })
        : (instance as MatchRoom);
      await engine.webSocketMessage(
        socket,
        JSON.stringify({ v: protocolVersion, roomCode, ...body }),
      );
    });
    await expect.poll(() => messages[seat].length).toBeGreaterThan(count);
  }
  return {
    stub,
    state,
    latest,
    send,
    answer: (seat: Seat, accept: boolean) => send(seat, consent(accept)),
    error: async (
      seat: Seat,
      body: object,
      code: string,
      override?: { flag?: string },
    ) => {
      await send(seat, body, override);
      expect(latest(seat, "error")).toMatchObject({ code });
    },
    placeFirst: async (override?: { flag?: string }) => {
      const seat = getActingPlayer(deserialize((await state()).room.gameState));
      await send(
        seat,
        {
          type: "gameAction",
          action: { type: "place", player: seat, point: "O1" },
        },
        override,
      );
    },
    finish: (seat: Seat) =>
      send(seat, {
        type: "gameAction",
        action: { type: "resign", player: seat },
      }),
  };
}
