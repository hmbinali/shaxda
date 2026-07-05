import { describe, expect, it } from "vitest";
import { defaultLocale, locales, messages } from "./index";

describe("i18n scaffold", () => {
  it("defaults to Somali as the only V1.0 locale", () => {
    expect(defaultLocale).toBe("so");
    expect(locales).toEqual(["so"]);
    expect(messages.so.appName).toBe("Shaxda");
  });
});
