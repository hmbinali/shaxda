# E5 rating simulation

Run on the Shaxda `7c91b50` baseline on 2026-11-14 with Node 24.18.0.
From the repository root:

```sh
node docs/specs/evidence/e5.mjs > /tmp/shaxda-e5.json
```

The simulation runs for 180 days at populations of 20, 50, 100, and 300,
with the same 32 Mulberry32 seeds (20261114–20261145) per population and
attendance scenario. Each account has a 12%, 25%, or 50% independent daily
chance of attending. The fixture shuffles attendees into pairs and drops
the last attendee when the count is odd. Each pair plays three rated
games that evening. Ordinary skill is triangular over 1300–1700, with one
1850-skill player on the same attendance schedule. A logistic model with
a 400-point scale generates results, with a draw probability of up to 10%.
All accounts have current usernames and no exclusions.

The two farming accounts have ordinary skill 1500 and play their
ordinary schedules. In a weekly evening burst on days 14 through 84, one
donor loses all 12 games to the beneficiary. The three runs per seed replay
the same generated ledger with the cap and no farming (control), with the
cap and farming, or with farming and no cap. The cap uses processed games
in the preceding 24 hours for the unordered pair, including any ordinary
games in that window. End time and ingestion order agree in these traces.

The fixture implements [Glickman's March 2022 Glicko-2 paper](https://www.glicko.net/glicko/glicko2.pdf)
and checks its example plus the cap, inactivity, RD, game-count, and
90-day boundaries. Each processed match is one rating period. Both seats
use the pre-event state, grown by P18's empty-day rule. These cohorts
measure outcomes under the stated attendance model. Launch attendance, multi-account farming, and processor behavior require
separate evidence.

## Provisional and eligibility

With the cap and farming enabled, exit is the first post-game RD ≤ 110,
timed from each honest player's first processed game. Exit quantiles are
conditional on reaching that first crossing by day 180. Honest players
include the 1850-skill player and exclude both farming accounts.
Eligibility is the mean share of the whole population at each snapshot,
including the farming accounts and accounting for inactivity after a
player first leaves provisional. The JSON output also reports the no-farm
and no-cap eligibility series and empty-board counts.

| Players | Attendance | Crossed by day 180 | Exit days p10 / p50 / p90 | Games to exit p10 / p50 / p90 | Eligible day 15 / 30 / 60 / 90 / 180 (%) |
| ------- | ---------- | -----------------: | ------------------------- | ----------------------------- | ---------------------------------------- |
| 20      | sparse     |            570/576 | 29.08 / 53.04 / 99.08     | 15 / 19 / 24                  | 0 / 6.09 / 38.75 / 67.34 / 91.72         |
| 20      | regular    |            576/576 | 11.08 / 22.04 / 37.08     | 14 / 17 / 21                  | 11.72 / 64.84 / 98.13 / 99.69 / 99.84    |
| 20      | busy       |            576/576 | 6.08 / 10 / 15.04         | 14 / 17 / 20                  | 82.97 / 99.38 / 100 / 100 / 100          |
| 50      | sparse     |          1535/1536 | 24.08 / 46.08 / 82.08     | 15 / 18 / 23                  | 0.19 / 7.75 / 52.81 / 80.19 / 97.06      |
| 50      | regular    |          1536/1536 | 11.08 / 20.04 / 34.04     | 14 / 17 / 21                  | 11.81 / 72.06 / 99.38 / 99.88 / 100      |
| 50      | busy       |          1536/1536 | 6.04 / 10 / 15            | 14 / 16 / 20                  | 84.63 / 99.94 / 100 / 100 / 100          |
| 100     | sparse     |          3130/3136 | 23.04 / 43.04 / 76.08     | 15 / 18 / 22                  | 0.19 / 9.84 / 57.06 / 85.34 / 97.53      |
| 100     | regular    |          3136/3136 | 11.08 / 19.08 / 32.04     | 14 / 17 / 20                  | 11.91 / 76.31 / 99.16 / 100 / 100        |
| 100     | busy       |          3136/3136 | 6.04 / 9.08 / 14.08       | 14 / 16 / 19                  | 86 / 99.97 / 100 / 100 / 100             |
| 300     | sparse     |          9531/9536 | 22.04 / 41.08 / 72        | 15 / 18 / 22                  | 0.31 / 9.83 / 61.06 / 88.81 / 98.88      |
| 300     | regular    |          9536/9536 | 11.04 / 19 / 31.04        | 14 / 17 / 20                  | 13.25 / 77.57 / 99.67 / 99.97 / 99.99    |
| 300     | busy       |          9536/9536 | 6.04 / 9.08 / 14.04       | 14 / 16 / 19                  | 85.96 / 99.98 / 100 / 100 / 100          |

The 20-player sparse board was empty in 32/32 capped seeds on day 15
and 12/32 on day 30 (17/32 in the no-farm control on day 30). In sparse
populations, the strong player was listed in 7–14 of 32 seeds on day 90
despite a median rating of 1828–1842. One schedule with enough games for
an ordinary player can still leave a strong player provisional.

## Farming

Day 90 is the first main snapshot after the last burst. Gains are paired
differences from the corresponding no-farm run at the same time. The
control includes the cap during ordinary play. Farmer-above-strong counts
require both to be eligible and compare full-precision ratings.

| Players | Attendance | Day 90 gain with cap p10 / p50 / p90 | Day 90 gain without cap p10 / p50 / p90 | Farmer listed, cap / no cap (of 32) | Farmer above strong, cap / no cap (of 32) |
| ------- | ---------- | ------------------------------------ | --------------------------------------- | ----------------------------------- | ----------------------------------------- |
| 20      | sparse     | 106.39 / 169.77 / 306.6              | 173.6 / 265.77 / 423.8                  | 30 / 27                             | 1 / 1                                     |
| 20      | regular    | 76.48 / 115.18 / 156.95              | 145.23 / 199.99 / 267.46                | 32 / 32                             | 0 / 4                                     |
| 20      | busy       | 48.71 / 65.97 / 84.35                | 109.67 / 140.74 / 173.49                | 32 / 32                             | 0 / 0                                     |
| 50      | sparse     | 102.66 / 169.18 / 257.55             | 177.98 / 258.94 / 385.04                | 32 / 31                             | 2 / 4                                     |
| 50      | regular    | 75.26 / 101.59 / 133.77              | 149.28 / 185.13 / 244.28                | 32 / 32                             | 0 / 0                                     |
| 50      | busy       | 55.04 / 64.19 / 84.89                | 106.27 / 131.84 / 158.15                | 32 / 32                             | 0 / 0                                     |
| 100     | sparse     | 123.75 / 163.17 / 228.76             | 203.28 / 261.92 / 358.24                | 30 / 29                             | 1 / 3                                     |
| 100     | regular    | 78.76 / 101.77 / 144.32              | 140.76 / 183.25 / 261.39                | 32 / 32                             | 0 / 1                                     |
| 100     | busy       | 48.39 / 66.11 / 79.91                | 102.09 / 138.56 / 163.13                | 32 / 32                             | 0 / 0                                     |
| 300     | sparse     | 88.83 / 143.27 / 204.9               | 152.78 / 239.77 / 320.92                | 32 / 32                             | 2 / 3                                     |
| 300     | regular    | 81.06 / 106.98 / 148.52              | 139 / 189.9 / 242.68                    | 32 / 32                             | 0 / 0                                     |
| 300     | busy       | 50.52 / 64.43 / 90.91                | 102.02 / 132.01 / 176.46                | 32 / 32                             | 0 / 0                                     |

The cap processed a median 33 of 132 staged games in every scenario (p10
of 30–33). It reduced the median day-90 farming gain by 68–99 points
across scenarios. In sparse play the capped beneficiary still gained a
median 143–170 points and outranked the listed strong player in 1–2 of
32 seeds per population. By day 180, after 95 days of ordinary play,
median capped gains were 27–37 points in sparse play, 7–8 in regular play,
and about 1 in busy play. The trace assumes no R6 intervention.
