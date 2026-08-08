import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, profilePath, profileUrl, siteOrigin } from "./metadata";

describe("site origin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the placeholder origin when nothing is configured", () => {
    expect(siteOrigin()).toBe("https://shaxda.example");
  });

  it("uses the configured origin without a trailing slash", () => {
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://shaxda.app/");

    expect(siteOrigin()).toBe("https://shaxda.app");
    expect(absoluteUrl("/legal")).toBe("https://shaxda.app/legal");
  });

  it("builds the canonical profile URL from the configured origin", () => {
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://shaxda.app");

    // Never a hardcoded host: the deployed origin is the only source.
    expect(profileUrl("mahamed")).toBe("https://shaxda.app/u/mahamed");
  });

  it("uses the username it is given, so callers must pass the current one", () => {
    expect(profilePath("old_alias")).toBe("/u/old_alias");
    expect(profilePath("mahamed_7")).toBe("/u/mahamed_7");
    expect(profilePath("a b")).toBe("/u/a%20b");
  });
});
