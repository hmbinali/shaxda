# Draft contract change for the R3 rank snapshot

Status: proposed for review before R3 activation. This draft is based on
`dd10db6` and the [local E6 snapshot results](e6-rank-snapshot-results.md).
The reviewable change would land in one explicit contract-change commit
with the register and all affected specs.

## Listing, rank, and identity

R3 builds a single current snapshot from R1's published `player_rating`
and the current account rows. Evaluate P19 at the build's `asOf`, including
the strict `eligible_until > asOf` predicate. Assign contiguous, one-based
ranks in full-precision `rating DESC, board_key ASC` order. P18–P20 and the
existing cursor format `[1, rating, boardKey]` carry forward. Each
response's rank and neighbours refer to one published generation. A cursor
points into the generation read by the request, so a traversal across
refreshes can repeat or skip rows.

R3 owns `leaderboard_rank` and a singleton `leaderboard_rank_state`.
The rank table has an integer primary key `rank`, a unique `user_id`,
and a unique index on `(sort_rating, board_key)`, where
`sort_rating` is the stored generated value `-rating`. It contains the
cursor fields, the published rating, rated counts, streak and form, and
`eligible_until` for building state. Resolve username and selected avatar
from the current account by id. Keep ids private and send only R3's
specified public fields. Username release and reuse never transfer ranks
to a new account.

For page 1, walk the rank primary key from 1. For a valid cursor, seek the
first key strictly greater than `(-rating, boardKey)` in the cursor index.
Use that row's stored rank as the lower bound for a primary-key range with
a 101-row limit. A cursor between ties, between ratings, or past the end
uses the same lookup. Standing and R4's profile rank seek by `user_id`.
Standing reads up to three neighbours each side in one rank range,
including the viewer only once in the response. Page, standing, and
profile-rank reads check snapshot state in the same D1 batch as the data.
There is no count-ahead query or live rank fallback. The optional activity
list keeps its separate rated-time index and aggregate ordering.

## Publication and freshness

- Store the published `asOf`, earliest listed `eligible_until`, earliest
  unreflected change, and a privacy invalidation flag in the singleton.
  R1 rating commits and correction swaps, R6 exclusion and inclusion,
  account completion, and A3's state changes mark a relevant snapshot dirty
  in the same D1 transaction as the source write. Keep the earliest
  unreflected time across coalesced writes. When an active-account identity
  edit leaves eligibility unchanged, origin reads join the current
  identity and an existing cached response ages out within its usual TTL.
- Publish replacement rows and state in one D1 batch. Take the build's
  `asOf` at execution time. Serialize publishers with a singleton
  coordinator and fence retried or delayed publication so an old request
  cannot overwrite a newer generation or clear an unreflected change. If a
  source write commits after the batch, its dirty mark belongs to the next
  generation. Confirm deliberately aborted and overlapping publication
  cases in the implementation.
- The proposed scheduler is a web-owned Durable Object singleton. The
  committing path hints after a successful transaction. A dirty
  generation starts a build within 10 seconds of the first unreflected
  change. Arm an alarm for the earliest listed expiry when clean. A due
  event gets the same bound even without a new game or a leaderboard
  request. The existing minute dispatcher checks durable dirty state for
  missed hints and repairs scheduling. Avoid rebuilding when clean and
  coalesce later writes, including duplicate or out-of-order hints, within
  the original deadline. The prototype measures D1 publication. Preview
  must verify alarm timing, retry behavior, and hint delivery.
- Keep public HTML and data session-independent with `max-age=0`.
  Cap shared cache TTL at 25 seconds and clip it to the time remaining
  before the oldest unreflected event or eligibility expiry reaches
  55 seconds. Compute TTL immediately before the cacheable response
  leaves the Worker. A response with less than one whole second left is
  `no-store`. A privacy-invalidated, overdue, uninitialized, or failed
  snapshot produces a retryable uncached 503 on leaderboard surfaces.
  R4 keeps its profile available and reports the rank as unavailable. A
  healthy empty generation serves the normal empty state. Preserve the
  maintenance note from the current processor state.
- For deletion requests and exclusion, dirty state prevents newly served
  origin responses from exposing a stale rank or displaying a list with
  holes. Existing edge entries can retain their prior public view until
  their TTL expires (at most 25 seconds). A3's profile 404 and session
  restrictions still apply immediately. After repair, recompute contiguous
  ranks before serving a new generation. Record this cache behavior
  explicitly in A3 and R6.
- The healthy-path time budget from game completion is 15 seconds for
  saving and R1 processing, 10 seconds to start publication, 5 seconds for
  publication, and 25 seconds of shared cache, totalling 55 seconds. Allow
  the remaining five seconds for response assembly and edge cache
  insertion. The publication and cache terms also apply to time exits and
  already-committed source changes.
  Keep the existing preview requirement to measure a real qualifying game
  from completion to visibility with a warmed cache. The R1 minute sweep
  recovers missed processor hints. A game decided via that recovery path
  can miss the healthy-path completion SLO. The rank snapshot never grants
  eligibility from an undecided match.

## Resource envelope and release

The uncached page limit stays at 2,000 rows and 100 ms in D1. Cached preview
p95 stays below 200 ms. Test page 1, deep pages, edited and exhausted
cursors, standing, profile rank, and empty snapshots. At the dense fixture
size a full replacement costs about 18,000 D1 row writes. Five dense
replacements use nearly 90,000 writes before ordinary traffic. The
prototype supplies a bounded read path and a local freshness result. The
production publisher needs a measured write envelope at expected board
size and activity before release. Consider an incremental publisher or
measured alternative if full replacement plus other workloads exceeds the
environment's allocation. A slower refresh or stale serving would change
the freshness contract.

Apply the R3 D1 migration and the web coordinator class migration in the
approved preview rollout. Backfill the first generation before making the
leaderboard routable. Exercise the rating hint, scheduled expiry, lost
hint, failed build, correction, exclusion, and deletion paths in preview
with warm HTML and data caches. Capture completion-to-visibility,
publication latency, reads and writes, cache TTL and p95. Keep the
rollback able to disable ranking pages while preserving R1's ledger and
rating projection.

## Edits to land together on adoption

| Owner                                  | Change                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts and decision register | Add R3's storage, atomic publication, cache/privacy behavior, scheduler and migration ownership in contracts §§5, 8, 10, 11. Record the adopted change in the register and link E6.                |
| R3                                     | Replace count-ahead reads, live-rank timing, 55-second edge TTL, and the snapshot fallback with this snapshot contract. Update query budgets, acceptance tests, and preview and rollback steps.    |
| R1 and R6                              | Mark dirty state in the same transaction as a processed rating event, successful correction swap, exclusion or inclusion, and specify after-commit hints. R1's rating state remains authoritative. |
| A3 and account identity                | Mark privacy invalidation on loss of account visibility, mark ordinary dirty state on restored or newly complete membership, and document the warm-cache bound.                                    |
| X1a                                    | Register the recovery check in the existing dispatcher. The R3 coordinator owns sub-minute alarms.                                                                                                 |
| R4                                     | Display rank from R3's published generation. Carry its rank timestamp separately from the profile's live record and RD timestamp. Surface rank unavailability distinctly from an unlisted account. |
| R5                                     | Source the board and standing form from R3's published generation. Profile charts keep their existing `asOf`.                                                                                      |
