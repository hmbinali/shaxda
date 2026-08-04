import { RESERVED_USERNAMES } from "./reserved";
import { USERNAME_MAX_LENGTH, usernameSchema } from "./username";

export type UsernameRandom = () => number;

function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] ?? 0) / 0x1_0000_0000;
}

function suggestionBase(email: string): string {
  const at = email.lastIndexOf("@");
  const localPart =
    (at === -1 ? email : email.slice(0, at)).split("+", 1)[0] ?? "";
  const cleaned = localPart
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/[.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (cleaned.length < 3 ? "player" : cleaned).slice(
    0,
    USERNAME_MAX_LENGTH,
  );
}

function assemble(base: string, suffix: number): string {
  const suffixText = String(suffix);
  const prefix = base
    .slice(0, USERNAME_MAX_LENGTH - suffixText.length)
    .replace(/_+$/g, "");
  return `${prefix}${suffixText}`;
}

function drawSuffix(random: UsernameRandom): number {
  const value = random();
  const finite = Number.isFinite(value) ? value : 0;
  const normalized = Math.min(Math.max(finite, 0), 1 - Number.EPSILON);
  return Math.floor(normalized * 999) + 1;
}

function isCandidate(candidate: string): boolean {
  return (
    usernameSchema.safeParse(candidate).success &&
    !RESERVED_USERNAMES.has(candidate)
  );
}

export function suggestUsernames(
  email: string,
  count = 3,
  random: UsernameRandom = secureRandom,
): string[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > 999) {
    throw new RangeError("count must be an integer between 0 and 999");
  }

  const base = suggestionBase(email);
  const candidates = new Set<string>();
  const retryLimit = count * 8;

  for (
    let attempt = 0;
    attempt < retryLimit && candidates.size < count;
    attempt += 1
  ) {
    const candidate = assemble(base, drawSuffix(random));
    if (isCandidate(candidate)) {
      candidates.add(candidate);
    }
  }

  for (let suffix = 1; suffix <= 999 && candidates.size < count; suffix += 1) {
    const candidate = assemble(base, suffix);
    if (isCandidate(candidate)) {
      candidates.add(candidate);
    }
  }

  return [...candidates];
}
