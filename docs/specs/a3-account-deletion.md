# A3 — Account Deletion (Spec)

| Field | Value |
| --- | --- |
| Status | Draft specification; A3 is optional and is not activated or shipped by this document. |
| Brief | `docs/shaxda-v2.md` §13 (A3), §7.2, §14, §17 question 5 |
| Depends on | H1 match ledger; reconcile R1–R6, H2–H4, and K1/K2 if they have shipped before A3 starts |
| Workspace | `a3-account-deletion` |
| Touches when implemented | `packages/db`, `web/`, `packages/i18n`, account and online-room tests, runbooks; `worker/` only for active-seat revocation |

The V2 brief controls A3 scope. The older PRD also has an unrelated engine task
called A3; this specification is for **V2 account deletion**. H1 and the other
V2 contracts are still drafts in this checkout. Reconcile the merged schema,
routes, and rating policy before implementation; do not implement against a
draft column name. No account or match data is changed by writing this spec.

## 1. Outcome and boundaries

An account owner can request deletion from `/account`, undo the request during
a **seven-day** grace period, and see when deletion becomes final. At
finalization the account can no longer sign in or appear as a public profile.
Opponents keep their match pages, history, and valid rating outcomes. The
deleted seat has one neutral Somali label and no old username, avatar, email,
or profile link. All of the account's usernames become claimable by someone
else **30 days after finalization**.

### Must

1. A server-owned, confirmed deletion request and cancellation flow, including
   incomplete Google accounts, with Somali copy and an exact due date.
2. Finalize eligible requests in bounded, retryable web-Worker jobs. Delete the
   owner's Better Auth `session`, `account`, and attributable `verification`
   rows; retain the `user` row as a scrubbed tombstone with `deleted_at`.
3. Keep `match` and `match_player` rows and rating events. Scrub every retained
   username snapshot for the deleted seat, including a match saved late by an
   active room. Exclude the account from public rank/profile reads.
4. Hold every username claim belonging to the deleted account for 30 days,
   then release it without redirecting an old alias to a tombstone.
5. Revoke account access to online rooms and the quick-match queue. Preserve
   guest play and the game Worker's auth/session boundary.
6. Update `/legal` and the account operations runbook to describe the grace
   period, public-match retention, internal rating ledger, username release,
   and the real limits of deletion, including operational backups.

### Out of scope

Deleting individual games, changing completed results, recalculating rating
arithmetic, restoring an account after finalization, email/password login, a
new identity provider, guest-data deletion, admin deletion UI, and any new
public history privacy setting. A new Google sign-in after finalization is a
new account with a new private id and no inherited matches or rating.

## 2. User flow

1. `/account` replaces its current disabled deletion notice with a link to a
   dedicated, no-store confirmation view. Incomplete signed-in accounts can
   reach that view from `/register` without choosing a username first.
2. Show that deletion becomes final after seven days, can be canceled before
   the displayed deadline, removes sign-in and the public profile, but keeps
   anonymized public matches and their rating outcomes. Explain that a game
   already in progress may finish during the grace period. Require the owner
   to enter the current username, or their private account email if no
   username exists, and tick a separate acknowledgement. Use a normal
   SvelteKit POST form that works without JavaScript.
3. Require a current Better Auth session created within the last 15 minutes.
   If it is older, take the owner through Google sign-in and verify that the
   returned session belongs to the **same** user id before accepting the POST.
   Do not use a browser-supplied user id, email, or username as ownership proof.
4. On acceptance, record `deletion_requested_at` and `deletion_due_at` from the
   server clock. First ask the private game control path to block new seat
   claims and rematches, then commit the pending state; acknowledge the
   request only after both steps succeed. If the database write fails, clear
   the provisional game block by its idempotency key. If reconciliation is
   uncertain, keep the block and show a retryable processing state rather
   than claiming that deletion was scheduled. Repeated requests return the
   same deadline. Sign out all current sessions after recording the request.
   A later Google sign-in may
   authenticate during grace, but all product routes and mutations are gated
   to the pending-deletion view, cancellation, and logout.
5. The owner may cancel by signing in with the same Google account and posting
   the cancel action before `deletion_due_at`. Cancellation restores normal
   access and visibility without changing the account id, username, matches,
   or ratings. At or after the due time, cancellation fails closed even if a
   scheduled sweep has not yet run.
6. The finalizer runs promptly after the deadline. The UI must not promise an
   exact minute of irreversible scrubbing; it may say the seven-day window is
   over while finalization is retrying. An operational failure is retried and
   surfaced to the operator without exposing private data in logs.

Every mutation uses a same-origin, session-checked POST and Zod-validated
fields. Request, cancel, and status responses use `Cache-Control: no-store`.
Both actions are idempotent and use conditional writes so a cancel racing the
finalizer has one clear winner.

## 3. State and storage

Add `user.deletion_requested_at`, `user.deletion_due_at`, and
`user.deleted_at` as nullable epoch-millisecond columns with an indexed due
time for the sweep. States are:

| State | Predicate | Access and public display |
| --- | --- | --- |
| Active | all three columns null | Existing account behavior. |
| Pending | request and due set, deleted null | Only cancellation/status/logout; profile 404; neutral match label; no leaderboard or new account game. |
| Final | deleted set | No valid session/provider link; profile 404; neutral match label; username claims held until release. |

Use a hand-written D1 migration, numbered after the merged migrations. Better
Auth's generated schema is CLI-owned: add non-client-writable, non-returned
fields to its configured user model, regenerate it using the pinned CLI, and
keep `pnpm --filter @shaxda/db schema:check` passing. Preserve the existing
username/avatar checks, unique indexes, and foreign keys when changing the
`user` table. Server guards must read the pending state from D1 rather than
assuming Better Auth's cached session payload contains it. The migration and
query tests must prove this on local D1.

### Finalization transaction

For one due user id, one guarded D1 batch/transaction must:

1. Confirm `deleted_at IS NULL`, `deletion_due_at <= now`, and that the request
   was not canceled. If already final, return success without repeating work.
2. Delete the user's `session` and `account` rows. Delete only `verification`
   rows that can be attributed to that user's current private email or provider
   identifiers under the **merged, pinned Better Auth schema**. Because this
   table has no user FK today, audit its actual identifier formats first;
   never delete all verification rows or guess by a partial email match. If
   attribution cannot be made safely, stop and report the row for a bounded
   operational repair before marking final.
3. Scrub `match_player.username_snapshot` for this user to a constant neutral
   token. Do not change `match`, seat, result, `user_id`, timestamps, replay,
   or rating before/after values. The internal opaque id remains only to keep
   the ledger and deterministic rating rebuilds intact.
4. Set `user.username = NULL`, `name` to a constant neutral value, `email` to
   a unique random non-deliverable placeholder unrelated to the old email,
   `email_verified = false`, `image = NULL`, `avatar_mode = 'initial'`,
   `username_changed_at = NULL`, and `deleted_at = now`. Keep the immutable
   private id for ledger joins. Do not put the old email or username inside the
   placeholder or a log.
5. Mark **all** `username_claim` rows owned by this user as released at
   `deleted_at`. They still block new claims during the 30-day hold. A separate
   indexed, bounded sweep deletes those claim rows at `deleted_at + 30 days`;
   before that instant `isUsernameAvailable`, initial claim, and rename must
   all reject them. The current username and historical aliases follow the
   same hold. A deleted alias resolves to 404, never to the tombstone or a
   new owner's unrelated profile.

Use a database-side guard for any **late H1 insert** of a `match_player` row
whose user is pending or final: normalize its `username_snapshot` to the same
neutral token within the insert transaction, or reject the write with an
explicit recoverable code and preserve the room's pending persistence state.
An after-insert scrub trigger is one possible implementation. The game Worker
must still write only the H1 match tables and must not read auth tables. Test
the chosen guard under concurrent finalization and match persistence. No
public reader may fall back to the historical snapshot when the joined user
is pending, deleted, or missing.

`player_rating` and derived rating-event rows remain. Exclude pending/final
users in R3's rank query and every public projection or cache. R1/R6 rebuilds
continue to use private ids and the intact ledger; exclusion from public
ranking must not retroactively change an opponent's rating. Review any R6
flags/admin audit that retain ids, and ensure those records are private and
do not render the old name. No permanent user id or placeholder email reaches
page data, metadata, WebSocket frames, analytics, or logs.

## 4. Online seats and grace-period cutover

The web Worker alone validates sessions and initiates deletion. It stops
minting identity tickets as soon as a request is pending. A ticket minted
earlier can still be valid for 90 seconds, and an existing WebSocket can last
longer; blocking the mint endpoint alone is insufficient.

At implementation, add a private web-to-game control path and a durable index
of active account seats keyed by private user id. Register on account seat
claim and clear on room cleanup; fail closed on a failed registration. The
index must serialize a pending/final revocation mark with registrations, so a
pre-request ticket cannot claim a seat after revocation. It contains only
private ids, room references, and revocation state; use DO storage and alarms,
not D1 auth reads or per-move calls. The web Worker retries control messages
idempotently, and finalization waits for an acknowledgement that all indexed
seats were addressed. Reconcile stale entries after room cleanup. A queue DO,
if K1 has shipped, must remove that user's waiting entry and reject new joins
under the same revocation mark.

During grace, an **already-started** match may finish and persist, but the
pending seat cannot start a rematch or new room, mint a reconnect ticket, or
join a quick-match queue. The room keeps its captured display snapshot only
until the current game ends. If it is still active at the seven-day deadline,
the finalizer disconnects and neutralizes that seat before scrubbing the user;
the opponent follows the existing disconnect/claim-win rules. Do not mark an
unfinished game as a played loss merely because deletion was requested. Test
connected, disconnected, hibernated, and persist-pending rooms. Cancellation
releases the revocation mark only after the database cancel succeeds.

## 5. Read paths and copy

- `/u/<username>` and all aliases return 404 while pending or final. No
  redirect may disclose the new tombstone placeholder.
- Public match pages, replay, profile recent-match cards, head-to-head, OG
  metadata, and the opponent's `/history` show the same neutral Somali label
  without a link or avatar image. Use the current account row only for active
  users. H2's draft `H2-D3` currently allows a deleted-member snapshot label;
  explicitly change that contract and its tests before A3 ships.
- `/history` for the deleting owner is unavailable while pending and after
  finalization; opponents' owner-only histories remain unchanged except for
  the neutral label. R4/R5 public comparisons to a pending/final profile are
  unavailable; the deleted player's own rating is not published.
- `/account`, `/register`, `/legal`, and any account-aware navigation use
  reviewed Somali copy. Replace the current “deletion comes later” notice.
  Explain the seven-day cancellation window, 30-day username hold, retained
  anonymized game records, and no account recovery after finalization.

Do not claim that rating and match rows are erased. Review social metadata,
shared caches, generated static output, exports, and the PWA's stored account
view so a stale name is not served after the state change. All owner-specific
and deletion pages are no-store.

## 6. Tests and acceptance

Use Miniflare D1 for migration, query, and batch/trigger behavior; web route
tests for owner checks and rendered output; Worker tests for active seats and
hibernation; and a Playwright flow for confirmation, cancellation, and final
state. Fixed clocks cover the exact due-time and 30-day boundaries.

| Case | Required result |
| --- | --- |
| Wrong/missing session, stale confirmation, wrong typed value, or cross-origin POST | No state change or private-data disclosure. |
| Repeat request or concurrent request/cancel/finalize | One deadline and one final outcome; no partly scrubbed account. |
| Pending account signs in | Can cancel or log out; cannot mutate settings, mint a ticket, queue, or see its public profile. |
| Cancel just before/at due time | Before: account returns intact. At due: cancel fails even if sweep is late. |
| Finalize account with many matches and aliases | Both opponents' history and rating results stay; every deleted-seat snapshot is neutral; all aliases 404 and blocked for 30 days. |
| Late match write or rating rebuild | No old username reappears; match persists once; opponents' ratings reproduce exactly. |
| Active or hibernated room, valid old ticket, queued user | No new seat or rematch; current match may finish; final cutoff removes live name and follows existing game outcome rules. |
| Hold expires | Old usernames become claimable; a newly claimed one belongs only to the new account. |
| New Google sign-in after finalization | New account id, no old matches/rating, no restoration of provider link. |

Before release, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm
test:worker`, `pnpm test:e2e`, `pnpm build`, and the schema/migration checks.
Stage the migration and control path in local and preview environments before
production. The release runbook must include an idempotent failed-job retry,
counts of due/pending/final accounts without PII, a sample neutral match-page
check, and rollback rules that never revive a finalized account from a stale
backup or re-expose a historical snapshot.

## 7. Decisions and implementation gate

| ID | Decision | Basis |
| --- | --- | --- |
| A3-D1 | Seven-day cancelable grace period. | Founder answer, 2026-09-25. |
| A3-D2 | Username and all its aliases become claimable 30 days after finalization. | Founder answer, 2026-09-25; applies the V2 brief's 30-day hold. |
| A3-D3 | Keep a tombstone and private ledger/rating ids; scrub all public identity snapshots. | V2 §13 and opponent-history integrity. |
| A3-D4 | A current game may finish during grace; no new room/rematch; active seat is neutralized by finalization. | Provisional pending the founder's answer about already-open games. |

Activation remains a founder roadmap decision because V2 §17 explicitly
asks whether optional A3 should ship in V2. Before implementation, inventory
all merged tables that carry an account id, username, email, avatar URL, or
provider identity. Reconcile H1/H2/R1/K1 contracts, verify the pinned Better
Auth deletion hooks and verification identifier format, and record any
necessary brief/PRD/AGENTS changes in the first A3 implementation commit.
