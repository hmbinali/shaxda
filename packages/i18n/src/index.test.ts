import { describe, expect, it } from "vitest";
import { defaultLocale, locales, messages } from "./index";

describe("i18n scaffold", () => {
  it("defaults to Somali and includes English", () => {
    expect(defaultLocale).toBe("so");
    expect(locales).toContain("en");
    expect(messages.so.appName).toBe("Shaxda");
  });
});
