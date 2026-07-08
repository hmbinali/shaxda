import { render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import AnalyticsBeacon from "./AnalyticsBeacon.svelte";

describe("AnalyticsBeacon", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("renders no beacon script without a token", () => {
    render(AnalyticsBeacon, { token: "" });

    expect(beaconScript()).toBeNull();
  });

  it("renders the Cloudflare beacon script when a token is configured", () => {
    render(AnalyticsBeacon, { token: "test-token" });

    const script = beaconScript();

    expect(script).not.toBeNull();
    expect(script).toHaveAttribute(
      "src",
      "https://static.cloudflareinsights.com/beacon.min.js",
    );
    expect(script).toHaveAttribute(
      "data-cf-beacon",
      JSON.stringify({ token: "test-token" }),
    );
  });
});

function beaconScript(): HTMLScriptElement | null {
  return document.head.querySelector<HTMLScriptElement>(
    'script[src="https://static.cloudflareinsights.com/beacon.min.js"]',
  );
}
