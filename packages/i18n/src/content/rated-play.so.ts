// TODO(translation-review): Review the rated-play copy before enabling public rated play.
export const ratedPlaySo = {
  mode: {
    rated: "Tartan",
    friendly: "Saaxiibtinimo",
  },
  create: { legend: "Nooca ciyaarta" },
  disclosure: {
    rated:
      "Tartan: natiijada, dib u daawada, iyo magacyadiinna dadweynaha qof walba wuu arki karaa, Darajaduna way isbeddeli kartaa.",
    friendly:
      "Saaxiibtinimo: labadiinna oo keliya ayaa arki kara ciyaarta, Darajona laguma xisaabiyo.",
    learnMore: "Sida Tartanku u shaqeeyo",
  },
  consent: {
    request: "Ciyaaryahanka kale wuxuu codsaday Tartan.",
    accept: "Aqbal Tartan",
    decline: "Ku ciyaar Saaxiibtinimo",
  },
  lobby: {
    pending: "Tartan · waxaa la sugayaa oggolaanshaha",
    agreed: "Tartan · labadiinnaba waad oggolaateen",
    declined: "Saaxiibtinimo · Tartan lama wada oggolaan",
    startedUnagreed:
      "Saaxiibtinimo · ciyaartu waxay bilaabatay ka hor oggolaanshaha",
    needsAccounts:
      "Tartan wuxuu u baahan yahay laba akoon; ciyaartan lama kaydinayo.",
    quick: "Kulan degdeg ah · Tartan",
  },
  firstMove: {
    body: "Oggolaanshaha Tartanka weli lama dhammaystirin. Haddii aad hadda ciyaarto, ciyaartani waxay noqonaysaa Saaxiibtinimo.",
    wait: "Sug",
  },
  rematch: {
    rated: "Dib u ciyaar Tartan",
    friendly: "Dib u ciyaar Saaxiibtinimo",
    ratedPaused: "Dib-u-ciyaarka Tartanka ah hadda waa hakad.",
    opponentOfferedRated:
      "Ciyaaryahanka kale wuxuu codsaday dib-u-ciyaar Tartan ah.",
    startedFriendly:
      "Dib-u-ciyaarkani waa Saaxiibtinimo: labadiinnaba Tartan ma wada dooran.",
  },
  status: {
    pending: "Waa la xisaabinayaa",
    held: "Waa la hubinayaa",
    notCounted: "Darajo laguma xisaabin",
    removed: "Darajada waa laga saaray",
  },
  reason: {
    pairCap:
      "Waxaad horey isu ciyaarteen 3 Tartan oo la xisaabiyay 24-kii saac ee ka horreeyay ciyaartan.",
    invalidated: "Darajada ciyaartan waa laga saaray kadib hubin.",
  },
  friendlyPrivate: "Labadiinna oo keliya ayaa arki kara.",
  result: {
    notSaved:
      "Ciyaartu waxay dhammaatay ka hor tallaabada koowaad: lama kaydin, Darajona ma isbeddelin.",
  },
} as const;
