# Authenticated Online Identity

V1.1-A2 lets a complete Shaxda account own a seat in an active online room while
preserving the guest flow. It does not add match persistence, history, replay,
ratings, or leaderboards.

## Trust boundary

The SvelteKit web Worker is the only service that validates Better Auth sessions
and reads account D1 data. `/api/online/identity` returns public-safe account
status and mints a short-lived HMAC-SHA-256 ticket. The game Worker receives no
cookie and has no Better Auth or D1 dependency; it only verifies the ticket with
the shared secret.

Tickets last 90 seconds, allow five seconds of clock skew, are scoped to exactly
one of `create`, `join`, or `reconnect`, and bind join/reconnect to one room code.
They carry the permanent internal user id, the current username/avatar snapshot,
and a random JTI. They never carry email, Google full name, provider identity,
OAuth tokens, session tokens, or cookies. Raw tickets are held in browser memory
only and are never stored or logged by a Durable Object.

## Seat ownership and display

Guest seats use `guest:<guestId>` as their private room key. Account seats use
`account:<userId>`. Prefixes are always added by the server, so attacker-chosen
guest ids cannot collide with account keys. The permanent user id is used only
for ownership and avatar-color derivation and is never broadcast.

The username is a display snapshot captured when the account first claims the
seat. Renaming the account during a match does not change its label or ownership;
a new room captures the new username. Rejoining may refresh the selected avatar,
but keeps the username snapshot. Player presence broadcasts `displayName` for old
clients plus optional `kind`, `username`, and `avatar` fields for new clients.

## Join and reconnect

| Ticket action | Room state                       | Outcome                                                                       |
| ------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `join`        | no seat for the account          | Claim the first empty seat.                                                   |
| `join`        | same account already owns a seat | Reattach and replace its older socket.                                        |
| `join`        | both seats belong to others      | Return `roomFull`.                                                            |
| `reconnect`   | same account owns a seat         | Reattach and replace its older socket.                                        |
| `reconnect`   | no committed seat                | Return `identityScope`; the client may mint one `join` ticket and retry once. |

Each accepted account connection increments a seat epoch. A replaced socket is
closed with code 4001 and immediately loses permission to move, claim a win,
echo, count as connected, or receive broadcasts. Guest duplicate-socket behavior
is unchanged; guest authorization intentionally does not enforce epochs so
pre-deploy hibernated guest sockets remain compatible.

Accepted join/reconnect JTIs are retained per seat until expiry. The list is
bounded at 16 entries. After expired entries are pruned, a duplicate returns
`identityReplayed`; a still-full list returns `rateLimited` instead of evicting a
live replay marker.

## Errors and client behavior

| Worker result                                | Wire code             | Client behavior                                             |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| malformed, bad signature, or invalid payload | `identityInvalid`     | Show a Somali error and close without reconnecting.         |
| expired, future-issued, or overlong lifetime | `identityExpired`     | Show expiry guidance and close.                             |
| wrong action or room                         | `identityScope`       | Close, except for the one reconnect-to-join fallback above. |
| reused JTI                                   | `identityReplayed`    | Close without reconnecting.                                 |
| ticket supplied but secret missing           | `identityUnavailable` | Fail closed and close.                                      |
| replay list remains at 16                    | `rateLimited`         | Reject and close.                                           |

A supplied ticket never falls back to guest identity. When account status cannot
be fetched, `/online` requires an explicit **Ku sii wad marti ahaan** choice. An
incomplete account may continue as a guest or follow the registration link. Login
and registration return paths use the existing server-side `safeInternalPath`
validation, so room links survive auth and external return URLs are rejected.

## Deploy compatibility

The protocol remains version 1 and all identity fields are additive. Stored rooms
without `seatVersion: 2` are normalized to guest seats in memory; legacy socket
attachments derive `guest:<guestId>` when `identityKey` is missing. The next
authoritative mutation persists the normalized room. Identity state lives only in
Durable Object storage and socket attachments, so hibernation or instance rebuild
does not lose it.
