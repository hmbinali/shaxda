# E6 local D1 query study

Run on Shaxda baseline `7c91b50` on 2026-11-14. Versions were Node
24.18.0, pnpm 9.15.4, Wrangler 4.107.0, Miniflare 4.20260701.0, and
workerd 1.20260701.1 (compatibility date 2026-07-01). From the repository
root, with Node from `.nvmrc`:

```sh
pnpm install --frozen-lockfile
node docs/specs/evidence/e6.mjs > /tmp/shaxda-e6.json
```

The script opens a nonpersistent Miniflare D1 binding on loopback. It loads
the existing accounts migration and the frozen DDL for H1, R1, A3's user
columns, and R6-core. It inserts 5,000 matches for one account across 50
opponents and 20,000 background matches. The deterministic fixture uses
sequential ids and modulus patterns for outcomes, seats, rating states, and
timestamps. It includes tied end times, missing/incomplete/pending-deletion
opponents, mixed rated and friendly games, and one processed event after
the fixed `asOf` (2026-11-14 00:00 UTC). Two R4 re-seeds vary the share of
processed games. The fixture replays, stats, and rating outcomes are
synthetic payloads used to exercise reads. It runs `ANALYZE` before
measuring. The independent board fixture holds 5,000 rating rows, with
tied full-precision ratings and 4,496 or 500 listed players (89.92% and 10%).

The study executes each bound statement and its `EXPLAIN QUERY PLAN`.
`Rows read` is the statement's D1 `meta.rows_read`, which counts index
visits and can exceed the number of returned rows. Millisecond values are
the local `meta.duration` from one run and vary on replay. SvelteKit latency, profile stats parsing, and preview performance are
implementation checks. The JSON also prints the unabridged plan for every statement.
See [D1's query metadata](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).

## Findings by milestone

- **H2 passes.** Each cursor reproduces the first page's lookahead row
  for its filter. The unfiltered cursor crosses a tied timestamp. The D1
  detail metadata is 6 reads (8 with labels), above the logical estimate
  of 5 (6), with keyed access. It joins the same SQL for friendly and
  missing matches. Authorization, malformed-id short-circuiting, neutral
  label rendering, and the label maintenance note belong to the H2 loader
  acceptance tests.
- **R3 exceeds the deep-page budget.** Including maintenance and the
  exact offset needed by §3.3, the 75%-depth pages use 7,343 and 5,232
  reads at the two densities. The page rows alone are under budget, and
  the individual statements used at most 3 ms locally on the
  frozen indexes. The additional `eligible_until` index leaves the
  default plans and counts unchanged in the sparse case. Forcing the
  extra index for the sparse offset alone brings that page to 1,988 reads
  (1,112 rows query + 875 offset + 1 maintenance), leaving 12 reads of
  headroom. Forcing it for the ordered rows introduces a sort. The dense
  case still needs a bounded exact-rank path. The optional activity list
  uses indexed base access and sorts the aggregate; it misses a literal
  no-order-sort rule if that rule includes this optional list.
- **R4 passes the local indexed-read check.** The full profile's stats
  work scales with saved games. With 5,000 processed games the aggregate
  returns 5,000 stats payloads, and in friendly-heavy history the rated
  list can walk essentially the whole owner's range. Preview still
  measures total profile reads, p95, and JSON validation CPU against the
  shipped writer and H4 backfill.
- **R5 passes the local indexed-read check.** The strongest measured
  distinction is the printed chart SQL admitting a post-`asOf` row.
  The bounded version keeps the indexed range and excludes the row.
  Last-peak and adjacent profile data use key lookups.

## Statement measurements

| Statement                                          | Returned | Rows read | D1 ms | Plan |
| -------------------------------------------------- | -------: | --------: | ----: | ---- |
| H2 page all                                        |       21 |        84 |     2 | 1    |
| H2 cursor all                                      |       21 |        85 |     2 | 2    |
| H2 page wins                                       |       21 |       108 |     1 | 1    |
| H2 cursor wins                                     |       21 |       110 |     2 | 2    |
| H2 page losses                                     |       21 |       109 |     2 | 1    |
| H2 cursor losses                                   |       21 |       109 |     0 | 2    |
| H2 page draws                                      |       21 |       289 |     5 | 1    |
| H2 cursor draws                                    |       21 |       295 |     4 | 2    |
| H2 page rated                                      |       21 |       112 |     1 | 1    |
| H2 cursor rated                                    |       21 |       112 |     0 | 2    |
| H2 page friendly                                   |       21 |       144 |     0 | 1    |
| H2 cursor friendly                                 |       21 |       151 |     1 | 2    |
| H2 detail rated                                    |        2 |         6 |     1 | 3    |
| H2 detail friendly                                 |        2 |         6 |     0 | 3    |
| H2 detail missing                                  |        0 |         0 |     0 | 3    |
| H2+R1 page all                                     |       21 |       103 |     1 | 4    |
| H2+R1 cursor all                                   |       21 |       105 |     1 | 5    |
| H2+R1 page wins                                    |       21 |       127 |     1 | 4    |
| H2+R1 cursor wins                                  |       21 |       130 |     1 | 5    |
| H2+R1 page losses                                  |       21 |       129 |     0 | 4    |
| H2+R1 cursor losses                                |       21 |       128 |     1 | 5    |
| H2+R1 page draws                                   |       21 |       309 |     1 | 4    |
| H2+R1 cursor draws                                 |       21 |       315 |     0 | 5    |
| H2+R1 page rated                                   |       21 |       132 |     1 | 4    |
| H2+R1 cursor rated                                 |       21 |       132 |     0 | 5    |
| H2+R1 page friendly                                |       21 |       163 |     1 | 4    |
| H2+R1 cursor friendly                              |       21 |       171 |     1 | 5    |
| H2+R1 detail rated                                 |        2 |         8 |     1 | 6    |
| H2+R1 detail friendly                              |        2 |         8 |     0 | 6    |
| H2+R1 detail missing                               |        0 |         0 |     0 | 6    |
| H2 summary counts                                  |        1 |     5,001 |     5 | 7    |
| H2 summary form                                    |       20 |        20 |     0 | 7    |
| R5 head-to-head                                    |      100 |     5,201 |    23 | 8    |
| R5 head-to-head empty                              |        0 |     5,001 |     3 | 8    |
| R5 viewer record                                   |        1 |         1 |     0 | 9    |
| R5 target record                                   |        1 |         1 |     0 | 9    |
| R5 printed SQL (no upper bound)                    |      921 |     2,719 |     6 | 10   |
| R5 rating window 7d                                |       69 |       207 |     1 | 11   |
| R5 rating window 30d                               |      305 |       903 |     2 | 11   |
| R5 rating window 90d                               |      920 |     2,718 |     4 | 11   |
| R5 rating peak                                     |        1 |         2 |     1 | 12   |
| R4 profile resolution                              |        1 |         2 |     1 | 13   |
| R4 public record                                   |        1 |         1 |     1 | 9    |
| R4 maintenance flag                                |        1 |         1 |     0 | 14   |
| R4 rated list mixed                                |       10 |        73 |     1 | 15   |
| R4 lifetime stats mixed                            |    2,561 |    12,268 |   146 | 16   |
| R3 maintenance flag (each page)                    |        1 |         1 |     0 | 14   |
| R3 d=0.9 page 1                                    |      101 |       218 |     1 | 17   |
| R3 d=0.9 deep page                                 |      101 |       216 |     1 | 18   |
| R3 d=0.9 deep page offset                          |        1 |     7,126 |     3 | 19   |
| R3 d=0.9 listed viewer                             |        1 |         2 |     0 | 20   |
| R3 d=0.9 unlisted viewer                           |        1 |         2 |     0 | 20   |
| R3 d=0.9 last rank count                           |        1 |     9,499 |     4 | 21   |
| R3 d=0.9 neighbours above                          |        3 |        10 |     1 | 21   |
| R3 d=0.9 neighbours below                          |        3 |        11 |     0 | 22   |
| R3 d=0.9 active (Should)                           |       20 |     1,644 |     5 | 23   |
| R3 d=0.1 page 1                                    |      101 |     1,101 |     1 | 17   |
| R3 d=0.1 deep page                                 |      101 |     1,112 |     1 | 18   |
| R3 d=0.1 deep page offset                          |        1 |     4,119 |     2 | 19   |
| R3 d=0.1 listed viewer                             |        1 |         2 |     0 | 20   |
| R3 d=0.1 unlisted viewer                           |        1 |         2 |     1 | 20   |
| R3 d=0.1 last rank count                           |        1 |     5,493 |    16 | 21   |
| R3 d=0.1 neighbours above                          |        3 |        37 |     0 | 21   |
| R3 d=0.1 neighbours below                          |        3 |        36 |     0 | 22   |
| R3 d=0.1 active (Should)                           |       20 |     1,644 |     2 | 23   |
| R3 d=0.1 index candidate page 1                    |      101 |     1,101 |     1 | 17   |
| R3 d=0.1 forced eligible_until (diagnostic)        |      101 |     1,500 |     2 | 24   |
| R3 d=0.1 index candidate deep page                 |      101 |     1,112 |     3 | 18   |
| R3 d=0.1 index candidate deep page offset          |        1 |     4,119 |     2 | 19   |
| R3 d=0.1 forced eligible_until offset (diagnostic) |        1 |       875 |     3 | 25   |
| R4 rated list all processed                        |       10 |        61 |     0 | 15   |
| R4 lifetime stats all processed                    |    5,000 |    15,001 |   125 | 16   |
| R5 rating window 90d all processed                 |    1,797 |     3,595 |     8 | 11   |
| R4 rated list friendly-heavy                       |       10 |    10,039 |    74 | 15   |
| R4 lifetime stats friendly-heavy                   |       10 |    10,011 |     5 | 16   |

## Query plans

Identical SQLite plan text shares one number. The script prints each statement name and its full plan after checking
key fixture results.

### Plan 1

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=?)
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
SEARCH op USING INDEX sqlite_autoindex_match_player_1 (match_id=? AND seat=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
```

### Plan 2

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=? AND (ended_at,match_id)<(?,?))
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
SEARCH op USING INDEX sqlite_autoindex_match_player_1 (match_id=? AND seat=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
```

### Plan 3

```text
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
SEARCH mp USING INDEX sqlite_autoindex_match_player_2 (match_id=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
```

### Plan 4

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=?)
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
SEARCH op USING INDEX sqlite_autoindex_match_player_1 (match_id=? AND seat=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
SEARCH mr USING INDEX sqlite_autoindex_match_rating_1 (match_id=?) LEFT-JOIN
```

### Plan 5

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=? AND (ended_at,match_id)<(?,?))
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
SEARCH op USING INDEX sqlite_autoindex_match_player_1 (match_id=? AND seat=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
SEARCH mr USING INDEX sqlite_autoindex_match_rating_1 (match_id=?) LEFT-JOIN
```

### Plan 6

```text
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
SEARCH mp USING INDEX sqlite_autoindex_match_player_2 (match_id=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
SEARCH mr USING INDEX sqlite_autoindex_match_rating_1 (match_id=?) LEFT-JOIN
```

### Plan 7

```text
SEARCH match_player USING INDEX match_player_owner_idx (user_id=?)
```

### Plan 8

```text
SEARCH v USING INDEX match_player_owner_idx (user_id=?)
SEARCH t USING INDEX sqlite_autoindex_match_player_2 (match_id=? AND user_id=?)
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
```

### Plan 9

```text
SEARCH player_rating USING INDEX sqlite_autoindex_player_rating_1 (user_id=?)
```

### Plan 10

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=? AND ended_at>?)
SEARCH r USING INDEX sqlite_autoindex_match_player_rating_1 (match_id=? AND seat=?)
```

### Plan 11

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=? AND ended_at>? AND ended_at<?)
SEARCH r USING INDEX sqlite_autoindex_match_player_rating_1 (match_id=? AND seat=?)
```

### Plan 12

```text
SEARCH match USING INTEGER PRIMARY KEY (rowid=?)
SCALAR SUBQUERY 1
SEARCH player_rating USING INDEX sqlite_autoindex_player_rating_1 (user_id=?)
```

### Plan 13

```text
SEARCH c USING INDEX sqlite_autoindex_username_claim_1 (username=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
```

### Plan 14

```text
SEARCH rating_processor_state USING INTEGER PRIMARY KEY (rowid=?)
```

### Plan 15

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=?)
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
SEARCH op USING INDEX sqlite_autoindex_match_player_1 (match_id=? AND seat=?)
SEARCH mr USING INDEX sqlite_autoindex_match_rating_1 (match_id=?) LEFT-JOIN
SEARCH r USING INDEX sqlite_autoindex_match_player_rating_1 (match_id=? AND seat=?) LEFT-JOIN
SEARCH rc USING COVERING INDEX sqlite_autoindex_rating_correction_mark_1 (match_id=?) LEFT-JOIN
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
```

### Plan 16

```text
SEARCH mp USING INDEX match_player_owner_idx (user_id=?)
SEARCH mr USING INDEX sqlite_autoindex_match_rating_1 (match_id=?)
SEARCH m USING INDEX sqlite_autoindex_match_1 (id=?)
```

### Plan 17

```text
SEARCH p USING INDEX player_rating_board_idx (excluded=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
```

### Plan 18

```text
SEARCH p USING INDEX player_rating_board_idx (excluded=? AND rating<?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
```

### Plan 19

```text
SEARCH p USING INDEX player_rating_board_idx (excluded=? AND rating>?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
```

### Plan 20

```text
SEARCH p USING INDEX sqlite_autoindex_player_rating_1 (user_id=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?) LEFT-JOIN
```

### Plan 21

```text
SEARCH self USING INDEX sqlite_autoindex_player_rating_1 (user_id=?)
CORRELATED SCALAR SUBQUERY 1
SEARCH su USING INDEX sqlite_autoindex_user_1 (id=?)
SEARCH p USING INDEX player_rating_board_idx (excluded=? AND rating>?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
```

### Plan 22

```text
SEARCH self USING INDEX sqlite_autoindex_player_rating_1 (user_id=?)
CORRELATED SCALAR SUBQUERY 1
SEARCH su USING INDEX sqlite_autoindex_user_1 (id=?)
SEARCH p USING INDEX player_rating_board_idx (excluded=? AND rating<?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
```

### Plan 23

```text
SEARCH m USING INDEX match_rated_ended_idx (rated=? AND ended_at>? AND ended_at<?)
SEARCH mr USING INDEX sqlite_autoindex_match_rating_1 (match_id=?)
SEARCH mp USING COVERING INDEX sqlite_autoindex_match_player_2 (match_id=?)
SEARCH p USING INDEX sqlite_autoindex_player_rating_1 (user_id=?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
USE TEMP B-TREE FOR GROUP BY
USE TEMP B-TREE FOR ORDER BY
```

### Plan 24

```text
SEARCH p USING INDEX evidence_eligible_until_idx (eligible_until>?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
USE TEMP B-TREE FOR ORDER BY
```

### Plan 25

```text
SEARCH p USING INDEX evidence_eligible_until_idx (eligible_until>?)
SEARCH u USING INDEX sqlite_autoindex_user_1 (id=?)
```
