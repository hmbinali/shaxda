import { messages } from "@shaxda/i18n";

export type RatingDecision =
  | { status: "pending" | "processed" | "held" }
  | { status: "skipped"; reason: "friendly" | "pairCap" | "invalidated" };

export function ratedLabel(rated: boolean, decision?: RatingDecision | null) {
  const copy = messages.so.ratedPlay;
  if (!rated) return { mode: copy.mode.friendly, detail: copy.friendlyPrivate };
  const mode = copy.mode.rated;
  switch (decision?.status) {
    case "processed":
      return { mode, detail: null };
    case "held":
      return { mode, detail: copy.status.held };
    case "skipped":
      if (decision.reason === "pairCap")
        return {
          mode,
          status: copy.status.notCounted,
          detail: copy.reason.pairCap,
        };
      if (decision.reason === "invalidated")
        return {
          mode,
          status: copy.status.removed,
          detail: copy.reason.invalidated,
        };
      break;
  }
  return { mode, detail: copy.status.pending };
}
