import {
  avatarColorForUserId,
  avatarInitial,
  avatarModeSchema,
  normalizeUsername,
  validateUsername,
  USERNAME_CHANGE_COOLDOWN_MS,
  type AvatarMode,
} from "@shaxda/shared";

export type ClaimUsernameOutcome =
  | { kind: "claimed" }
  | { kind: "alreadyComplete" }
  | { kind: "taken" }
  | { kind: "missing" };

export type ChangeUsernameOutcome =
  | { kind: "changed" }
  | { kind: "missing" }
  | { kind: "incomplete" }
  | { kind: "unchanged" }
  | { kind: "cooldown"; nextEligibleAt: Date }
  | { kind: "taken" };

export type PublicProfile = {
  username: string;
  avatarMode: AvatarMode;
  imageUrl: string | null;
  avatarColor: string;
  initial: string;
};

export type ResolveProfileOutcome =
  | { kind: "current"; profile: PublicProfile }
  | { kind: "alias"; currentUsername: string }
  | { kind: "missing" };

type UserAccountRow = {
  id: string;
  username: string | null;
  username_changed_at: number | null;
};

const claimEligibility = `EXISTS (
  SELECT 1 FROM user u
  WHERE u.id = ?1
    AND u.username IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM username_claim c WHERE c.username = ?2
    )
)`;

const changeEligibility = `EXISTS (
  SELECT 1 FROM user u
  WHERE u.id = ?1
    AND u.username IS NOT NULL
    AND u.username <> ?2
    AND (u.username_changed_at IS NULL OR u.username_changed_at <= ?3)
    AND NOT EXISTS (
      SELECT 1 FROM username_claim c
      WHERE c.username = ?2 AND c.user_id <> ?1
    )
)`;

function requireUsername(value: string): string {
  const result = validateUsername(value);
  if (!result.ok) {
    throw new TypeError(`Invalid username: ${result.reason}`);
  }
  return result.username;
}

function requireAvatarMode(value: string): AvatarMode {
  return avatarModeSchema.parse(value);
}

export async function claimUsername(
  db: D1Database,
  userId: string,
  value: string,
  avatarMode: AvatarMode,
  now = new Date(),
): Promise<ClaimUsernameOutcome> {
  const username = requireUsername(value);
  const mode = requireAvatarMode(avatarMode);
  const timestamp = now.getTime();
  const bindings = [userId, username, timestamp] as const;

  let results: D1Result[];
  try {
    results = await db.batch([
      db
        .prepare(
          `INSERT INTO username_claim (username, user_id, claimed_at, released_at)
           SELECT ?2, ?1, ?3, NULL WHERE ${claimEligibility}`,
        )
        .bind(...bindings),
      db
        .prepare(
          `UPDATE user
           SET username = ?2,
               name = ?2,
               avatar_mode = ?4,
               username_changed_at = ?3,
               updated_at = ?3
           WHERE id = ?1
             AND username IS NULL
             AND EXISTS (
               SELECT 1 FROM username_claim c
               WHERE c.username = ?2
                 AND c.user_id = ?1
                 AND c.claimed_at = ?3
                 AND c.released_at IS NULL
             )
           RETURNING id`,
        )
        .bind(userId, username, timestamp, mode),
    ]);
  } catch (error) {
    const state = await readUserAndClaim(db, userId, username);
    if (state.user === null) return { kind: "missing" };
    if (state.user.username !== null) return { kind: "alreadyComplete" };
    if (state.claim !== null && state.claim.user_id !== userId) {
      return { kind: "taken" };
    }
    throw error;
  }

  if ((results[1]?.results.length ?? 0) > 0) {
    return { kind: "claimed" };
  }

  const state = await readUserAndClaim(db, userId, username);
  if (state.user === null) return { kind: "missing" };
  if (state.user.username !== null) return { kind: "alreadyComplete" };
  return { kind: "taken" };
}

export async function changeUsername(
  db: D1Database,
  userId: string,
  value: string,
  now = new Date(),
): Promise<ChangeUsernameOutcome> {
  const username = requireUsername(value);
  const timestamp = now.getTime();
  const cutoff = timestamp - USERNAME_CHANGE_COOLDOWN_MS;
  const bindings = [userId, username, cutoff, timestamp] as const;

  try {
    const results = await db.batch([
      db
        .prepare(
          `DELETE FROM username_claim
           WHERE username = ?2
             AND user_id = ?1
             AND released_at IS NOT NULL
             AND ${changeEligibility}`,
        )
        .bind(userId, username, cutoff),
      db
        .prepare(
          `UPDATE username_claim
           SET released_at = ?4
           WHERE user_id = ?1
             AND released_at IS NULL
             AND username = (SELECT username FROM user WHERE id = ?1)
             AND ${changeEligibility}`,
        )
        .bind(...bindings),
      db
        .prepare(
          `INSERT INTO username_claim (username, user_id, claimed_at, released_at)
           SELECT ?2, ?1, ?4, NULL WHERE ${changeEligibility}`,
        )
        .bind(...bindings),
      db
        .prepare(
          `UPDATE user
           SET username = ?2,
               name = ?2,
               username_changed_at = ?4,
               updated_at = ?4
           WHERE id = ?1 AND ${changeEligibility}
           RETURNING id`,
        )
        .bind(...bindings),
    ]);

    if ((results[3]?.results.length ?? 0) > 0) {
      return { kind: "changed" };
    }
  } catch (error) {
    const outcome = await classifyChange(db, userId, username, now);
    if (outcome !== null) return outcome;
    throw error;
  }

  return (await classifyChange(db, userId, username, now)) ?? { kind: "taken" };
}

export async function setAvatarMode(
  db: D1Database,
  userId: string,
  value: AvatarMode,
  now = new Date(),
): Promise<{ kind: "updated" } | { kind: "missing" }> {
  const mode = requireAvatarMode(value);
  const result = await db
    .prepare(
      `UPDATE user SET avatar_mode = ?2, updated_at = ?3
       WHERE id = ?1 AND username IS NOT NULL RETURNING id`,
    )
    .bind(userId, mode, now.getTime())
    .all();
  return result.results.length > 0 ? { kind: "updated" } : { kind: "missing" };
}

export async function isUsernameAvailable(
  db: D1Database,
  value: string,
): Promise<boolean> {
  const validation = validateUsername(value);
  if (!validation.ok) return false;
  const claim = await db
    .prepare("SELECT username FROM username_claim WHERE username = ?1 LIMIT 1")
    .bind(validation.username)
    .first();
  return claim === null;
}

export async function resolveProfile(
  db: D1Database,
  value: string,
): Promise<ResolveProfileOutcome> {
  const username = normalizeUsername(value);
  const validation = validateUsername(username);
  if (!validation.ok) return { kind: "missing" };

  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.image, u.avatar_mode, c.released_at
       FROM username_claim c
       JOIN user u ON u.id = c.user_id
       WHERE c.username = ?1
       LIMIT 1`,
    )
    .bind(username)
    .first<{
      id: string;
      username: string;
      image: string | null;
      avatar_mode: string;
      released_at: number | null;
    }>();

  if (row === null) return { kind: "missing" };
  if (row.released_at !== null || row.username !== username) {
    return { kind: "alias", currentUsername: row.username };
  }

  const avatarMode = avatarModeSchema.catch("initial").parse(row.avatar_mode);
  return {
    kind: "current",
    profile: {
      username: row.username,
      avatarMode,
      imageUrl: avatarMode === "google" ? row.image : null,
      avatarColor: avatarColorForUserId(row.id),
      initial: avatarInitial(row.username),
    },
  };
}

async function readUserAndClaim(
  db: D1Database,
  userId: string,
  username: string,
): Promise<{
  user: UserAccountRow | null;
  claim: { user_id: string } | null;
}> {
  const [userResult, claimResult] = await db.batch([
    db
      .prepare(
        "SELECT id, username, username_changed_at FROM user WHERE id = ?1 LIMIT 1",
      )
      .bind(userId),
    db
      .prepare("SELECT user_id FROM username_claim WHERE username = ?1 LIMIT 1")
      .bind(username),
  ]);
  return {
    user: (userResult?.results[0] as UserAccountRow | undefined) ?? null,
    claim: (claimResult?.results[0] as { user_id: string } | undefined) ?? null,
  };
}

async function classifyChange(
  db: D1Database,
  userId: string,
  username: string,
  now: Date,
): Promise<Exclude<ChangeUsernameOutcome, { kind: "changed" }> | null> {
  const state = await readUserAndClaim(db, userId, username);
  if (state.user === null) return { kind: "missing" };
  if (state.user.username === null) return { kind: "incomplete" };
  if (state.user.username === username) return { kind: "unchanged" };
  if (
    state.user.username_changed_at !== null &&
    state.user.username_changed_at + USERNAME_CHANGE_COOLDOWN_MS > now.getTime()
  ) {
    return {
      kind: "cooldown",
      nextEligibleAt: new Date(
        state.user.username_changed_at + USERNAME_CHANGE_COOLDOWN_MS,
      ),
    };
  }
  if (state.claim !== null && state.claim.user_id !== userId) {
    return { kind: "taken" };
  }
  return null;
}
