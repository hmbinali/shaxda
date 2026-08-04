import { describe, expect, it } from "vitest";
import { accountGroup, defaultTopBar } from "./topBarConfig";

describe("account-aware top bar configuration", () => {
  it("offers login and explicit registration when signed out", () => {
    expect(accountGroup(null).items.map((item) => item.id)).toEqual([
      "login",
      "register",
    ]);
  });

  it("offers completion and POST logout for an incomplete account", () => {
    const items = accountGroup({ status: "incomplete" }).items;
    expect(items.map((item) => item.id)).toEqual([
      "complete-registration",
      "logout",
    ]);
    expect(items[1]).toMatchObject({ formAction: "/logout" });
  });

  it("shows the public username, settings, and POST logout when complete", () => {
    const account = {
      status: "complete" as const,
      username: "mahamed",
      avatarMode: "initial" as const,
      imageUrl: null,
      avatarColor: "#332016",
      initial: "M",
    };
    const group = accountGroup(account);
    expect(group.items.map((item) => item.id)).toEqual([
      "profile",
      "account-settings",
      "logout",
    ]);
    expect(group.items[0]).toMatchObject({
      label: "@mahamed",
      href: "/u/mahamed",
    });
    expect(group.items[2]).toMatchObject({ formAction: "/logout" });
    expect(defaultTopBar("/learn", account).actions[0]).toMatchObject({
      label: "@mahamed",
      shortLabel: "@mahamed",
    });
  });
});
