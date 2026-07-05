---
name: cloudflare-do-hibernation
description: Correct Cloudflare Durable Object WebSocket pattern for Shaxda match rooms. Use when editing Workers, Durable Objects, WebSockets, online rooms, reconnect, cleanup, claim-win, D1 persistence, or cost-control code.
---

# Cloudflare Durable Object Hibernation Skill

## Why This Matters

Read `docs/shaxda_prd.md` before editing online infrastructure.

Shaxda online matches are cheap only if match Durable Objects hibernate while idle.

Getting this wrong can turn tiny turn-based games into wall-clock billed rooms and create a ~1000× cost swing.

## Required Pattern

For match Durable Objects:

- use WebSocket Hibernation API;
- use `ctx.acceptWebSocket(...)`;
- do not use normal WebSocket `accept()`;
- do not use `setInterval`;
- avoid `setTimeout` for lifecycle;
- use Durable Object alarms for cleanup;
- persist enough state for reconnect;
- validate all messages with Zod;
- validate all moves with `packages/game-engine`;
- keep online play server-authoritative.

## Active Match State

Store active match state in the Durable Object:

- engine state;
- player slots;
- socket/session metadata;
- reconnect state;
- disconnect grace state;
- claim-win state;
- cleanup alarm timing.

## D1 Rules

Do not write every move to D1.

D1 stores:

- users;
- profiles;
- completed logged-in match summary;
- compact replay as one serialized field;
- leaderboard data;
- small analytics summaries.

Guest games write nothing permanent by default.

## Cleanup Rules

- Use DO alarms for abandoned room cleanup.
- Empty/abandoned casual rooms expire after around 1 hour.
- If a player disconnects and does not return after a few minutes, opponent can claim win.
- This is housekeeping, not a visible chess clock.

## Required Tests / Review Checks

For online room work, add or verify:

- create room;
- join room;
- two players sync;
- illegal move rejection;
- reconnect after refresh;
- reconnect after temporary disconnect;
- claim-win after grace period;
- cleanup alarm;
- no per-move D1 rows;
- no `setInterval`;
- no normal WebSocket `accept()`;
- idle-room hibernation behavior where testable.

## Red Flags

Stop and fix if you see:

- `webSocket.accept()` in match-room code;
- `setInterval` in match-room code;
- D1 insert per move;
- duplicated rule logic instead of using `game-engine`;
- unvalidated WebSocket messages;
- guest match history being stored permanently.
