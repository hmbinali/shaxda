import {
  applyD1Migrations,
  env,
  evictDurableObject,
  reset,
  runInDurableObject,
  SELF,
  type D1Migration,
} from "cloudflare:test";
import {
  decodeCompactReplay,
  deserialize,
  getActingPlayer,
  serialize,
  summarizeReplay,
} from "@shaxda/game-engine";
import {
  protocolVersion,
  serverMessageSchema,
  type ServerMessage,
} from "@shaxda/shared";
import { utcDay } from "@shaxda/shared/analytics/events";
import { mintIdentityTicket } from "@shaxda/shared/identity";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { RATED_DISCLOSURE_V } from "@shaxda/shared/rated-play";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchRoom, type MatchRoomEnv } from "./match-room";

const bindings = env as {
  DB: D1Database;
  MATCH_COORDINATOR: DurableObjectNamespace;
  MATCH_ROOM: DurableObjectNamespace;
  ONLINE_IDENTITY_SECRET: string;
  TEST_MIGRATIONS: D1Migration[];
};
type Seat = "A" | "B";
// Prefix of H1's E4 replay through the first pending capture. It reaches a
// legal blocked space-making turn after 39 actions.
const actionCodes = `
P:M7 P:O2 P:I6 P:M5 P:O5 P:M3 P:I3 P:M2 P:M1 P:I2 P:I7 P:O3 P:I1 P:M8 P:O6 P:M4 P:O7 P:O1 P:O8 P:I8 P:O4
P:I4 P:I5 P:M6 X:I3 X:O3 M:I2>I3 M:I1>I2 M:O2>O3 M:I2>I1 M:M2>I2 M:M1>M2 M:M8>M1 M:M2>O2 M:M3>M2 M:O8>M8
M:O1>O8 M:O2>O1 M:M2>O2 M:I2>M2 M:I1>I2 M:I8>I1 M:M8>I8 M:M1>M8 M:M4>M3 M:O4>M4 M:O3>O4 M:O2>O3 M:O1>O2
M:M2>M1 M:O2>O1 M:O3>O2 M:I2>M2 M:I3>I2 M:I2>I3 M:M2>I2 M:O4>O3 M:I2>M2 M:I3>I2 M:O5>O4 M:I2>I3 M:M2>I2
M:M1>M2 M:O6>O5 M:M2>M1 M:O7>O6 M:O8>O7 M:I2>M2 M:M8>O8 M:M2>I2 M:M1>M8 M:I2>M2 M:I1>I2 M:I8>I1 M:M8>M1
M:I1>I8 M:O8>M8 M:O1>O8 M:I2>I1 M:O8>O1 M:I3>I2 M:O1>O8 M:O2>O1 M:M2>O2 M:I2>I3 M:O2>M2 M:I3>I2 M:M2>O2
M:I2>I3 M:O2>M2 M:O1>O2 M:M2>I2 M:M3>M2 M:O8>O1 M:M2>M3 M:O1>O8 M:M1>M2 M:O8>O1 M:M8>O8 M:M7>M8 M:M6>M7
M:O6>M6 M:M2>M1 M:I2>M2 M:I3>I2 M:O5>O6
`
  .trim()
  .split(/\s+/u);
type StoredRoom = {
  gameState: Parameters<typeof deserialize>[0];
  turnStartedAt: number;
  lastActivityAt: number;
  connections: Record<
    Seat,
    { connected: boolean; disconnectedAt: number | null }
  >;
  consent: Record<Seat, { accept: boolean; disclosureV: number } | null>;
};

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("online counters", () => {
  it.each([false, true])(
    "counts the second seat, play and rematches once (mixed seats: %s)",
    async (guest) => {
      await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
      const room = await openRoom({
        ratedRequest: false,
        guest,
        analytics: true,
      });
      const kind = guest ? "guest" : "account";
      const joined = `online_room_joined_${kind}`;
      const started = `online_started_invite_${kind}`;
      const completed = `online_completed_invite_${kind}`;
      await expect.poll(onlineCounts).toEqual({ [joined]: 1 });

      await room.reconnect("B");
      await room.finish("B");
      expect(await onlineCounts()).toEqual({ [joined]: 1 });

      await room.send("A", plainVote);
      await room.send("B", plainVote);
      await room.placeFirst();
      await room.finish("B");
      await expect
        .poll(onlineCounts)
        .toEqual({ [joined]: 1, [started]: 1, [completed]: 1 });

      await room.send("A", plainVote);
      await room.send("B", plainVote);
      await room.placeFirst();
      await room.claim("A", "abandoned");
      await expect
        .poll(onlineCounts)
        .toEqual({ [joined]: 1, [started]: 2, [completed]: 2 });
    },
  );

  it("keeps the match, broadcasts and ledger intact when a counter write fails", async () => {
    await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
    const room = await openRoom({ ratedRequest: false });
    await room.placeFirst();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = new Proxy(bindings.DB, {
      get(target, property) {
        if (property === "prepare") {
          return (sql: string) => {
            if (sql.includes("INSERT INTO event_daily")) throw new TypeError();
            return target.prepare(sql);
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await room.finish("B", { analyticsDB: db });
    for (const seat of ["A", "B"] as const) {
      expect(room.latest(seat, "state")).toMatchObject({
        state: { phase: "gameOver" },
      });
    }
    expect(room.latest("B", "matchStatus")).toMatchObject({
      save: { status: "saved" },
    });
    expect(
      (
        await bindings.DB.prepare(
          'SELECT count(*) AS count FROM "match"',
        ).first()
      )?.count,
    ).toBe(1);
    expect(await onlineCounts()).toEqual({});
    expect(warn).toHaveBeenCalledExactlyOnceWith("analyticsCounterFailed", {
      name: "online_completed_invite_account",
      errorClass: "TypeError",
    });
  });

  it("counts a board win once", async () => {
    await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
    const room = await openRoom({ ratedRequest: false, analytics: true });
    const actions = decodeCompactReplay(
      JSON.parse(sampleMatchPayloads.M1.replay),
    );
    if (!actions.ok) throw new Error("Invalid win fixture");
    const starter = getActingPlayer(
      deserialize((await room.state()).room.gameState),
    );
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    for (const action of actions.actions) {
      now += 400;
      const player = starter === "A" ? action.player : otherSeat(action.player);
      await room.send(player, {
        type: "gameAction",
        action: { ...action, player },
      });
    }
    expect(room.latest("A", "state")).toMatchObject({
      state: { phase: "gameOver", winner: expect.stringMatching(/^[AB]$/) },
    });
    await expect.poll(onlineCounts).toEqual({
      online_room_joined_account: 1,
      online_started_invite_account: 1,
      online_completed_invite_account: 1,
    });
  }, 60_000);
});

async function onlineCounts() {
  const { results } = await bindings.DB.prepare(
    "SELECT event, count FROM event_daily WHERE day = ?",
  )
    .bind(utcDay(Date.now()))
    .all<{ event: string; count: number }>();
  return Object.fromEntries(results.map(({ event, count }) => [event, count]));
}

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

  it.each([false, true])(
    "keeps a successful save when the rating hint throws = %s",
    async (throws) => {
      await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
      const room = await openRoom({ ratedRequest: false });
      await room.placeFirst();
      const processNow = vi.fn(async () => {
        if (throws) throw new Error("Fixture RPC failure");
        return { accepted: true as const };
      });
      await room.finish("B", { RATINGS: { processNow } });
      await expect.poll(() => processNow.mock.calls.length).toBe(1);
      expect(room.latest("A", "matchStatus")).toMatchObject({
        save: { status: "saved" },
      });
      const saved = await bindings.DB.prepare(
        "SELECT COUNT(*) AS n FROM match",
      ).first("n");
      expect(saved).toBe(1);
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

  it("freezes friendly when a stored consent was for a previous disclosure", async () => {
    const room = await openRoom();
    await room.answer("A", true);
    await room.answer("B", true);
    await runInDurableObject(room.stub, async (_instance, { storage }) => {
      const stored = await storage.get<StoredRoom>("room");
      if (!stored) throw new Error("Missing room");
      // Emulate a disclosure version bump while this room is still waiting.
      stored.consent.B = { accept: true, disclosureV: RATED_DISCLOSURE_V - 1 };
      await storage.put("room", stored);
    });
    await room.placeFirst();
    expect(room.latest("B", "matchStatus")).toMatchObject({
      consent: { A: true, B: null },
      rated: false,
    });
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

  it("keeps an incomplete agreement friendly while the switch is off", async () => {
    const room = await openRoom();
    await room.answer("A", true);
    const disabled = { flag: "false" };
    await room.error("B", consent(true), "ratedPlayDisabled", disabled);
    await room.placeFirst(disabled);
    expect(room.latest("B", "matchStatus")).toMatchObject({
      consent: { A: true, B: null },
      rated: false,
    });
  });

  it("writes no match or outbox when an agreed room ends before play", async () => {
    const room = await openRoom();
    await room.answer("A", true);
    await room.answer("B", true);
    await room.finish("A");
    expect((await room.state()).keys).not.toContain("outbox:1");
    expect(room.latest("A", "matchStatus")).toMatchObject({ rated: null });
  });

  it("writes no match or outbox when a pre-play idle claim succeeds", async () => {
    await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
    const room = await openRoom();
    await room.answer("A", true);
    await room.answer("B", true);
    const idle = getActingPlayer(
      deserialize((await room.state()).room.gameState),
    );
    await room.claim(otherSeat(idle), "idle");
    expect((await room.state()).keys).not.toContain("outbox:1");
    await expect(
      bindings.DB.prepare("SELECT count(*) AS n FROM match").first("n"),
    ).resolves.toBe(0);
  });
});

describe.each([false, true])(
  "phase-independent losses, rated = %s",
  (rated) => {
    it.each([
      ["placement", 1],
      ["initialRemoval", 24],
      ["movement", 26],
      ["spaceMaking", 39],
      ["capture", actionCodes.length],
    ] as const)(
      "saves resignees and claim losses in %s",
      async (phase, length) => {
        await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
        const replay = {
          v: 1,
          s: "A",
          a: actionCodes.slice(0, length),
        } as const;
        const prefix = summarizeReplay(replay);
        if (!prefix.ok)
          throw new Error(`Invalid R2 replay prefix: ${prefix.error}`);
        const acting = getActingPlayer(prefix.state);
        const spaceMaking =
          prefix.state.phase === "movement" &&
          acting !== prefix.state.currentPlayer;
        expect(spaceMaking ? "spaceMaking" : prefix.state.phase).toBe(phase);

        for (const ending of [
          "ownTurn",
          "offTurn",
          "idle",
          "abandoned",
        ] as const) {
          const room = await openRoom({ ratedRequest: rated });
          if (rated) {
            await room.answer("A", true);
            await room.answer("B", true);
          }
          await runInDurableObject(
            room.stub,
            async (_instance, { storage }) => {
              const stored = await storage.get<StoredRoom>("room");
              if (!stored) throw new Error("Missing room");
              const now = Date.now();
              await storage.put({
                room: {
                  ...stored,
                  gameState: serialize(prefix.state),
                  playBeganAt: now - 1_000,
                  turnStartedAt: now,
                  rated,
                  consentPolicyV: rated ? RATED_DISCLOSURE_V : null,
                },
                log: { ...replay, matchNumber: 1 },
              });
            },
          );
          const loser = ending === "offTurn" ? otherSeat(acting) : acting;
          if (ending === "idle" || ending === "abandoned")
            await room.claim(otherSeat(loser), ending);
          else await room.finish(loser);
          await expect(
            bindings.DB.prepare(
              "SELECT rated, winner_seat, end_reason, online_end_reason, action_count FROM match WHERE room_code = ?",
            )
              .bind(room.roomCode)
              .first(),
          ).resolves.toEqual({
            rated: Number(rated),
            winner_seat: otherSeat(loser),
            end_reason: "resignation",
            online_end_reason:
              ending === "idle" || ending === "abandoned" ? ending : null,
            action_count: length + 1,
          });
        }
      },
      20_000, // Each phase runs four complete room and ledger-save scenarios.
    );
  },
);

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

function otherSeat(seat: Seat): Seat {
  return seat === "A" ? "B" : "A";
}

const plainVote = { type: "rematch", vote: "accept" };
function ratedVote() {
  return { ...plainVote, rated: true, disclosureV: RATED_DISCLOSURE_V };
}

async function openRoom({
  ratedRequest = true,
  guest = false,
  analytics = false,
} = {}) {
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
  async function join(seat: Seat, action: "join" | "reconnect") {
    const count = messages[seat].length;
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
              action,
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
      await analyticsRoom(instance as MatchRoom, ctx).webSocketMessage(
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
      .poll(() =>
        messages[seat]
          .slice(count)
          .find((message) => message.type === "joined"),
      )
      .toMatchObject({ slot: seat });
  }

  await join("A", "join");
  await join("B", "join");

  function analyticsRoom(instance: MatchRoom, ctx: DurableObjectState) {
    return analytics
      ? new MatchRoom(ctx, {
          ...bindings,
          ANALYTICS_ENABLED: "true",
          RATED_PLAY_ENABLED: "true",
        })
      : instance;
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
    return messages[seat].filter((message) => message.type === type).at(-1);
  }
  async function send(
    seat: Seat,
    body: object,
    override?: {
      flag?: string;
      RATINGS?: MatchRoomEnv["RATINGS"];
      analyticsDB?: D1Database;
    },
  ) {
    const count = messages[seat].length;
    await runInDurableObject(stub, async (instance, ctx) => {
      const socket = ctx
        .getWebSockets()
        .find((peer) => peer.deserializeAttachment()?.slot === seat);
      if (!socket) throw new Error(`Missing seat ${seat}`);
      const engine = override
        ? new MatchRoom(ctx, {
            ...bindings,
            ...(override.analyticsDB
              ? { ANALYTICS_ENABLED: "true", DB: override.analyticsDB }
              : {}),
            RATED_PLAY_ENABLED: override.flag,
            RATINGS: override.RATINGS,
          })
        : analyticsRoom(instance as MatchRoom, ctx);
      await engine.webSocketMessage(
        socket,
        JSON.stringify({ v: protocolVersion, roomCode, ...body }),
      );
    });
    await expect.poll(() => messages[seat].length).toBeGreaterThan(count);
  }
  return {
    roomCode,
    stub,
    state,
    latest,
    send,
    reconnect: (seat: Seat) => join(seat, "reconnect"),
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
    finish: (
      seat: Seat,
      override?: {
        RATINGS?: MatchRoomEnv["RATINGS"];
        analyticsDB?: D1Database;
      },
    ) =>
      send(
        seat,
        {
          type: "gameAction",
          action: { type: "resign", player: seat },
        },
        override,
      ),
    claim: async (seat: Seat, reason: "abandoned" | "idle") => {
      await runInDurableObject(stub, async (instance, ctx) => {
        const { storage } = ctx;
        const room = await storage.get<StoredRoom>("room");
        if (!room) throw new Error("Missing room");
        const loser = otherSeat(seat);
        if (reason === "idle") {
          room.turnStartedAt = Date.now() - 240_000;
        } else {
          const sockets = ctx
            .getWebSockets()
            .filter((peer) => peer.deserializeAttachment()?.slot === loser);
          for (const socket of sockets) socket.serializeAttachment(null);
          room.connections[loser] = {
            connected: false,
            disconnectedAt: Date.now() - 60_000,
          };
        }
        await storage.put("room", room);
        const claimant = ctx
          .getWebSockets()
          .find((peer) => peer.deserializeAttachment()?.slot === seat);
        if (!claimant) throw new Error("Missing claimant");
        await analyticsRoom(instance as MatchRoom, ctx).webSocketMessage(
          claimant,
          JSON.stringify({ v: protocolVersion, type: "claimWin", roomCode }),
        );
      });
      expect(deserialize((await state()).room.gameState).winner).toBe(seat);
    },
  };
}
