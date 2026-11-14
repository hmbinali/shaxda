# E6 indexed rank snapshot

Local evidence against `dd10db6`, using Node 24.18.0, pnpm 9.15.4,
Wrangler 4.107.0, Miniflare 4.20260701.0, and workerd 1.20260701.1.
The fixture reuses E6's 5,000 rating rows, fixed `asOf`, four-way rating
ties, and neutral or excluded accounts. Run from the repository root
with the lockfile installed and Node from `.nvmrc`.

```sh
node docs/specs/evidence/e6.mjs --rank-only > /tmp/shaxda-e6-rank.json
node docs/specs/evidence/e6.mjs --rank-snapshot > /tmp/shaxda-e6-full.json
```

The first command runs the snapshot cases in disposable local D1.
The second also seeds the 25,000-match ledger and runs the existing 75
[E6 checks](e6-results.md). Captured metadata counts the entire D1 read
batch, including snapshot state and maintenance. Publication costs are
reported separately.

## Exact ranks and rows read

Both densities passed the 2,000-row and 100 ms local page budgets. Each
listed row was matched against the frozen live order in a full traversal.
The cursor cases compare the full ordered result and exact ranks against the
live oracle. Standing and the R4 lookup agree even at the last rank.
A deliberately failed publish batch retained the prior generation.

| Operation                     | 4,496 listed of 5,000 | 500 listed of 5,000 |
| ----------------------------- | --------------------: | ------------------: |
| page 1                        |                   204 |                 204 |
| page 2                        |                   206 |                 206 |
| 75% depth                     |                   206 |                 206 |
| edited key inside tie         |                   206 |                 205 |
| edited maximum key inside tie |                   205 |                 205 |
| edited rating between groups  |                   205 |                 205 |
| edited above leaders          |                   205 |                 205 |
| edited below tail             |                     3 |                   3 |
| past last                     |                     3 |                   3 |
| standing middle               |                    22 |                  22 |
| standing last                 |                    15 |                  15 |
| standing unlisted             |                     4 |                   4 |
| R4 profile rank last          |                     3 |                   3 |

The first page searches the rank primary key. A cursor page adds a
tuple-range search on `evidence_rank_cursor_idx (sort_rating, board_key)`
and uses its first row's rank as the lower bound. Standing seeks the
unique user key and walks a rank primary-key range for neighbours. Public
identity uses `user.id`. Every measured rank plan used key or index
searches with no temporary ordering. Full plans and per-statement D1
metadata are in the JSON output.

## Freshness and write cost

The test advances a logical clock across a tenth rated game and a time
exit exactly at `eligible_until`. The two changes share one deadline. It applies a simulated R1 source update
and dirty mark in the same D1 batch, then executes and times a real atomic
replacement. The cache model includes the latest refill before the
publication commit. The 15-second allowance for match completion, save
and rating processing is a proposed healthy-path budget.

| Metric                                                 | 4,496 listed | 500 listed |
| ------------------------------------------------------ | -----------: | ---------: |
| Rebuild D1 rows read                                   |       27,479 |      7,502 |
| Rebuild D1 rows written                                |       17,981 |      2,001 |
| Local publication wall time (ms)                       |          705 |        379 |
| Modeled change-to-visible with warm cache (ms)         |       35,704 |     35,378 |
| Modeled completion-to-visible with 15 s allowance (ms) |       50,704 |     50,378 |
| Completion-to-visible policy envelope (ms)             |       55,000 |     55,000 |

After a simulated exclusion and deletion request, the origin policy
rejects the invalidated generation and the rebuilt board removes both
players, with contiguous ranks. A missed refresh stops serving the
overdue view. The fixture also checks clipping TTL near that deadline.
Production scheduling, CDN cache behavior, and the time from a real
game completion to the R1 commit remain preview checks.

A dense rebuild is expensive even though rank reads are bounded. Five
dense replacements use about 90,000 row writes before the rest of
Shaxda's workload. Cloudflare currently documents a 100,000-row daily
write allocation for D1 on the free plan. The draft carries the
publication cost into preview and release checks. [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

[Draft contract change](r3-rank-snapshot-contract-draft.md)
