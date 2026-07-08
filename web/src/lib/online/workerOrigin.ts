export const fallbackWorkerOrigin = "http://127.0.0.1:8787";

export function httpOrigin(
  configuredOrigin = import.meta.env.PUBLIC_WORKER_ORIGIN,
): string {
  const origin = configuredOrigin?.trim() || fallbackWorkerOrigin;
  return origin.replace(/\/+$/, "");
}

export function wsOrigin(configuredOrigin?: string): string {
  const origin = httpOrigin(configuredOrigin);
  if (origin.startsWith("https://")) {
    return `wss://${origin.slice("https://".length)}`;
  }

  if (origin.startsWith("http://")) {
    return `ws://${origin.slice("http://".length)}`;
  }

  return origin;
}
