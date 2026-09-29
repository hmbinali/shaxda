# A3 — Account Deletion (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                 |
| Wave       | 2 — in production no later than rated public play (end of wave 2). Activation is gated by open question **Q1**.                                                                                                                                                                                                                                                                |
| Depends on | H1, X1a; R1 if shipped; Q1                                                                                                                                                                                                                                                                                                                                                     |
| Register   | F5, P5, P11, Q1 ([register](README.md#decision-register))                                                                                                                                                                                                                                                                                                                      |
| Contracts  | Owns [§8](v2-contracts.md#8-deletion). Consumes [§1](v2-contracts.md#1-vocabulary) (neutral label), [§4.3](v2-contracts.md#43-canonical-sample-matches) (M10), [§5](v2-contracts.md#5-access-matrix), [§10.1](v2-contracts.md#101-one-cron-one-dispatcher)–[§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone), [§11](v2-contracts.md#11-migration-ownership) |
| Brief      | `docs/shaxda-v2.md` §13 (A3); its §17 lists Q1                                                                                                                                                                                                                                                                                                                                 |
| Touches    | `packages/db`, `web/`, `packages/i18n`, `scripts/` (`account:ops`), [accounts runbook](../ops/v11a-accounts-runbook.md), [`AGENTS.md`](../../AGENTS.md) (activation). No `worker/` change.                                                                                                                                                                                     |

Self-service deletion of a Shaxda account (V2 milestone A3, unrelated to the
V1 PRD's engine task A3): request, seven-day grace, cancel, tombstone, 30-day
username hold, the reader predicate, and restores. Nothing is written to the
ledger, the rating tables, or the game Worker: the ledger stores no names
(P5) and the cutover is time-based (P11). Reader specs own the rendering.

## 1. Outcome and non-goals

**Outcome.** An owner requests deletion from `/account` (or `/register`
while incomplete), can cancel for seven days, and sees the exact due time.
From the request on, the account cannot create, join, reconnect to, or queue
for an online game and has no public presence. After finalization it cannot
sign in and its identity data is gone. Opponents keep their saved games,
history, and rating outcomes; the deleted seat shows the neutral label. All
of the account's usernames become claimable 30 days after finalization.

**Must**

1. Request, status, and cancel at `/account/delete` for complete and
   incomplete accounts, reauthenticated within 15 minutes (§4.1).
2. Tickets stop at the request; a pending session reaches only status,
   cancel, sign-in, and logout (§4.2, §4.3).
3. One reader predicate: profile and aliases 404, the neutral label
   everywhere including OG metadata, no leaderboard or public read (§3.4).
4. Idempotent, conditional request, cancel, and finalize; cancel fails from
   the due time on, even if the job is late (§4.4).
5. Bounded, retryable finalization into a tombstone and a 30-day claim hold
   (§3.5, §3.6); no ledger or rating write (M10); the restore rule (§4.6);
   `/account`, `/legal`, and the accounts runbook updated.

**Should:** show the due time as `<time>` in UTC, enhanced to local time by
JavaScript; give new `/online` clients a specific pending-deletion notice.

**Not in A3:** editing or deleting games, results, replays, stats, or rating
events; restoring a finalized account; admin deletion UI; guest data (none is
stored, F8); any game Worker change — no web→game control path, active-seat
index, acknowledgement, or finalizer disconnect (P11); ledger scrubs,
triggers, or insert guards (P5); deleting analytics rows (P12); Better Auth's
`deleteUser`, which stays disabled (it hard-deletes `user` and its claims).

## 2. Decisions and dependencies

| ID  | How A3 applies it                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F5  | Grace: seven days from the request (server clock), cancelable until then. Hold: every claim the account owns (current name and aliases) stays claimed for 30 days from `deleted_at`, then is released.                                                                                                                                   |
| P5  | The ledger holds only private ids ([§2.1](v2-contracts.md#21-h1-tables)): finalization scrubs nothing there, needs no trigger or late-insert guard, and readers have no stored-name fallback.                                                                                                                                            |
| P11 | The only cutover is that the web Worker stops minting identity tickets at the request. No game Worker code, message, alarm, or storage changes. Consequences, including F4 claims against a pending account that cannot reconnect: §4.3.                                                                                                 |
| Q1  | **Open:** ship A3 in V2, and when? Recommendation: yes, in production no later than rated public play. A3 is not activated until Q1 is answered (the spec may still freeze), and wave-2 production enablement waits for the answer. If the answer is no, `/account` and `/legal` keep today's contact-based path and nothing here ships. |

| Dependency                   | What A3 uses                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1                           | The ledger: `match_player.user_id` with no FK to `user` and no names. Games finished during the grace save normally.                                                                       |
| R1, if shipped               | Rating events and `player_rating` stay. The processor never reads deletion state, so no opponent's rating depends on a deletion and a rebuild reproduces every row.                        |
| X1a (wave 1, before A3)      | The web entry wrapper, the minute cron and dispatcher, and `job_state`/`job_fence` ([§10.2](v2-contracts.md#102-web-worker-entry-wrapper), [§11](v2-contracts.md#11-migration-ownership)). |
| H2; later H3, H4, R3, R4, R5 | H2's reader paths and neutral-label key move to the §3.4 helper in A3; later readers use it from their first commit. K1's queue and room tickets stop with the identity route.             |

## 3. Contracts

A3 owns this section; [§8](v2-contracts.md#8-deletion) is its summary.

### 3.1 States

| State   | Predicate on `user`                                               | Owner                                                         | Everyone else                                                            |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Active  | `deletion_requested_at IS NULL` (CHECKs force the other two NULL) | Normal                                                        | Normal                                                                   |
| Pending | `deletion_requested_at IS NOT NULL AND deleted_at IS NULL`        | Status, cancel while `now < deletion_due_at`, sign-in, logout | Neutral label; profile 404; out of the leaderboard and every public read |
| Final   | `deleted_at IS NOT NULL` (request and due times kept)             | No session can exist                                          | As pending; claims held until `deleted_at + 30 days`                     |

### 3.2 Migration and auth model

Hand-written, numbered at merge; times are epoch milliseconds from the web
Worker's clock:

```sql
ALTER TABLE user ADD COLUMN deletion_requested_at INTEGER;
ALTER TABLE user ADD COLUMN deletion_due_at INTEGER
  CHECK ((deletion_due_at IS NULL) = (deletion_requested_at IS NULL)
     AND (deletion_due_at IS NULL OR deletion_due_at > deletion_requested_at));
ALTER TABLE user ADD COLUMN deleted_at INTEGER
  CHECK (deleted_at IS NULL OR (deletion_due_at IS NOT NULL AND deleted_at >= deletion_due_at));
CREATE INDEX user_deletion_due_idx ON user (deletion_due_at, id)
  WHERE deletion_due_at IS NOT NULL AND deleted_at IS NULL;   -- finalize probe
CREATE INDEX user_deleted_at_idx ON user (deleted_at, id)
  WHERE deleted_at IS NOT NULL;                              -- release probe
```

The CHECKs forbid a due time without a request, finalization before the due
time, and a cancel after finalization. `ADD COLUMN` does not rebuild `user`,
so the constraints listed in `packages/db/src/schema.ts` survive; A3 appends
its own to that list, which the migration test asserts along with both query
plans (a scratch SQLite 3.51 run already confirmed the CHECKs, the plans,
and the §3.6 match rule). Better Auth stays CLI-owned: the three fields are
optional `type: "date"` fields with `input: false` and `returned: false` in
`packages/db/better-auth.cli.ts` and `web/src/lib/server/auth/options.ts`,
regenerated with the pinned CLI (`schema:check` passes) and stripped by
`user.update.before`. Guards read the state from D1, never a session payload.

### 3.3 Web surface

| Surface                          | Contract                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /account/delete`            | Active: effects and form. Pending: due time, cancel before due, logout. Signed out: 303 to `/login?returnTo=/account/delete`. `no-store`, `noindex`. Layout data for a pending session: `account: { status: "pendingDeletion", dueAt }`.       |
| `POST ?/request`                 | Zod `{ confirm: string(1..254), acknowledge: "on" }`. `confirm` equals the username after `normalizeUsername`, or the account email (trimmed, case-insensitive) when there is no username. Origin must match `AUTH_BASE_URL`, as in `/logout`. |
| `POST ?/reauth`, `POST ?/cancel` | Reauth starts the Google hop of §4.1 with `callbackURL=/account/delete`; cancel has no fields; same origin check.                                                                                                                              |

### 3.4 Reader helper

`packages/db` exports one helper projecting a `user_id` to a public
identity (username, chosen avatar) or to `neutral`: public only when the row
exists, is active, and has a username; `neutral` renders the neutral label
with no link or avatar. Readers resolve seats by `match_player.user_id`,
never by a username string, so a reclaimed name never inherits old match
links. The leaderboard, profile numbers, and head-to-head exclude non-active
accounts with the same predicate; match lists keep the match with that seat
neutral (M10); and `resolveProfile` returns `missing` (no alias redirect)
for them.

### 3.5 Jobs

Both run in the [§10.1](v2-contracts.md#101-one-cron-one-dispatcher)
dispatcher from 00:15 UTC under their own `job_state` leases (`a3.finalize`, `a3.release`), at most 25 accounts per step, one D1 batch per account. A step
that completes some accounts and finds a full 25 leaves the run unfinished,
so it resumes on the next minute tick. No stored cursor: finalized rows leave
`user_deletion_due_idx`, and released accounts stop matching the release
probe.

| Batch    | Statements, in order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Finalize | 1. `job_fence` guard in the [§7.2](v2-contracts.md#72-the-fence) form: lease held **and** `deleted_at IS NULL AND deletion_due_at <= now`; a false or NULL guard fails the whole batch. 2. Delete the user's `session` and `account` rows. 3. Delete attributable `verification` rows (§3.6). 4. Set `released_at = COALESCE(released_at, now)` on the user's claims (all stay held). 5. Tombstone: `username = NULL`, `name = 'deleted'`, `email = <32 random hex>@deleted.invalid`, `email_verified = 0`, `image = NULL`, `avatar_mode = 'initial'`, `username_changed_at = NULL`, `updated_at = deleted_at = now`; `id`, `created_at`, and the request and due times stay. 6. Delete the fence row. |
| Release  | Guard: lease held and `deleted_at <= now − 30 days`. Then delete the user's `username_claim` rows. The probe selects final accounts past the hold that still own a claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 3.6 Verification audit (Better Auth 1.6.25)

Read on 2026-09-29 from the pinned package's `dist/`. OAuth state is stored
in `verification` (`storeStateStrategy` defaults to `database` when a
database is configured, `context/create-context.mjs`).

| Writer                                                     | Reachable in Shaxda                             | `identifier`             | `value`                                           | Attributable                                                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------- | ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in/social` (`state.mjs`), the only flow the UI uses | Yes                                             | Random 32-char state     | JSON: callback URLs, PKCE verifier, expiry, state | No user id or email. Expires in 10 min; its callback deletes it, and each state lookup deletes all expired rows (`db/internal-adapter.mjs`). |
| `/link-social` (`api/routes/account.mjs`)                  | By any signed-in session; the UI never calls it | Random 32-char state     | As above plus `link: { userId, email }`           | Yes, by `link.userId`                                                                                                                        |
| Password reset (`api/routes/password.mjs`)                 | No: no email/password                           | `reset-password:<token>` | The user id                                       | By value                                                                                                                                     |
| `deleteUser` (`api/routes/update-user.mjs`)                | No: disabled, route answers 404                 | `delete-account-<token>` | The user id                                       | By value                                                                                                                                     |

Email verification and change email use signed JWTs and write no row. Rule:
delete rows whose `value` equals the user id or whose JSON `value` has
`link.userId` equal to it, via
`CASE WHEN json_valid(value) THEN json_extract(value, '$.link.userId') END`;
never by email text, never all rows. The auth options test pins the audited
configuration (only the `sveltekit-cookies` plugin; email/password,
`deleteUser`, `changeEmail` off; database state); changing it or the pin
reopens the audit.

## 4. Behaviour and failure handling

### 4.1 Request

1. `/account` (and `/register` for incomplete accounts) links to
   `/account/delete`, which lists the effects (§7) and posts a plain form
   with the typed confirmation and a separate acknowledgement.
2. The request needs a session created within 15 minutes. Otherwise
   `?/reauth` sets a 15-minute `httpOnly`, `SameSite=Lax` cookie holding an
   HMAC of the user id (keyed from `BETTER_AUTH_SECRET` with an A3 label)
   and sends the owner through Google sign-in back here; the request is
   accepted only if the new session's user id gives the same HMAC, else
   `differentAccount` and no change. Ownership always comes from the
   session; the typed value only confirms.
3. One D1 batch sets `deletion_requested_at = now` and
   `deletion_due_at = now + 7 days` where `deletion_requested_at IS NULL`,
   and deletes every `session` row of the user. The response clears the
   cookie and shows the due time and how to cancel, only after the commit.
4. A repeat returns the stored due time; a retry after a lost response
   arrives signed out and sees the status after sign-in.

### 4.2 While pending

| Request from a pending session                                             | Result                                                                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/account/delete`, `POST /logout`                                          | Normal                                                                                                                                                         |
| Better Auth `sign-in/social`, `callback/google`, `get-session`, `sign-out` | Normal, so the owner can sign in again to cancel                                                                                                               |
| Every other `/api/auth/*` (`link-social`, `update-user`, `revoke-*`, …)    | `403 {"error":"account-pending-deletion"}`                                                                                                                     |
| `/api/online/identity`, GET and POST                                       | Same 403, `no-store`: no ticket of any kind. The shared status schema is unchanged, so a cached client shows its "identity unavailable" state with guest play. |
| `/login`, `/register`, `/account`, `/history`, other signed-in-only pages  | 303 to `/account/delete`                                                                                                                                       |
| Public pages and every other API                                           | Handled as signed out; the top bar links to the status page                                                                                                    |

A final account has no session. A session found for a final user (a sign-in
callback racing the finalizer) is deleted on sight and the request is
handled as signed out.

### 4.3 Online play during the grace (P11)

| Situation                               | What happens                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No open room                            | Nothing: create, join, reconnect, and queue all need a new ticket.                                                                                                                                                                                                                                                                                              |
| A room already open, socket connected   | The game continues, and so do rematches on the same socket until its sockets close, even past the due time. Every persistable match is saved (H1) and renders with the neutral label; a rematch is rated only with both rated votes (P3). The opponent's live card keeps the name shown at join until the room closes (60 idle minutes, far inside seven days). |
| That socket drops                       | Reconnect needs a ticket, so the seat cannot return. Existing rules apply: after play began a valid claim is a saved loss for the pending account (F4); before play began nothing is written (P1). The request page warns about this.                                                                                                                           |
| A ticket minted just before the request | A mint that read the account as active returns one ticket, usable until it expires (at most 90 seconds).                                                                                                                                                                                                                                                        |
| Waiting in K1's queue (if shipped)      | The entry can still pair, but the client cannot mint the room ticket, so K1's no-show handling applies (pre-play, no row).                                                                                                                                                                                                                                      |

### 4.4 Cancel

```sql
UPDATE user SET deletion_requested_at = NULL, deletion_due_at = NULL, updated_at = ?now
WHERE id = ?id AND deleted_at IS NULL AND deletion_due_at > ?now;
```

One row: active again with the same id, usernames, claims, matches, and
rating; tickets mint at once. Zero rows: re-read; already active is success,
past due or final is `tooLateToCancel` even before any finalize run. D1
serializes this against the finalize guard, so at the due time one wins.

### 4.5 Finalization, hold, and release

- The first 00:15 UTC run at or after the due time finalizes, normally
  within 24 hours; the status page then shows `finalizing`, never a minute.
  Each account is one all-or-nothing batch, never partly scrubbed; a failed
  batch waits for the next night and blocks no other account; a backlog above
  25 drains on the following minute ticks. Logs carry counts and error classes
  (`a3FinalizeFailed`), never ids, names, or emails.
- During the hold, claim rows block claim, rename, and
  `isUsernameAvailable`, and names and aliases return 404. After the release
  anyone may claim them, the same person's new account included.
- A new Google sign-in after finalization finds no `account` row and no
  matching email, so Better Auth creates a new user id with no matches,
  rating, or claims.

### 4.6 Restores and `account:ops`

`pnpm account:ops -- counts | export-deletions | replay-deletions [--time-travel <bookmark>]`
(with `--database <env>`) runs `packages/db` statements through Wrangler D1, like
R6-core; `counts` shows pending, overdue, final, and held accounts, no ids.
No D1 restore (Time Travel or import) may revive a deleted account:

1. `export-deletions` first writes the id and three times of every pending
   or final account in the database being replaced to an operator-only file
   (mode 0600); without it the restore does not start.
2. `replay-deletions` (idempotent) then makes every account match the
   export: pending keeps its due time and loses sessions older than the
   request; final reruns the finalize batch with its original `deleted_at`,
   so the hold end stays; pending but not exported becomes active.
3. An import is replayed before the binding switch; an in-place Time Travel restore runs as `replay-deletions --time-travel
<bookmark>`, which restores and replays in one command, and the replay revokes
   whatever the copy served in between. The export is then deleted.

## 5. Privacy and access

A3 implements these [§5](v2-contracts.md#5-access-matrix) rows:

| §5 row                                 | A3 behaviour                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending/deleted account                | Neutral label; profile and aliases 404 exactly like an unknown name; excluded from leaderboard and profile reads.                                           |
| `/match/<id>` … rated                  | Stays public. The seat is the neutral label in HTML, serialized data, title, description, OG/Twitter tags, and share text.                                  |
| `/match/<id>` … friendly               | Stays private to its participants: the opponent keeps full access; the deleted seat has no session, and the same person's new account is not a participant. |
| `/history`                             | Opponents keep every game with the neutral label; the pending owner is sent to the status page.                                                             |
| `/u/<username>` numbers and match list | 404 while pending and after finalization.                                                                                                                   |
| Head-to-head card                      | Hidden: the target profile is 404.                                                                                                                          |
| `/leaderboard`                         | Excluded; holds no rank. A3 purges no cache: a name-bearing shared cache (today only the leaderboard, 55 s) may show the entry until its TTL ends.          |

No response, page data, OG tag, log line, or analytics row carries the user
id, old email, placeholder email, or old username; a WebSocket frame carries
the old username only in a room already open at the request (§4.3). X1 sees
a pending session as signed out, so it records no account hash; older
pseudonymous rows age out in 90 days (P12). Operator tools print no names.

## 6. Resource budget

| Operation                       | Cost                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Request                         | One batch: 1 `user` row written, 1–3 `session` rows deleted.                                                                                                                                     |
| Cancel                          | One conditional update; one primary-key read on a miss.                                                                                                                                          |
| Hook                            | +1 primary-key read of the three columns per signed-in server request. None for signed-out requests, prerendered `/local` and `/online`, or game moves.                                          |
| Finalize run                    | One probe on `user_deletion_due_idx` (0 rows when idle). Per account one batch touching about 1 `user`, 1 `account`, 0–3 `session`, 0–1 `verification`, and 1–3 claim rows; at most 25 accounts. |
| Release run                     | One index-only probe over final accounts past the hold, one claim-index lookup each; per account one batch deleting 1–3 claims. Past about 50,000 final accounts, add a stored cursor.           |
| Readers, storage                | No extra query: the predicate rides the `user` join readers already make. Three nullable INTEGER columns; both indexes hold only pending or final rows.                                          |
| Game Worker and Durable Objects | Zero requests, wake-ups, alarms, and storage.                                                                                                                                                    |

## 7. Somali copy

All strings ship behind `TODO(translation-review)` and reuse the
[glossary drafts](README.md#somali-glossary-drafts-q4); the neutral label is
H2's key (`Xubin la tirtiray`). `onlineGame` lives in `messages.so`, the
rest in `siteContent.so`.

| Key                                                     | Draft                                                                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages.account.deleteBody` (replaces `deleteLater`)     | Waxaad codsan kartaa in akoonkaaga la tirtiro. Waxaad ka noqon kartaa 7 maalmood gudahood.                                                                 |
| `pages.account.deleteLink`; `pages.accountDelete.title` | Tirtir akoonkayga; Tirtir akoonkaaga                                                                                                                       |
| `pages.accountDelete.confirmUsername`; `confirmEmail`   | Si aad u xaqiijiso, qor magacaaga dadweyne: {username}; Si aad u xaqiijiso, qor iimaylka akoonkaaga                                                        |
| `pages.accountDelete.effects[0]`                        | Isla markiiba bogga dadweynaha waa la xirayaa, ciyaar akoon oo cusub ma bilaabi kartid, qalab kasta oo aad ku jirtana waa lagaa saarayaa.                  |
| `pages.accountDelete.effects[1]`                        | Ciyaar hadda socota way dhammaan kartaa, laakiin haddii xiriirku go'o dib ugu soo laaban kari maysid.                                                      |
| `pages.accountDelete.effects[2]`                        | 7 maalmood kadib tirtiriddu waa kama dambays. Ilaa markaas Google ku gal oo ka noqo.                                                                       |
| `pages.accountDelete.effects[3]`                        | Ciyaarihii la kaydiyay iyo natiijooyinkooda waa la hayaa si taariikhda ciyaartoyda kale u dhammaystirnaato; magacaaga waxaa beddelaya "Xubin la tirtiray". |
| `pages.accountDelete.effects[4]`                        | Magacyadaada dadweyne way xirnaanayaan 30 maalmood tirtiridda kadib, kadibna qof kasta ayaa qaadan kara.                                                   |
| `pages.accountDelete.effects[5]`                        | Tirtiridda kadib akoonka dib looma soo celin karo. Haddii aad mar kale Google ku gasho, akoon cusub ayaa la furayaa.                                       |
| `pages.accountDelete.acknowledge`                       | Waan fahmay in tirtiriddu noqonayso kama dambays 7 maalmood kadib.                                                                                         |
| `pages.accountDelete.submit`; `reauth`                  | Codso tirtiridda; Ammaan darteed, mar kale Google ku gal kahor intaadan codsan.                                                                            |
| `pages.accountDelete.requested`                         | Codsiga waa la kaydiyay. Tirtiriddu waxay noqonaysaa kama dambays {due}. Si aad uga noqoto, Google ku gal kahor waqtigaas.                                 |
| `pages.accountDelete.pendingTitle`; `pendingBody`       | Akoonkaaga waa la tirtirayaa; Tirtiriddu waxay noqonaysaa kama dambays {due}. Ilaa waqtigaas waad ka noqon kartaa.                                         |
| `pages.accountDelete.finalizing`                        | Muddadii laga noqon karay way dhammaatay. Tirtiridda waa la dhammaystirayaa.                                                                               |
| `pages.accountDelete.cancel`; `cancelled`               | Ka noqo tirtiridda; Waad ka noqotay tirtiridda. Akoonkaagu sidii hore ayuu u shaqaynayaa.                                                                  |
| `accountErrors.confirmMismatch`; `acknowledgeRequired`  | Qoraalku ma waafaqsana. Fadlan mar kale qor.; Fadlan calaamadee xaqiijinta.                                                                                |
| `accountErrors.differentAccount`                        | Waxaad gashay akoon kale. Wax lama beddelin; ku gal akoonka aad rabto inaad tirtirto.                                                                      |
| `accountErrors.tooLateToCancel`; `requestFailed`        | Muddadii laga noqon karay way dhammaatay.; Codsiga lama kaydin. Fadlan mar kale isku day.                                                                  |
| `topBar.pendingDeletion`                                | Akoonka waa la tirtirayaa                                                                                                                                  |
| `onlineGame.identity.pendingDeletion`                   | Akoonkaagu wuxuu sugayaa tirtirid, sidaas darteed ciyaar akoon ma bilaabi kartid. Marti ahaan waad ciyaari kartaa.                                         |

`/legal` (`legal.so.ts`): the `akoonka` retention and rights paragraphs drop
the "no self-service deletion" sentences and state the flow, the 7-day
window, what is removed and what stays (saved games as "Xubin la tirtiray"
with their rating events), the 30-day hold, the 90-day analytics window
(P12; X1a ships first), and the restore rule.

## 8. Implementation slices

1. `docs: activate A3 account deletion` — after Q1 = yes: README status and
   the `AGENTS.md` account rules.
2. `test(db): cover the account deletion migration`, then
   `feat(db): add account deletion columns and sweep indexes`.
3. `test(db): cover deletion request, cancel, finalize, and release`, then
   `feat(db): add account deletion statements and the reader helper`.
4. `feat(web): gate pending-deletion sessions and stop identity tickets`.
5. `feat(web): add the account deletion request and cancel flow`, with the
   `/legal` copy (`feat(i18n)`) and the runbook section (`docs(ops)`).
6. `feat(web): finalize deletions and release usernames in the dispatcher`.
7. `feat(web): show the neutral label for pending and deleted accounts` —
   existing readers (H2 pages, OG, history; R1 if shipped) move to §3.4.
8. `feat(ops): add account deletion counts, export, and replay`.
9. `test(e2e): cover deletion, grace-period play, and the final state`.

## 9. Acceptance tests

### Sample matches

| ID           | A3 setup                                    | Expected                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1           | Friendly, A beat B; B finalizes             | A's `/history` row and `/match/<id>` stay, B as the neutral label with no link or avatar. Signed-out viewers, unrelated accounts, and B's new account get the unknown-id 404.                                                                         |
| M2           | Rated, B resigned in placement; B finalizes | Page, replay, stats, rating status, title, description, OG/Twitter tags, and share text keep the result with B as the neutral label; the old name appears in no HTML or serialized data; A's history agrees.                                          |
| M10          | B requests after M2, then finalizes         | M2 public, B neutral; `/u/B` is 404. Every M2 `match` and `match_player` column is identical before, during, and after deletion; both M2 events unchanged; an R1 rebuild reproduces both `player_rating` rows with zero drift; B off the leaderboard. |
| M3–M9        | B is the deleted player                     | Only B's label changes; end reasons, rating statuses, skip reasons, and the "not counted" and "rating removed" labels stay; M9 stays private to A; M6 and M7 have no row.                                                                             |
| Grace game   | B pending; rematch on B's open socket       | Saved; B neutral; rated only with both rated votes; processed like any row.                                                                                                                                                                           |
| Dropped seat | B pending, play began, B's socket drops     | B cannot reconnect; A's valid claim saves a loss for B (F4).                                                                                                                                                                                          |
| Cancel       | B cancels before the due time               | Every surface shows B's current username again; the ledger is unchanged.                                                                                                                                                                              |

### Other cases

| Layer | Case                                      | Required result                                                                                                                                                                                                                                                                                    |
| ----- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1    | Migration                                 | Columns, the three forbidden states, both query plans, every `schema.ts` constraint still applied, `schema:check` green.                                                                                                                                                                           |
| D1    | Request; cancel before, at, and after due | Server-clock times, sessions deleted, same due time on repeat. Cancel 1 ms before due restores id, names, claims, and ledger; at due, after due, and after final it is `tooLateToCancel` with no finalize run.                                                                                     |
| D1    | Concurrent request, cancel, and finalize  | One outcome at the boundary; a failing statement injected into the finalize batch changes nothing.                                                                                                                                                                                                 |
| D1    | Finalize and jobs                         | Sessions and provider accounts gone; the user's `link-social` and `value = id` rows deleted; sign-in state rows, other users' rows, and non-JSON values untouched; tombstone exactly as §3.5. Duplicate runs, a stale lease, 26 due accounts in two steps, one failing account blocking no others. |
| D1    | Hold expiry                               | At `deleted_at + 30 days − 1 ms` names and aliases stay blocked and 404; after the release they are claimable, and a new claim belongs only to the new account.                                                                                                                                    |
| D1    | New Google sign-in after finalization     | Better Auth's OAuth lookup by provider account id and by email finds nothing; sign-in creates a new user id with no matches, rating, or claims. A session created for a final user is deleted on sight.                                                                                            |
| D1    | Restore                                   | Export, load a stale copy, replay: every state equals the export, nothing is revived, the hold end is unchanged.                                                                                                                                                                                   |
| Web   | Request guards                            | No session, a session older than 15 minutes, a different account after reauth, a wrong typed value, no acknowledgement, a cross-origin POST, or a non-form body changes and discloses nothing; every response is `no-store`.                                                                       |
| Web   | Pending gate and tickets                  | Every §4.2 row, including create, join, reconnect, and queue tickets refused; a new client shows the pending notice, one with today's parser falls back to guest play. Profile and aliases 404 without redirect.                                                                                   |
| Web   | Copy and config                           | `/account`, `/register`, and `/legal` show the new copy; the options test pins §3.6.                                                                                                                                                                                                               |
| E2E   | Request and cancel                        | Request, signed out with the due time, sign in, cancel, full access again.                                                                                                                                                                                                                         |
| E2E   | Open socket during the grace              | A and B in a room; B requests in another tab; B's open socket finishes a game and a rematch, both saved; A's history shows B neutral; B reloads, cannot rejoin, and A claims after the disconnect grace.                                                                                           |
| E2E   | Final state                               | The `vite preview` e2e server has no cron, so the fixture runs the finalize batch on the shared D1 ([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)); M1 and M2 then hold in real pages, `<head>` included.                                                                                    |

Before release: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:worker`, `pnpm test:e2e`, `pnpm build`, `pnpm check`, and
`pnpm --filter @shaxda/db schema:check`.

## 10. Rollout and rollback

| Environment | Steps                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev         | `wrangler d1 migrations apply shaxda-db --local`; run the jobs with `wrangler dev --test-scheduled` on the wrapped build (proof E3).                                                                                                                                                                    |
| e2e         | The game launcher applies the migration to the shared directory ([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)).                                                                                                                                                                                  |
| preview     | Migration on `shaxda-db-preview`, then the web deploy. Rehearse with test accounts: request and cancel; one request back-dated by a preview-only SQL statement so the 00:15 run finalizes it, then its `deleted_at` back-dated 30 days for the release; one §4.6 restore. Results go in the ops record. |
| production  | Only after Q1 = yes and activation: migration, then web deploy, with `/legal` and the runbook in the same release. After the first finalization, run `account:ops -- counts` and check one neutral match page.                                                                                          |

- **Deploy order:** migration → web
  ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)); no
  game Worker deploy (P11).
- **Kill switch:** none (contracts §10.3). The job runs daily, so a faulty finalizer
  is stopped by a web deploy without it before the next run; request and
  cancel stay, so no pending account is stranded.
- **Rollback:** never down-migrate, and never roll the web Worker back to a
  pre-A3 version while `counts` shows a pending account (that code ignores
  the columns and would restore full access and tickets); roll forward.

**Done when:** Q1 is answered yes and A3 is activated; §9 is green; the
preview rehearsal is recorded; the `/account`, `/legal`, and runbook changes
are released; the operator records production enablement in the ops record
(this spec claims nothing about production); and, with Q1 = yes, rated
public play reaches production only after A3 is live there.
