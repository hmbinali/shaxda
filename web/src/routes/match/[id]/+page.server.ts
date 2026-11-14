import { readMatchForViewer } from "@shaxda/db";
import { messages, siteContent } from "@shaxda/i18n";
import { matchIdSchema } from "@shaxda/shared";
import { error } from "@sveltejs/kit";
import {
  interpolate,
  participantFor,
  participantName,
} from "$lib/history/presentation";
import type { PageServerLoad } from "./$types";

export const prerender = false;
const copy = siteContent.so.pages.match;

export const load: PageServerLoad = async ({
  locals,
  params,
  platform,
  setHeaders,
}) => {
  setHeaders({ "cache-control": "no-store" });
  const id = matchIdSchema.safeParse(params.id);
  if (!id.success) error(404, "match-not-found");

  const db = platform?.env.DB;
  if (!db) throw new Error("D1 binding is unavailable.");
  const outcome = await readMatchForViewer(
    db,
    id.data,
    locals.session ? (locals.user?.id ?? null) : null,
  );
  if (outcome.kind === "missing") error(404, "match-not-found");

  const { match, viewerSeat } = outcome;
  const participantA = participantFor(match.players.A.profile);
  const participantB = participantFor(match.players.B.profile);
  const a = participantName(participantA);
  const b = participantName(participantB);
  const loser = match.winnerSeat === "A" ? b : a;
  const winner = match.winnerSeat === "A" ? a : b;
  const names = { a, b, winner, loser };
  const result = match.winnerSeat === null ? "draw" : "win";
  const reason = match.onlineEndReason
    ? interpolate(copy.onlineEndReasons[match.onlineEndReason], { name: loser })
    : messages.so.localGame.result.reasons[match.endReason];
  const { players, ...details } = match;

  return {
    match: details,
    viewerSeat,
    players: {
      A: {
        participant: participantA,
        result: players.A.result,
        piecesLeft: players.A.piecesLeft,
        captured: players.A.captured,
        isViewer: viewerSeat === "A",
      },
      B: {
        participant: participantB,
        result: players.B.result,
        piecesLeft: players.B.piecesLeft,
        captured: players.B.captured,
        isViewer: viewerSeat === "B",
      },
    },
    visibility: match.rated ? ("public" as const) : ("participants" as const),
    meta: match.rated
      ? {
          title: interpolate(copy.pageTitle, names),
          description: interpolate(copy.pageDescription[result], names),
          noindex: false,
        }
      : { title: copy.title, description: copy.description, noindex: true },
    shareTitle: match.rated ? interpolate(copy.share.shareTitle, names) : null,
    headline: interpolate(copy.headline[result], names),
    reason,
    // The rating table is introduced by R1.
    ratingNote: null,
  };
};
