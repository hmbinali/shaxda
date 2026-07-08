import { describe, expect, it } from "vitest";
import { fallbackWorkerOrigin, httpOrigin, wsOrigin } from "./workerOrigin";

describe("worker origin", () => {
  it("uses the local worker default", () => {
    expect(httpOrigin("")).toBe(fallbackWorkerOrigin);
  });

  it("normalizes trailing slashes", () => {
    expect(httpOrigin("https://worker.example/")).toBe(
      "https://worker.example",
    );
  });

  it("converts http origins to websocket origins", () => {
    expect(wsOrigin("http://127.0.0.1:8787")).toBe("ws://127.0.0.1:8787");
    expect(wsOrigin("https://worker.example")).toBe("wss://worker.example");
  });
});
