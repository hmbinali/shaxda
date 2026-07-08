# BETA1 Rule-Correction Log

Use this file only for possible rule mismatches found during BETA1. The rules
source of truth remains `docs/shaxda_game.md`.

No rule behavior changes should be made from casual feedback alone.

## Confirmation Gate

A BETA1 rule correction is confirmed only when all of these are true:

- at least two experienced Somali players agree on the same correction;
- the product owner approves the correction;
- the evidence is recorded below;
- the correction is specific enough to update `docs/shaxda_game.md` and tests.

If the gate is not met, classify the item as `needs-more-evidence`, `deferred`,
or `rejected`.

## Correction Candidates

| ID  | Feedback item IDs | Rule area | Current documented rule | Proposed correction | Player evidence | Product-owner approval | Status |
| --- | ----------------- | --------- | ----------------------- | ------------------- | --------------- | ---------------------- | ------ |
| R1  |                   |           |                         |                     |                 |                        | new    |
| R2  |                   |           |                         |                     |                 |                        | new    |
| R3  |                   |           |                         |                     |                 |                        | new    |
| R4  |                   |           |                         |                     |                 |                        | new    |
| R5  |                   |           |                         |                     |                 |                        | new    |

Suggested rule areas:

- placement;
- first advantage;
- initial removal;
- movement;
- jare;
- repeated jare;
- irmaan;
- blocked player;
- draw;
- win;
- resignation.

## Approved Correction Cycle

Only one BETA1 rule-correction cycle is planned. Start this section only after a
candidate meets the confirmation gate.

- Approved correction ID:
- Product-owner approver:
- Approval date:
- Summary:

Implementation order:

1. Update `docs/shaxda_game.md`.
2. Add or update focused `packages/game-engine` tests.
3. Update shared fixtures only if canonical states change.
4. Update local or online tests only where visible behavior changes.
5. Run the relevant checks listed below.

Required checks for a confirmed rule correction:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:worker` if online/server behavior is affected
- `pnpm test:e2e` if visible gameplay flow changes
- `pnpm build`

## Deferred Or Rejected Rule Feedback

| ID  | Candidate ID | Decision | Reason | Follow-up |
| --- | ------------ | -------- | ------ | --------- |
|     |              |          |        |           |

## Closeout

- Correction cycle used: no
- `docs/shaxda_game.md` updated:
- Engine tests updated:
- Shared fixtures updated:
- Local/online tests updated:
- Checks completed:
- Remaining post-beta rule questions:
