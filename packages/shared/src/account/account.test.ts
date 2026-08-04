import { describe, expect, it } from "vitest";
import {
  AVATAR_PALETTE,
  RESERVED_USERNAMES,
  USERNAME_CHANGE_COOLDOWN_MS,
  avatarColorForUserId,
  avatarInitial,
  avatarModeSchema,
  canChangeUsername,
  isNormalizedUsername,
  nextUsernameChangeAt,
  normalizeUsername,
  suggestUsernames,
  usernameSchema,
  validateUsername,
} from "./index";

describe("account username rules", () => {
  it("keeps every protected name from the account design", () => {
    expect([...RESERVED_USERNAMES]).toEqual([
      "admin",
      "administrator",
      "mod",
      "moderator",
      "support",
      "shaxda",
      "account",
      "accounts",
      "login",
      "register",
      "api",
      "help",
      "legal",
      "learn",
      "local",
      "online",
      "settings",
      "profile",
      "user",
      "users",
      "system",
      "official",
    ]);
  });

  it.each([
    [" Mahamed_7 ", { ok: true, username: "mahamed_7" }],
    ["ab", { ok: false, username: "ab", reason: "tooShort" }],
    [
      "a".repeat(21),
      { ok: false, username: "a".repeat(21), reason: "tooLong" },
    ],
    ["magac-qof", { ok: false, username: "magac-qof", reason: "invalidChars" }],
    ["SHAXDA", { ok: false, username: "shaxda", reason: "reserved" }],
  ] as const)("validates %s", (value, expected) => {
    expect(validateUsername(value)).toEqual(expected);
  });

  it("keeps schema validation separate from reserved-name policy", () => {
    expect(normalizeUsername(" User_Name ")).toBe("user_name");
    expect(usernameSchema.safeParse("user_name").success).toBe(true);
    expect(usernameSchema.safeParse("User-Name").success).toBe(false);
  });

  it.each([
    ["mahamed_7", true],
    ["", false],
    ["ab", false],
    // validateUsername normalizes first and accepts these; a form control that
    // mirrors the input's `pattern` must not.
    ["Mahamed", false],
    [" mahamed ", false],
    ["magac-qof", false],
    ["admin", false],
  ] as const)("treats %j as already-normalized: %s", (value, expected) => {
    expect(isNormalizedUsername(value)).toBe(expected);
  });
});

describe("username suggestions", () => {
  it.each([
    ["ma.hamed+news@example.com", "ma_hamed1"],
    ["first-last@example.com", "first_last1"],
    ["a...--__b@example.com", "a_b1"],
    ["åß@example.com", "player1"],
    ["x@example.com", "player1"],
    ["@example.com", "player1"],
    [`${"a".repeat(200)}@example.com`, `${"a".repeat(19)}1`],
    ["person@local@domain.example", "personlocal1"],
  ])("derives a safe local prefix from %s", (email, expected) => {
    expect(suggestUsernames(email, 1, () => 0)).toEqual([expected]);
  });

  it("appends 1-3 digits without a leading zero and caps total length", () => {
    const suggestions = suggestUsernames(
      "abcdefghijklmnopqrst@example.com",
      3,
      (() => {
        const values = [0, 0.01, 0.999999];
        let index = 0;
        return () => values[index++] ?? 0;
      })(),
    );

    expect(suggestions).toHaveLength(3);
    for (const suggestion of suggestions) {
      expect(suggestion).toMatch(/^[a-z0-9_]+[1-9][0-9]{0,2}$/);
      expect(suggestion.length).toBeLessThanOrEqual(20);
      expect(usernameSchema.safeParse(suggestion).success).toBe(true);
    }
  });

  it("never leaks the email domain", () => {
    expect(
      suggestUsernames("mahamed@private-domain.example", 3, () => 0.5),
    ).not.toEqual(expect.arrayContaining([expect.stringContaining("private")]));
  });

  it("uses a bounded deterministic fallback for duplicate randomness", () => {
    const suggestions = suggestUsernames("mahamed@example.com", 12, () => 0);
    expect(suggestions).toHaveLength(12);
    expect(new Set(suggestions).size).toBe(12);
  });
});

describe("account avatars and cooldown", () => {
  it("keeps avatar colour tied to the permanent id", () => {
    const before = avatarColorForUserId("user-permanent-id");
    const after = avatarColorForUserId("user-permanent-id");
    expect(after).toBe(before);
    expect(AVATAR_PALETTE).toContain(before);
    expect(avatarInitial(" mahamed")).toBe("M");
    expect(avatarModeSchema.safeParse("upload").success).toBe(false);
  });

  it("starts a 30-day cooldown at confirmation", () => {
    const changedAt = new Date("2026-01-01T00:00:00.000Z");
    const next = nextUsernameChangeAt(changedAt);
    expect(next.getTime() - changedAt.getTime()).toBe(
      USERNAME_CHANGE_COOLDOWN_MS,
    );
    expect(canChangeUsername(changedAt, new Date(next.getTime() - 1))).toBe(
      false,
    );
    expect(canChangeUsername(changedAt, next)).toBe(true);
    expect(canChangeUsername(null, changedAt)).toBe(true);
  });
});
