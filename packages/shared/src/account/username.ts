import { z } from "zod";
import { RESERVED_USERNAMES } from "./reserved";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(USERNAME_PATTERN);

export type UsernameValidationReason =
  "tooShort" | "tooLong" | "invalidChars" | "reserved";

export type UsernameValidationResult =
  | { ok: true; username: string }
  | { ok: false; username: string; reason: UsernameValidationReason };

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): UsernameValidationResult {
  const username = normalizeUsername(value);

  if (username.length < USERNAME_MIN_LENGTH) {
    return { ok: false, username, reason: "tooShort" };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return { ok: false, username, reason: "tooLong" };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, username, reason: "invalidChars" };
  }

  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, username, reason: "reserved" };
  }

  return { ok: true, username };
}

// `validateUsername` normalizes before validating, so it accepts input the
// username input's own `pattern` rejects (`Mahamed`, ` mahamed `). Use this
// where a control must agree with what the browser will let the user submit.
export function isNormalizedUsername(value: string): boolean {
  const result = validateUsername(value);
  return result.ok && result.username === value;
}
