# BETA1 Community Beta Plan

BETA1 validates real-world Somali play tradition before public launch. It is a
community beta and feedback-processing milestone, not a feature-build phase.

`BETA1` belongs to Phase 4 after `Q1` in `docs/shaxda_prd.md`. Phase 3 is the
online guest play track (`O1`, `O2`, and `O3`). Do not use BETA1 to finish
online resilience, Q1 QA, production launch, or V1.1 features.

## Readiness Gate

BETA1 is blocked until `docs/qa/q1-report.md` has a clear `Ready for BETA1`
sign-off.

Readiness tracking:

- `docs/qa/q1-report.md` exists:
- `Ready for BETA1` is signed off:
- Tested commit recorded:
- Preview or staging URL recorded:

When Q1 is signed off, record:

- preview or staging URL:
- tested commit:
- beta coordinator:
- start date:
- end date:

Use a preview or staging URL for tester sessions. Do not use BETA1 as the P1
production launch.

## Tester Profile

Recruit 10-20 Somali testers.

Prioritize:

- players who learned Shaxda physically;
- players who can identify local rule differences;
- mobile-first users;
- at least two testers who can validate jare, repeated jare, irmaan, blocked
  player handling, and draw expectations.

Do not require accounts or permanent usernames. V1.0 uses guest display names
only.

## Session Script

Each tester session should cover the following V1.0 surfaces:

1. Open `/`, `/learn`, and `/rules`.
2. Confirm content is Somali-only and does not show English UI, language toggle,
   accounts, leaderboard, chat, tournaments, ads, sponsors, or payment UI.
3. Start `/local` and play through placement.
4. Continue into initial removal, movement, jare, and capture if the tester can
   reach those states naturally.
5. Create or join an `/online` room using a guest display name.
6. Share or open the invite link/code from a second browser or device.
7. Make at least one online action and confirm both players see the same board.
8. Refresh one online player and confirm reconnect behavior.
9. On a mobile device, check touch target comfort, board fit, and absence of
   horizontal scrolling.
10. If PWA install is available, install the app and confirm local mode opens
    offline after the app shell is cached.

Record results in `docs/qa/beta1-feedback-log.md`.

## Feedback Triage

Classify every item with one of these categories:

- `rules-candidate`: possible mismatch with physical Shaxda tradition.
- `bug`: implemented behavior is broken or inconsistent with the source docs.
- `copy`: Somali wording, clarity, tone, or terminology feedback.
- `ux`: usability, mobile, invite, install, or accessibility friction.
- `out-of-scope-v1.1`: accounts, English/i18n, history, leaderboard, replay,
  chat, spectating, tournaments, monetization, or other post-V1.0 requests.
- `no-action`: recorded feedback that does not require product or code changes.

Use severity only after classifying:

- `blocker`: prevents meaningful beta testing or launch confidence.
- `major`: important, but beta can continue.
- `minor`: polish or clarification.
- `question`: needs more evidence before a decision.

## Rule-Correction Policy

Casual feedback does not directly change rules. Confirmed rule corrections must
follow `docs/qa/beta1-rule-corrections.md`.

A correction is confirmed only when:

- at least two experienced Somali players agree on the same correction;
- the product owner approves it;
- the evidence and decision are recorded in the rule-correction log.

If confirmed, apply exactly one BETA1 rule-correction cycle:

1. Update `docs/shaxda_game.md` first.
2. Add or update focused `packages/game-engine` tests.
3. Update shared fixtures only if canonical states change.
4. Update local or online tests only where visible behavior changes.

Additional disputed rule feedback becomes post-beta follow-up unless it blocks
launch confidence.

## Success Criteria

BETA1 is successful when:

- 10-20 tester sessions are logged;
- local/offline feedback is captured;
- online invite feedback is captured;
- rule feedback from physical players is either resolved or explicitly deferred;
- no V1.1 feature request is allowed to block V1.0 launch;
- any confirmed rule correction follows the documented approval gate;
- launch-blocking issues are converted into focused follow-up tasks.

## Maintainer Checks

For BETA1 documentation-only changes:

- review markdown for clarity and scope correctness;
- confirm referenced files exist;
- run Prettier against the BETA1 markdown files.

If a confirmed rule correction changes code or tests, use the checks listed in
`docs/qa/beta1-rule-corrections.md`.

## Out Of Scope

Do not add these during BETA1:

- accounts;
- Google login;
- match history;
- leaderboard;
- replay viewer;
- English UI, `/en` routes, or a language toggle;
- chat;
- spectating;
- tournaments;
- ads, sponsors, payments, affiliate links, or monetization placeholders;
- production Cloudflare launch work.
