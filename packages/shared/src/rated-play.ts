export const RATING_POLICY_V = 1;
export const RATED_DISCLOSURE_V = 1;
export const PAIR_CAP = 3;
export const PAIR_CAP_WINDOW_MS = 86_400_000;

export function ratingSkipReason({
  rated,
  invalidated,
  endedAt,
  pairProcessedEndedAt,
}: {
  rated: boolean;
  invalidated: boolean;
  endedAt: number;
  pairProcessedEndedAt: readonly number[];
}): "invalidated" | "friendly" | "pairCap" | null {
  if (invalidated) return "invalidated";
  if (!rated) return "friendly";

  const cutoff = endedAt - PAIR_CAP_WINDOW_MS;
  let count = 0;
  for (const earlierEnd of pairProcessedEndedAt) {
    if (earlierEnd > cutoff && earlierEnd <= endedAt) {
      count += 1;
      if (count === PAIR_CAP) return "pairCap";
    }
  }
  return null;
}

export function writesLedgerRow({
  seatKinds,
  playBegan,
  endedBy,
}: {
  seatKinds: Readonly<Record<"A" | "B", "guest" | "account" | undefined>>;
  playBegan: boolean;
  endedBy: "action" | "claim" | null;
}): boolean {
  return (
    playBegan &&
    endedBy !== null &&
    seatKinds.A === "account" &&
    seatKinds.B === "account"
  );
}
