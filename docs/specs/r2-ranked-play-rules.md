# R2 — Rated Play Rules (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Wave       | 2; activates together with R1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Depends on | H1, R1 (activated together)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Register   | F1, F2, F4, P1, P2, P3, P7, P10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Contracts  | Owns the behaviour behind [§6.3](v2-contracts.md#63-client-to-server) (`rateConsent`, rated rematch votes), `RATED_DISCLOSURE_V`, steps 1, 3, and 4 of [§4.2](v2-contracts.md#42-rating-decision) as `rating_policy_v = 1` (R1 owns step 2's validation), and `RATED_PLAY_ENABLED` ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)). Consumes [§1](v2-contracts.md#1-vocabulary), [§2.5](v2-contracts.md#25-r1-extension), [§3](v2-contracts.md#3-room-lifecycle), [§4.1](v2-contracts.md#41-which-endings-write-a-row), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§6.2](v2-contracts.md#62-server-to-client), [§6.4](v2-contracts.md#64-quick-match-queue), [§6.5](v2-contracts.md#65-deploy-order), [§7](v2-contracts.md#7-rating-processor) |
| Brief      | `docs/shaxda-v2.md` §10 (R2); the default asked in §16 D2 and §17 is settled by F1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Touches    | `packages/shared` (`rated-play` module, protocol schemas), `worker/` (MatchRoom consent and rematch handling, Wrangler vars), `web/` (`/online` create, lobby, rematch, result; labels on `/history` and `/match/<id>`), `packages/i18n` (`ratedPlay` copy, `/learn#tartan`, `/legal`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

R2 decides how two account players agree to rated play and which saved games
change ratings: the consent handshake on the game Worker, the disclosure, the
pure policy for friendly, invalidated, and pair-capped games, and the Somali
labels and explanation. H1 owns the ledger, the room lifecycle, consent
storage, and freezing `rated`; R1 owns Glicko-2, the processor, and rebuilds;
R6 owns invalidation; K1 owns queue entry; H2 and R4 own page access.

## 1. Outcome and non-goals

**Outcome.** Before the first move, both players of an invite room know
whether the game is rated and that rated games are public. An invite game is
friendly unless both accept. Every saved game gets one explainable rating
decision, and one pair of accounts earns at most three counted games in any
24 hours.

| Must                                                                                                                                                                                   | See     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1. Friendly unless both accept (F1): Saaxiibtinimo is preselected; a complete account may request Tartan.                                                                              | §4.1    |
| 2. The disclosure before play on the create screen, the consent prompt, and the rematch buttons; K1 reuses it at queue entry (F2).                                                     | §3.2    |
| 3. The consent handshake on the game Worker (P3): the creating client consents automatically; a decline or an old cached client means friendly.                                        | §3.3    |
| 4. The server never blocks play for consent: the first non-terminal action freezes `rated` (P1); the starting player's client warns first while consent is pending.                    | §4.2    |
| 5. Consent never carries across matches: a rematch is rated only with two rated accept votes; quick rooms accept only rated rematches.                                                 | §4.3    |
| 6. The `RATED_PLAY_ENABLED` kill switch: the server refuses consent with `ratedPlayDisabled`, so games stay friendly.                                                                  | §3.5    |
| 7. Policy v1 for v2-contracts §4.2 steps 1, 3, and 4, used by R1's processor and rebuild, beside the v2-contracts §4.1 predicate shared by room and processor.                         | §3.4    |
| 8. Somali labels for rated/friendly and rating status in the lobby, result, `/history`, and `/match/<id>`; cap-skipped and invalidated rated matches stay public and say why (P2, P8). | §4.5    |
| 9. `/learn#tartan`, linked from lobby and result: no fixed rating gain; games against new or high-RD accounts move an established rating less.                                         | §7      |
| 10. The `/legal` paragraph on public rated games, in the enabling commit.                                                                                                              | §7, §10 |

**Should:** announce consent changes and the frozen label through the
existing `GameAnnouncer` for screen readers.

**Not in R2:** Glicko-2, the processor, rebuilds, rating numbers (R1), and
estimates (P18); invalidation (R6); queue entry (K1); page access (H2, R4); a
per-account daily cap (P7); a cross-room active-rated registry (P10); seasons,
tiers, guest or local ratings (F8); changing a room's request; game rules.

## 2. Decisions and dependencies

| ID   | How R2 applies it                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1   | Invite rooms start friendly; rated needs both seats' consent; quick rooms are rated (consent from `joinQueue`, rated-only rematches).                                      |
| F2   | The disclosure is shown before play wherever a player commits to rated play; labels say public or private.                                                                 |
| F4   | Once play began, resign or a valid claim is a loss in every phase (§9); a pre-play ending writes nothing.                                                                  |
| P1   | The consent window closes at the first accepted non-terminal action, which freezes `rated`.                                                                                |
| P2   | Labels derive from `rated`; cap-skipped and invalidated rated matches stay public, marked "Darajo laguma xisaabin".                                                        |
| P3   | The handshake in §3.3 and §4.1–§4.3.                                                                                                                                       |
| P7   | `PAIR_CAP = 3` in a 24 h `ended_at` window, evaluated in `seq` order; no per-account daily cap.                                                                            |
| P10  | An account may hold several rated rooms at once; the pair cap, Glicko dampening, and R6 cover abuse.                                                                       |
| Also | F8 (a guest seat never saves or rates), P8 (public numbers are processed events), P4 and P6 (`seq` order, `staleMatch`), P18 (pending until R1 confirms), Q1 and Q4 (§10). |

| Dependency  | Provides                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1          | `ratedRequest` storage, per-match `consent`, `rated` frozen at play began, the `matchStatus` fields, the outbox and ledger rows, `staleMatch`, own off-turn resign, random then alternating starting seat. |
| R1          | Step 1 validation, `seq`-order processing that calls R2's policy, `match_rating` rows, rebuilds, and the rating-status read the result overlay polls.                                                      |
| H2 (wave 1) | `/history` and `/match/<id>` with their access checks, where R2's labels render; the `/legal` saved-games paragraph.                                                                                       |
| R6-core     | Invalidation and rescission records read at step 3.                                                                                                                                                        |
| Consumers   | K1 (disclosure and version at queue entry), R4 (label mapping), R6 (`writesLedgerRow` in consistency checks).                                                                                              |

## 3. Contracts

### 3.1 Linked, not restated

Vocabulary, lifecycle, the §4.1 row table, the §4.2 decision order, M1–M10,
access, message shapes, error codes, queue consent, deploy order, and the
processor stay in [v2-contracts](v2-contracts.md). Rating decisions are
`match_rating` rows; a ledger row without one is pending
([§2.5](v2-contracts.md#25-r1-extension)). R2 owns the following.

### 3.2 Rated disclosure

- `RATED_DISCLOSURE_V = 1` (`@shaxda/shared/rated-play`) identifies the
  exact disclosure a player accepted; H1 stores it as `consent_policy_v`.
  The `ratedPlay.disclosure.*` strings (§7) are its only source, rendered by
  one `RatedDisclosure.svelte` on every surface in Must 2.
- Any change to those strings bumps the version in the same commit; a test
  pins their SHA-256 next to the version. The game Worker deploys first and
  then answers old clients `disclosureOutdated`.

### 3.3 Consent handling on the game Worker

Checks run in this order; a refused frame records nothing.

| #   | Check                                                                        | `rateConsent`                                                                         | Rated rematch vote (`rated: true`)         |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Existing: schema, room, joined; P6 `matchNumber` (required on `rateConsent`) | `invalidMessage`, `roomMismatch`, `notJoined`, `staleMatch`                           | same, plus `rematchUnavailable`            |
| 2   | Room requests rated and both seats are account seats                         | else `consentUnavailable`                                                             | else `consentUnavailable`                  |
| 3   | Consent open: invite room, match 1, play not begun                           | else `consentClosed`                                                                  | —                                          |
| 4   | `RATED_PLAY_ENABLED` is `"true"`                                             | else `ratedPlayDisabled`                                                              | else `ratedPlayDisabled`                   |
| 5   | `disclosureV` equals `RATED_DISCLOSURE_V`                                    | else `disclosureOutdated`                                                             | missing or different: `disclosureOutdated` |
| 6   | Record                                                                       | the last answer before play began counts; an identical answer only resyncs the sender | vote stored with its flag                  |

A quick room's consent comes from `joinQueue` and a rematch's from its votes,
so `rateConsent` there answers `consentClosed`. An accept vote without
`rated: true` in a quick room answers `ratedOnlyRematch`. Consent and votes
count as room activity, never as turn activity.

### 3.4 Rating policy v1

`@shaxda/shared/rated-play` is pure (no I/O, clock, or Zod) and exports
`RATING_POLICY_V = 1`, `PAIR_CAP = 3`, `PAIR_CAP_WINDOW_MS = 86_400_000`,
and the following two functions.

- `ratingSkipReason({ rated, invalidated, endedAt, pairProcessedEndedAt })`
  returns `"invalidated"`, `"friendly"`, `"pairCap"`, or `null` (processed),
  in that order: v2-contracts §4.2 steps 1, 3, and 4. R1 checks an
  invalidation before validating, so an operator's invalidation also
  resolves a row that would be `held`. `invalidated`
  means an R6 invalidation exists; `pairProcessedEndedAt` holds the
  `ended_at` of the pair's earlier-`seq` matches with a processed
  `match_rating` row (a superset bounded below by
  `endedAt − PAIR_CAP_WINDOW_MS` is fine: the function applies the window).
- `writesLedgerRow({ bothSeatsAccounts, playBegan, reachedGameOver })` is
  v2-contracts §4.1. The Match DO calls it at game over; R1's step 1 and R6's
  consistency check call it with facts replayed from a row, so a row with no
  non-terminal action is `held`. H1 creates this module with
  `writesLedgerRow` and its tests in wave 1; R2 adds the policy beside it.
- R1's processor and rebuild record `RATING_POLICY_V` on every
  `match_rating` row. Changing any rule or constant means
  `RATING_POLICY_V + 1` and R1's full rebuild
  ([§7.4](v2-contracts.md#74-corrections)), never an in-place change; a
  golden decision fixture per version fails when behaviour moves silently.

### 3.5 Kill switch

- Game Worker var `RATED_PLAY_ENABLED`: `"true"` enables; any other value,
  a missing var included, disables. Disabled, `rateConsent` and rated votes
  get `ratedPlayDisabled` (check 4). Recorded answers are not rewritten, so only
  matches whose consent was complete at the flip can still start rated.
  Stored matches keep `rated` and visibility (P2); R1's `maintenance` flag
  is a separate stop.
- Quick rooms are rated by construction (the ledger's quick-implies-rated
  `CHECK`), so K1 must refuse queue entry while the switch is off (K1 owns it).

## 4. Behaviour and failure handling

### 4.1 Before play

Complete accounts see a "Nooca ciyaarta" choice on the `/online` create form,
Saaxiibtinimo preselected, the disclosure beside Tartan; Tartan sends
`options.ratedRequest: true`. Others see today's form. The waiting screen
repeats the chosen mode.

| Situation before play began                 | Lobby label (both seats)                                                    | `rated` if play begins now |
| ------------------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| No rated request, two account seats         | Saaxiibtinimo                                                               | false                      |
| A guest seat                                | none (V1 guest play); with a rated request, "needs two accounts; not saved" | no row (F8)                |
| Rated request, an answer `null`, no decline | Tartan · waiting for agreement                                              | false (warning first)      |
| A seat declined                             | Saaxiibtinimo · not agreed                                                  | false                      |
| Both accepted the current version           | Tartan · both agreed                                                        | true                       |
| Client got `ratedPlayDisabled`              | Saaxiibtinimo · rated play paused                                           | false                      |
| Quick room (consent from `joinQueue`)       | Kulan degdeg ah · Tartan                                                    | true                       |

Once both seats are accounts, the joiner sees the prompt (disclosure, "Aqbal
Tartan", "Ku ciyaar Saaxiibtinimo"), and the page that showed the disclosure
on the create screen sends `rateConsent { accept: true }` for its seat if its
answer is `null`; a reloaded page or another device shows the prompt. Old
cached clients never answer: friendly.

### 4.2 Play began

- H1 freezes `rated` at the first accepted non-terminal action: true only
  when both answers are `true` with the current `RATED_DISCLOSURE_V`. The
  server accepts that action whatever the consent state; while consent is
  pending, the starting player's client first asks: "Sug" keeps waiting,
  "Ku ciyaar Saaxiibtinimo" sends the action.
- Consent does not pause the idle nudge (60 s) or idle claim (3 min); a
  claim before play began writes nothing (P1, M7). After play began, resign
  and valid claims are losses in every phase, blocked space-making and a
  pending capture included (F4); the engine and H1 produce the row.

### 4.3 Rematches

A rated-request invite room with two account seats offers "Dib u ciyaar
Tartan" (with the disclosure) and "Dib u ciyaar Saaxiibtinimo"; a friendly
room keeps the V1 button; a quick room offers only the rated one.
`rematchStatus.ratedVotes` shows each accept vote's flag. When both accept
(V1 rule), each flag is that seat's consent for the new match: rated only
when both are rated, else friendly (M9). A retried identical vote changes
nothing, a changed flag replaces the vote, a decline clears the other vote
(V1), and an old client's plain accept is a friendly vote.

### 4.4 Rating decision

R1 takes rows in `seq` order: an invalidation → invalidated (step 1); a row
that fails validation → held (step 2); then `ratingSkipReason`: `rated = 0` →
friendly; the cap → pairCap; else processed. The pair is the two account ids, unordered; seats, room,
mode, and match number do not matter.

- Only earlier-`seq` matches whose `match_rating.rating_status` is
  `processed` count, when their `ended_at` lies in the half-open window
  `(candidate.ended_at − 24 h, candidate.ended_at]`: exactly 24 h before is
  outside, an equal `ended_at` inside, and an earlier-`seq` match that ended
  after the candidate (a late save) outside. Friendly, cap-skipped,
  invalidated, and held rows never count.
- The rebuild calls the same function with its own per-pair lists, so live
  and rebuilt decisions match, a rescinded invalidation included.

### 4.5 Labels

One pure mapping (`web/src/lib/rated-play/label.ts`) and one
`RatedLabel.svelte` serve the result overlay, H2's `/history` rows and
`/match/<id>`, and R4's public list; H2's Tartan and Saaxiibtinimo chips move
to these keys with unchanged text. The overlay shows `matchStatus.rated` at
once, R1's status once `save.matchId` exists, and a `/learn#tartan` link.

| State                                 | Label                             | Sub-line                               |
| ------------------------------------- | --------------------------------- | -------------------------------------- |
| `rated = 0`                           | Saaxiibtinimo                     | only the two of you can see it         |
| `rated = 1`, no `match_rating` row    | Tartan                            | Waa la xisaabinayaa                    |
| processed                             | Tartan                            | R1's rating change                     |
| skipped `pairCap`                     | Tartan · Darajo laguma xisaabin   | pair-cap reason                        |
| skipped `invalidated`                 | Tartan · Darajada waa laga saaray | removed after a review                 |
| held                                  | Tartan                            | Waa la hubinayaa                       |
| ended before play began (result only) | —                                 | ended before the first move: not saved |

### 4.6 Failures

| Failure                                    | Behaviour                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Old cached joiner or creator               | No consent; friendly. The new client's label moves from waiting to "started before agreement".      |
| `disclosureOutdated`                       | Nothing recorded; the reload notice (PWA update) shows; consent stays pending.                      |
| Reconnect or DO restart before play        | Answers live in `room` storage; H1 resends `matchStatus`; a reloaded creator page shows the prompt. |
| Save pending or stalled; processor delayed | The label stays pending; nothing is rated before the row and its decision exist (H1, P17, R1).      |

## 5. Privacy and access

- v2-contracts §5 rows implemented: rated `/match/<id>` shows the label and
  rating status, reasons included, to everyone; friendly `/match/<id>`
  renders R2's label only after H2's participant check (others get the
  unknown-id 404); `/history` labels every saved game; the `/u/<username>`
  match list labels pending, cap-skipped, and invalidated rated matches.
- The pair-cap reason reveals only three counted, already public rated games
  between the pair in 24 h; friendly games never count.
- Only seated sockets receive `matchStatus` and `rematchStatus`; consent is
  keyed by the socket's seat; no user id, email, or ticket appears in any R2
  frame or label; the policy runs only in the web Worker. The disclosure is
  F2's "explained before play"; `/legal` follows in the enabling commit.

## 6. Resource budget

| Item                             | Cost                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Invite room with a rated request | ≤ 2 recorded `rateConsent` frames → ≤ 2 `room` puts and 2 `matchStatus` broadcasts; repeats write nothing; the existing 30-frames-per-10 s limit bounds changes                                                                                                    |
| Rematch                          | No new frames; `ratedVotes` adds < 40 bytes per `rematchStatus`                                                                                                                                                                                                    |
| Room storage                     | Answers and version: < 100 bytes in H1's `room` value                                                                                                                                                                                                              |
| Alarms, timers, DO wake-ups      | None added; frames wake the DO as today; `pnpm check:hibernation` unchanged                                                                                                                                                                                        |
| D1 from the game Worker          | None added by R2                                                                                                                                                                                                                                                   |
| Processor, friendly row          | No extra reads                                                                                                                                                                                                                                                     |
| Processor, rated row             | One primary-key read of R6's invalidation record; one pair-cap query from `match_player_owner_idx` over 24 h, joined by key to the other seat and `match_rating`: rows read ≈ one account's saved games in 24 h; `EXPLAIN QUERY PLAN` recorded with R1's migration |
| D1 writes                        | None by R2; R1 writes `match_rating` in its event batch                                                                                                                                                                                                            |
| Web                              | No new requests; `/learn` stays prerendered (≤ 220 more words)                                                                                                                                                                                                     |

## 7. Somali copy

Every string ships behind `// TODO(translation-review)` and uses the
[glossary drafts](README.md#somali-glossary-drafts-q4); Q4 clears them before
production enablement. Keys are under `messages.so.ratedPlay` unless shown.

| Key                                                    | Somali draft                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `mode.rated` / `mode.friendly` / `create.legend`       | Tartan / Saaxiibtinimo / Nooca ciyaarta                                                                                     |
| `disclosure.rated`                                     | Tartan: natiijada, dib u daawada, iyo magacyadiinna dadweynaha qof walba wuu arki karaa, Darajaduna way isbeddeli kartaa.   |
| `disclosure.friendly`                                  | Saaxiibtinimo: labadiinna oo keliya ayaa arki kara ciyaarta, Darajona laguma xisaabiyo.                                     |
| `disclosure.learnMore` / `consent.request`             | Sida Tartanku u shaqeeyo / Ciyaaryahanka kale wuxuu codsaday Tartan.                                                        |
| `consent.accept` / `consent.decline`                   | Aqbal Tartan / Ku ciyaar Saaxiibtinimo                                                                                      |
| `lobby.pending` / `lobby.agreed`                       | Tartan · waxaa la sugayaa oggolaanshaha / Tartan · labadiinnaba waad oggolaateen                                            |
| `lobby.declined` / `lobby.startedUnagreed`             | Saaxiibtinimo · Tartan lama wada oggolaan / Saaxiibtinimo · ciyaartu waxay bilaabatay ka hor oggolaanshaha                  |
| `lobby.needsAccounts`                                  | Tartan wuxuu u baahan yahay laba akoon; ciyaartan lama kaydinayo.                                                           |
| `firstMove.body` / `firstMove.wait`                    | Oggolaanshaha Tartanka weli lama dhammaystirin. Haddii aad hadda ciyaarto, ciyaartani waxay noqonaysaa Saaxiibtinimo. / Sug |
| `rematch.rated` / `rematch.friendly`                   | Dib u ciyaar Tartan / Dib u ciyaar Saaxiibtinimo                                                                            |
| `rematch.opponentOfferedRated`                         | Ciyaaryahanka kale wuxuu codsaday dib-u-ciyaar Tartan ah.                                                                   |
| `rematch.startedFriendly`                              | Dib-u-ciyaarkani waa Saaxiibtinimo: labadiinnaba Tartan ma wada dooran.                                                     |
| `status.pending` / `status.held` / `status.notCounted` | Waa la xisaabinayaa / Waa la hubinayaa / Darajo laguma xisaabin                                                             |
| `status.removed`                                       | Darajada waa laga saaray                                                                                                    |
| `reason.pairCap`                                       | Waxaad horey isu ciyaarteen 3 Tartan oo la xisaabiyay 24-kii saac ee ka horreeyay ciyaartan.                                |
| `reason.invalidated` / `friendlyPrivate`               | Darajada ciyaartan waa laga saaray kadib hubin. / Labadiinna oo keliya ayaa arki kara.                                      |
| `result.notSaved`                                      | Ciyaartu waxay dhammaatay ka hor tallaabada koowaad: lama kaydin, Darajona ma isbeddelin.                                   |
| `onlineGame.errors.consentClosed`                      | Nooca ciyaarta hadda lama beddeli karo.                                                                                     |
| `onlineGame.errors.consentUnavailable`                 | Tartan looma heli karo qolkan.                                                                                              |
| `onlineGame.errors.disclosureOutdated`                 | Xeerarka Tartanka waa la cusboonaysiiyay; fadlan dib u soo rar bogga.                                                       |
| `onlineGame.errors.ratedOnlyRematch`                   | Kulanka degdegga ah dib-u-ciyaarkiisu waa Tartan oo keliya.                                                                 |
| `onlineGame.errors.ratedPlayDisabled`                  | Tartanku hadda waa hakad; ciyaartu waa Saaxiibtinimo.                                                                       |

| `/learn#tartan` and `/legal`                                                  | Somali draft                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section: new `learnSectionIds` entry `tartan` after `dhammaadka`              | Nav "Tartan"; heading "Tartan iyo Saaxiibtinimo"                                                                                                                                                                                          |
| Paragraph                                                                     | Qol aad saaxiib ku casuunto wuxuu ku bilaabmaa Saaxiibtinimo. Tartan wuxuu dhacaa marka labada ciyaaryahanba leeyihiin akoon dhammaystiran oo ay labaduba oggolaadaan ka hor tallaabada koowaad. Kulan degdeg ah had iyo jeer waa Tartan. |
| Rules 1–2                                                                     | The two disclosure lines.                                                                                                                                                                                                                 |
| Rule 3                                                                        | Marka tallaabada koowaad la sameeyo, is dhiibid ama ka tagid waa guuldarro weji kasta, xitaa dhigista. Haddii ciyaartu dhammaato ka hor tallaabada koowaad, waxba lama kaydiyo.                                                           |
| Rule 4                                                                        | Laba ciyaaryahan 24-kii saac 3 Tartan oo keliya ayaa Darajo loogu xisaabiyaa; kuwa kale waa dadweyne, waxaana lagu calaamadeeyaa "Darajo laguma xisaabin".                                                                                |
| Rule 5                                                                        | Natiijada kadib waxaa muuqda "Waa la xisaabinayaa" ilaa xisaabtu dhammaato.                                                                                                                                                               |
| Callout (`talo`)                                                              | Darajadu ma laha dhibco go'an. Guul aad ka gaarto ciyaaryahan cusub ama mid Darajadiisa aan weli la hubin wax yar ayay beddeshaa Darajo xasiloon; Darajadaaduna way dhaqso u beddelantaa inta aad cusub tahay.                            |
| `/legal`, section `xogta`, after H2's saved-games paragraph (enabling commit) | Ciyaaraha Tartanka ah waa dadweyne: natiijada, dib u daawada, iyo magacyada dadweynaha ee labada ciyaaryahan qof walba wuu arki karaa, xitaa isagoo aan akoon gelin. Nooca ciyaarta waa la sheegaa ka hor tallaabada koowaad.             |

## 8. Implementation slices

1. `test(shared): cover rating policy v1 and the pair-cap window`
2. `feat(shared): add rating policy v1 to the rated-play module`
3. `feat(shared): add the rated disclosure and consent messages`
4. `test(online): cover the rated consent handshake`
5. `feat(online): handle rated consent and its kill switch in match rooms`
6. `feat(online): record rated rematch votes`
7. `feat(web): request rated play when creating a room`
8. `feat(web): show rated consent and status before the first move`
9. `feat(web): offer rated and friendly rematches`
10. `feat(web): label rated status on result, history, and match pages`
11. `feat(i18n): explain rated play on /learn` (section tests updated)
12. `test(ratings): check policy v1 through the processor and rebuild`
13. `feat(online): enable rated play in production` (var and `/legal`)

## 9. Acceptance tests

**Unit** (`packages/shared/src/rated-play`, plus protocol fixtures):

| Case                                                                                        | Expected                                                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Friendly and invalidated; invalidated and capped                                            | `friendly`; `invalidated`                                   |
| Two or three earlier processed pair games in the window                                     | processed; `pairCap`                                        |
| An earlier game at `endedAt − 86_400_000`; at `endedAt − 86_399_999`; at an equal `endedAt` | not counted; counted; counted                               |
| Earlier `seq`, later `endedAt` (late save); superset input                                  | not counted; same decision                                  |
| `writesLedgerRow` truth table                                                               | equals v2-contracts §4.1                                    |
| Golden decisions; disclosure hash                                                           | pinned to policy v1 and disclosure v1                       |
| `rateConsent`, rated `rematch`; an old client's schema                                      | parse; strips `ratedVotes` and the new `matchStatus` fields |

**Game Worker** (`worker/src/rated-consent.test.ts`, Workers pool):

| Case                                                                                                                                                                                                                     | Expected                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| A accepts, B never answers; play to game over                                                                                                                                                                            | first action accepted; payload `rated: 0`, `consentPolicyV: null`                                                  |
| Both accept; play to game over                                                                                                                                                                                           | payload `rated: 1`, `consentPolicyV: 1`                                                                            |
| Old cached joiner (V1 frames only)                                                                                                                                                                                       | friendly                                                                                                           |
| Decline; decline then accept before play; identical repeat                                                                                                                                                               | friendly; rated; no storage write                                                                                  |
| Consent after play began, on a rematch, in a quick room                                                                                                                                                                  | `consentClosed`                                                                                                    |
| Guest seat; room without a request; rated vote in a friendly room                                                                                                                                                        | `consentUnavailable`                                                                                               |
| Wrong `disclosureV`; wrong `matchNumber`                                                                                                                                                                                 | `disclosureOutdated`; `staleMatch`; nothing recorded                                                               |
| Switch missing or `"false"`                                                                                                                                                                                              | `ratedPlayDisabled` for consent and rated votes; earlier answers stand                                             |
| Rated match 1, then two plain accepts                                                                                                                                                                                    | match 2 friendly: consent does not carry over                                                                      |
| Votes (rated, rated); (rated, friendly)                                                                                                                                                                                  | rated; friendly (M9)                                                                                               |
| Quick room: a plain accept; two rated accepts                                                                                                                                                                            | `ratedOnlyRematch`; rated rematch                                                                                  |
| Consent frames while the starting seat waits                                                                                                                                                                             | idle nudge and claim deadlines unchanged                                                                           |
| Resign or claim before any non-terminal action                                                                                                                                                                           | no outbox entry (M7)                                                                                               |
| F4 matrix, rated and friendly: placement after one action (only the starting seat acted), initial removal, movement, pending capture, blocked space-making × own-turn resign, off-turn resign, abandon claim, idle claim | row with `end_reason = resignation`; the resigning, absent, or idle seat loses; `online_end_reason` set for claims |
| Hibernation and D1                                                                                                                                                                                                       | `pnpm check:hibernation` passes; the consent path makes no D1 call                                                 |

| Layer                                                                                                      | Cases                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Processor and rebuild (Miniflare D1, with R1)                                                              | M1–M9 give the table below with `rating_policy_v = 1` on every `match_rating` row; the cap holds across rooms, rematches, swapped seats, and both modes; boundary and late-save cases hold on real rows; skipped and held rows use no slot; M8 invalidate + rebuild → `invalidated`, rescind + rebuild → processed; dry-run rebuild has zero drift, cap decisions included.                  |
| Web (component)                                                                                            | Friendly preselected; Tartan only for complete accounts; disclosure before creating; auto-consent only from the creating page; each §4.1 lobby label; the first-move warning only while pending and before the first action; rematch buttons per room kind; every new error code mapped to §7; no English; M1–M9 labels with R1's read mocked; `/learn#tartan` linked from lobby and result. |
| E2E (`tests/e2e/rated-play.spec.ts`, shared local D1, [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)) | M2 end to end: Tartan chosen and accepted, B resigns after three placements, the saved row has `rated = 1`, a signed-out visitor opens `/match/<id>`. A declined invite saves `rated = 0` and signed out gets the 404. M9 saves the rematch with `rated = 0`.                                                                                                                                |

### Sample matches on R2's surfaces

| ID  | Lobby before the first move                                   | Result overlay                                             | `/history` (owner)                                           | Decision              | Public        |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ | --------------------- | ------------- |
| M1  | Saaxiibtinimo                                                 | Saaxiibtinimo                                              | Saaxiibtinimo                                                | `skipped:friendly`    | no (404)      |
| M2  | Tartan · both agreed                                          | Tartan, pending → R1's change                              | Tartan, R1's change                                          | `processed`           | yes           |
| M3  | Tartan · both agreed                                          | A lost (idle); Tartan, pending → change                    | Tartan, R1's change                                          | `processed`           | yes           |
| M4  | Tartan · both agreed (a cap is never predicted)               | Tartan, pending → Darajo laguma xisaabin + pair-cap reason | same                                                         | `skipped:pairCap`     | yes, labelled |
| M5  | Tartan · both agreed                                          | draw; Tartan, pending → change                             | Tartan, R1's change                                          | `processed`           | yes           |
| M6  | none; "needs two accounts; not saved" if Tartan was requested | V1 overlay, no label                                       | no row                                                       | —                     | nothing saved |
| M7  | Tartan · both agreed                                          | "ended before the first move: not saved"                   | no row                                                       | —                     | nothing saved |
| M8  | Tartan · both agreed                                          | Tartan, pending → change                                   | after the rebuild: Darajada waa laga saaray + removal reason | `skipped:invalidated` | yes, labelled |
| M9  | rematch: Saaxiibtinimo + "started friendly" notice            | Saaxiibtinimo                                              | Saaxiibtinimo                                                | `skipped:friendly`    | no (404)      |

M10 changes no R2 label; the player's name is H2's and A3's concern.

## 10. Rollout and rollback

| Environment | `RATED_PLAY_ENABLED`                            | Where                                                               |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| dev and e2e | `"true"`                                        | `worker/wrangler.toml` `[vars]` (the e2e launcher uses this config) |
| preview     | `"true"`                                        | `worker/wrangler.preview.toml`                                      |
| production  | `"false"`, then `"true"` in the enabling commit | `worker/wrangler.production.toml`                                   |

- **Order** ([§6.5](v2-contracts.md#65-deploy-order)): R1's migration, the
  game Worker, then the web Worker. An unrelated web deploy that ships R2's
  web slices before enabling only exposes the paused state: safe.
- **Enabling commit** (slice 13) once the wave-2 gate passes on preview,
  R1's processor is live, Q1 is answered (A3 in production first if yes),
  and Q4 has cleared §7: game Worker, then web Worker in one window.
- **Kill switch:** `"false"` by a configuration deploy (§3.5); local and
  guest play are unaffected. **Rollback:** prefer the switch; a code
  rollback runs web first, then game. Stored rows keep their visibility.

**Done when** §9 passes with `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:worker`, `pnpm build`, the rated-play `pnpm test:e2e` cases,
`pnpm check:hibernation`, and `pnpm check:e2e-isolation`; and on preview two
real accounts on two devices complete M1, M2, M4, M7, M9, a declined invite,
an old cached build (friendly), and the kill switch off and on, with a
zero-drift R1 rebuild. Only the ops record states production verification;
this document does not mark R2 shipped.
