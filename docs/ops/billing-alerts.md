# O3 Abuse and Cost Checklist

Phase 3 O3 protects guest online rooms before launch. Local development remains
free: unset `TURNSTILE_SECRET` bypasses Turnstile, and Miniflare tests cover the
coordinator Durable Object without remote Cloudflare resources.

## Required Launch Checks

- Create Cloudflare billing alerts before P1 launch.
- Watch Workers requests, errors, CPU time, and Durable Object wall-clock metrics.
- Confirm MatchRoom uses WebSocket hibernation via `ctx.acceptWebSocket(...)`.
- Confirm normal WebSocket `.accept()`, `setInterval`, and Durable Object
  lifecycle `setTimeout` remain blocked by `pnpm check:hibernation`.
- Set Turnstile secret with `wrangler secret put TURNSTILE_SECRET`.
- Configure `PUBLIC_TURNSTILE_SITE_KEY` for the web deployment.

## O3 Limits

- Room creation is coordinated by the global `RoomCoordinator` Durable Object.
- Per-IP create window: `CREATE_WINDOW_MS`.
- Per-IP active room cap: `ACTIVE_MAX_PER_IP`.
- Global active room cap: `ACTIVE_MAX_GLOBAL`.
- WebSocket message size cap: `MAX_MESSAGE_BYTES`.
- WebSocket per-connection message window: `MESSAGE_RATE_WINDOW_MS`.

Tune these constants only after reviewing local worker tests and expected launch
traffic. Guest games do not write permanent match history in V1.0.

## Zod and Request Audit

- Public room codes are exactly 8 characters from
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `POST /rooms` validates its optional Turnstile payload.
- Coordinator reserve/release payloads are Zod validated.
- MatchRoom init payloads and all WebSocket room messages are Zod validated.
- Oversized WebSocket frames are rejected before JSON parsing.

## Hibernation Audit

- Match rooms use one Durable Object per room.
- WebSocket upgrades use `ctx.acceptWebSocket(...)`.
- Match lifecycle cleanup uses Durable Object alarms.
- Room expiration releases the coordinator reservation before deleting room
  storage.
- Coordinator pruning uses Durable Object alarms only.
