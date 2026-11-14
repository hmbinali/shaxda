import { readMatchForViewer } from "@shaxda/db";
import { messages } from "@shaxda/i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "./+page.server";

vi.mock("@shaxda/db", () => ({ readMatchForViewer: vi.fn() }));
const readMatch = vi.mocked(readMatchForViewer);
const id = "A".repeat(20);
const profile = {
  username: "ayaan",
  avatarMode: "initial" as const,
  imageUrl: null,
  avatarColor: "#332016",
  initial: "A",
};

function request(matchId: string, viewerId?: string) {
  return {
    params: { id: matchId },
    locals: {
      user: viewerId ? { id: viewerId } : null,
      session: viewerId ? {} : null,
    },
    platform: { env: { DB: {} } },
    setHeaders: vi.fn(),
  } as unknown as Parameters<typeof load>[0];
}

const found = {
  kind: "found",
  viewerSeat: "B",
  match: {
    id,
    rated: false,
    mode: "invite",
    endReason: "resignation",
    onlineEndReason: "idle",
    startedAt: 100,
    endedAt: 300,
    startingSeat: "A",
    firstAdvantageSeat: null,
    firstAdvantageBy: null,
    winnerSeat: "B",
    actionCount: 4,
    players: {
      A: { profile, result: "loss", captured: 1, piecesLeft: 3 },
      B: { profile: null, result: "win", captured: 2, piecesLeft: 4 },
    },
  },
} satisfies Awaited<ReturnType<typeof readMatchForViewer>>;

describe("match server load", () => {
  beforeEach(() => readMatch.mockReset());

  it("rejects a malformed id before calling D1", async () => {
    const event = request("a".repeat(20));
    await expect(load(event)).rejects.toMatchObject({
      status: 404,
      body: { message: "match-not-found" },
    });
    expect(event.setHeaders).toHaveBeenCalledWith({
      "cache-control": "no-store",
    });
    expect(readMatch).not.toHaveBeenCalled();
  });

  it("passes only the verified viewer id to the access check", async () => {
    readMatch.mockResolvedValue({ kind: "missing" });
    const event = request(id, "unrelated");
    await expect(load(event)).rejects.toMatchObject({
      status: 404,
      body: { message: "match-not-found" },
    });
    expect(event.setHeaders).toHaveBeenCalledWith({
      "cache-control": "no-store",
    });
    expect(readMatch).toHaveBeenCalledWith(
      event.platform?.env.DB,
      id,
      "unrelated",
    );
  });

  it("returns generic private metadata and names the losing seat in a claim", async () => {
    readMatch.mockResolvedValue(found);
    const data = await load(request(id, "private-user-id"));
    expect(data).toMatchObject({
      visibility: "participants",
      viewerSeat: "B",
      shareTitle: null,
      meta: { title: "Ciyaar Shaxda ah", noindex: true },
      players: {
        A: {
          isViewer: false,
          participant: { kind: "member", href: "/u/ayaan" },
        },
        B: { isViewer: true, participant: { kind: "neutral" } },
      },
    });
    expect(data?.reason).toContain("@ayaan wuu hakaday");
    expect(data?.reason).not.toBe(
      messages.so.localGame.result.reasons.resignation,
    );
    expect(JSON.stringify(data)).not.toMatch(
      /private-user-id|userId|roomCode|\bseq\b|replay|stats/,
    );
  });

  it("uses the engine reason and current public names on a rated match", async () => {
    readMatch.mockResolvedValue({
      ...found,
      viewerSeat: null,
      match: { ...found.match, rated: true, onlineEndReason: null },
    });
    const data = await load(request(id));
    expect(data).toMatchObject({
      visibility: "public",
      meta: { title: "@ayaan iyo Xubin la tirtiray", noindex: false },
      reason: messages.so.localGame.result.reasons.resignation,
    });
  });
});
