import { siteContent } from "@shaxda/i18n";
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProfilePage from "./+page.svelte";

const copy = siteContent.so.pages.profile;

// `resolveProfile` redirects `/u/old_alias` before the page renders, so the page
// only ever receives the current username.
function profile(username = "mahamed") {
  return {
    data: {
      // A signed-out visitor: the public profile never depends on a session.
      account: null,
      profile: {
        username,
        avatarMode: "initial" as const,
        imageUrl: null,
        avatarColor: "#332016",
        initial: "M",
      },
    },
  };
}

function head(selector: string): string {
  return document.head.querySelector(selector)?.getAttribute("content") ?? "";
}

describe("/u/[username] metadata", () => {
  it("titles the page with the public username only", () => {
    render(ProfilePage, profile());

    expect(document.title).toBe("@mahamed | Shaxda");
    expect(head('meta[property="og:title"]')).toBe("@mahamed | Shaxda");
  });

  it("describes the profile in Somali with the username", () => {
    render(ProfilePage, profile());

    const description = head('meta[name="description"]');
    expect(description).toBe(
      copy.pageDescription.replace("{username}", "mahamed"),
    );
    expect(description).toContain("@mahamed");
  });

  it("points the canonical URL at the current username", () => {
    render(ProfilePage, profile("mahamed_now"));

    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href"),
    ).toBe("https://shaxda.example/u/mahamed_now");
    expect(head('meta[property="og:url"]')).toBe(
      "https://shaxda.example/u/mahamed_now",
    );
  });

  it("reuses the static Open Graph image", () => {
    render(ProfilePage, profile());

    expect(head('meta[property="og:image"]')).toBe(
      "https://shaxda.example/og-image.png",
    );
  });

  it("never renders a private account field", () => {
    const view = render(ProfilePage, profile());
    const markup = `${view.container.innerHTML}${document.head.innerHTML}`;

    for (const field of [
      "private@example.test",
      "user-id-42",
      "googleusercontent",
      "session",
    ]) {
      expect(markup).not.toContain(field);
    }
  });
});

describe("/u/[username] sharing", () => {
  it("offers a share action next to the profile", () => {
    const view = render(ProfilePage, profile());

    expect(
      view.getByRole("button", { name: copy.share.action }),
    ).toBeInTheDocument();
    expect(view.getByRole("status")).toHaveTextContent("");
  });
});
