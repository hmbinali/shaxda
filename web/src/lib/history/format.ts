import type { HistorySummary } from "@shaxda/db";
import { siteContent } from "@shaxda/i18n";

type Result = HistorySummary["recent"][number];

const copy = siteContent.so.pages.history;
const dateFormat = new Intl.DateTimeFormat("so-SO", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat("so-SO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatMatchDate(timestamp: number): string {
  return dateFormat.format(timestamp);
}

export function formatMatchDateTime(timestamp: number): string {
  return dateTimeFormat.format(timestamp);
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const units = copy.durationUnits;
  if (hours > 0) return `${hours} ${units.hours} ${minutes} ${units.minutes}`;
  if (minutes > 0) {
    return `${minutes} ${units.minutes} ${seconds % 60} ${units.seconds}`;
  }
  return `${seconds} ${units.seconds}`;
}

export function computeStreak(results: readonly Result[]) {
  const result = results[0];
  if (!result) return null;
  const end = results.findIndex((next) => next !== result);
  const length = end < 0 ? results.length : end;
  return { result, length, capped: length === 20 };
}

export function recentForm(results: readonly Result[]) {
  return results.map((result) => ({
    result,
    mark: copy.formMarks[result],
    label: copy.row.outcome[result],
  }));
}
