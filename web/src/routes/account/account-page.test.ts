import { siteContent } from "@shaxda/i18n";
import { fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountPage from "./+page.svelte";

const copy = siteContent.so.pages.account;

function accountData(username = "mahamed") {
  return {
    data: {
      account: {
        status: "complete" as const,
        username,
        avatarMode: "initial" as const,
        imageUrl: null,
        avatarColor: "#332016",
        initial: "M",
      },
      settings: {
        username,
        email: "private@example.test",
        joinedAt: "1 Janaayo 2026",
        nextChangeAt: null,
        avatarMode: "initial" as const,
        imageUrl: null,
        avatarColor: "#332016",
        initial: "M",
      },
    },
    form: null,
  };
}

describe("/account profile sharing", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });

  it("puts a share action beside the public profile link", () => {
    const view = render(AccountPage, accountData());

    expect(view.getByRole("link", { name: copy.profileLink })).toHaveAttribute(
      "href",
      "/u/mahamed",
    );
    expect(
      view.getByRole("button", { name: copy.shareProfile }),
    ).toBeInTheDocument();
  });

  it("copies the canonical URL and nothing private", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const view = render(AccountPage, accountData("mahamed_now"));

    await fireEvent.click(
      view.getByRole("button", { name: copy.shareProfile }),
    );

    expect(writeText).toHaveBeenCalledWith(
      "https://shaxda.example/u/mahamed_now",
    );
    expect(view.getByRole("status")).toHaveTextContent(
      siteContent.so.pages.profile.share.copied,
    );
  });
});
