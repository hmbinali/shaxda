import type { CompactReplay } from "@shaxda/game-engine";
import { parseStoredReplay } from "@shaxda/shared";
import { getReplayAdapter } from "./adapters";

export type MatchReplayData =
  | { kind: "ready"; rulesV: number; replayV: number; replay: CompactReplay }
  | { kind: "unavailable" };

type StoredReplay = { rules_v: number; replay_v: number; replay: string };

export async function loadMatchReplay(
  facts: { id: string; startingSeat: CompactReplay["s"]; actionCount: number },
  read: () => Promise<StoredReplay | null>,
): Promise<MatchReplayData> {
  let row: StoredReplay | null = null;

  function unavailable(
    reason: "readFailed" | "unsupportedVersion" | "invalid",
  ) {
    console.warn("replayUnavailable", {
      matchId: facts.id,
      rulesV: row?.rules_v,
      replayV: row?.replay_v,
      reason,
    });
    return { kind: "unavailable" } as const;
  }

  try {
    row = await read();
  } catch {
    return unavailable("readFailed");
  }
  if (row === null) return unavailable("readFailed");

  const { rules_v: rulesV, replay_v: replayV } = row;
  if (!getReplayAdapter(rulesV, replayV))
    return unavailable("unsupportedVersion");

  try {
    const replay = parseStoredReplay(row.replay);
    if (
      replay.v === replayV &&
      replay.s === facts.startingSeat &&
      replay.a.length === facts.actionCount
    ) {
      return { kind: "ready", rulesV, replayV, replay };
    }
  } catch {
    // Keep the details page available when the stored replay is invalid.
  }
  return unavailable("invalid");
}
