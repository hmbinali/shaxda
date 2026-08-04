export const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1_000;

export function nextUsernameChangeAt(changedAt: Date): Date {
  return new Date(changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS);
}

export function canChangeUsername(
  changedAt: Date | null,
  now = new Date(),
): boolean {
  return (
    changedAt === null ||
    nextUsernameChangeAt(changedAt).getTime() <= now.getTime()
  );
}
