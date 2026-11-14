import type { ClientEventName } from "@shaxda/shared/analytics/events";

export function reportLocalEvent(event: ClientEventName): void {
  if (!navigator.onLine) return;

  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ v: 1, event }),
    keepalive: true,
  }).catch(() => {});
}
