import { fireEvent, render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Avatar from "./Avatar.svelte";
import UsernameField from "./UsernameField.svelte";
import { allowedGoogleAvatarUrl } from "./avatar";

describe("account avatars", () => {
  it.each([
    [null, null],
    ["http://lh3.googleusercontent.com/photo", null],
    ["https://example.com/photo", null],
    [
      "https://lh3.googleusercontent.com/photo",
      "https://lh3.googleusercontent.com/photo",
    ],
    [
      "https://lh6.googleusercontent.com/a/photo",
      "https://lh6.googleusercontent.com/a/photo",
    ],
  ])("allowlists %j", (value, expected) => {
    expect(allowedGoogleAvatarUrl(value)).toBe(expected);
  });

  it("renders an initial when the Google image is missing or unsafe", () => {
    const view = render(Avatar, {
      username: "mahamed",
      initial: "M",
      color: "#332016",
      avatarMode: "google",
      imageUrl: "https://example.com/private",
    });
    expect(view.queryByRole("img")).not.toBeInTheDocument();
    expect(view.getByText("M")).toBeInTheDocument();
  });

  it("uses no-referrer for an allowlisted Google image and falls back on error", async () => {
    const view = render(Avatar, {
      username: "mahamed",
      initial: "M",
      color: "#332016",
      avatarMode: "google",
      imageUrl: "https://lh3.googleusercontent.com/a/photo",
    });
    const image = view.container.querySelector("img");
    if (image === null)
      throw new Error("Expected an allowlisted avatar image.");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    await fireEvent.error(image);
    expect(view.container.querySelector("img")).not.toBeInTheDocument();
    expect(view.getByText("M")).toBeInTheDocument();
  });
});

describe("username field", () => {
  it("applies a suggestion only after the user selects it", async () => {
    const view = render(UsernameField, {
      value: "player1",
      label: "Magaca dadweynaha",
      suggestions: ["mahamed42"],
    });
    const input = view.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("player1");
    await fireEvent.click(view.getByRole("button", { name: "@mahamed42" }));
    expect(input.value).toBe("mahamed42");
  });
});
