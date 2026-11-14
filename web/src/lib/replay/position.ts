export function readReplayPosition(url: URL, total: number): number {
  const value = url.searchParams.get("a");
  if (value === null || value === "" || /[^0-9]/.test(value)) return 0;
  const position = Number(value);
  return Number.isSafeInteger(position) ? Math.min(position, total) : 0;
}

export function replayPositionUrl(url: URL, position: number): URL {
  const result = new URL(url);
  if (position === 0) {
    result.searchParams.delete("a");
  } else {
    result.searchParams.set("a", String(position));
  }
  return result;
}
