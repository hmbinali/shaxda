import { fireEvent, render } from "@testing-library/svelte";
import { allowedGoogleAvatarUrl } from "@shaxda/shared";
import { describe, expect, it } from "vitest";
import Avatar from "./Avatar.svelte";
import UsernameField from "./UsernameField.svelte";

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

  it("renders an empty field and leaves suggestions unapplied", () => {
    const view = render(UsernameField, {
      value: "",
      label: "Magaca dadweynaha",
      suggestions: ["mahamed42", "mahamed7"],
    });
    const input = view.getByRole("textbox") as HTMLInputElement;

    expect(input.value).toBe("");
    expect(input).toBeRequired();
    // An untouched empty field is not an error state yet.
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(
      view.getByRole("button", { name: "@mahamed42" }),
    ).toBeInTheDocument();
    expect(view.getByRole("button", { name: "@mahamed7" })).toBeInTheDocument();
  });

  it("keeps a typed value when the suggestion list changes", async () => {
    const view = render(UsernameField, {
      value: "",
      label: "Magaca dadweynaha",
      suggestions: ["mahamed42"],
    });
    const input = view.getByRole("textbox") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "cabdi_shaxda" } });

    await view.rerender({
      value: "cabdi_shaxda",
      label: "Magaca dadweynaha",
      suggestions: ["another_one9"],
    });

    expect(input.value).toBe("cabdi_shaxda");
  });

  it.each([
    ["ab", "true"],
    ["Mahamed", "true"],
    ["magac-qof", "true"],
    ["mahamed_7", "false"],
  ])("marks %j with aria-invalid=%s", async (value, expected) => {
    const view = render(UsernameField, {
      value: "",
      label: "Magaca dadweynaha",
    });
    const input = view.getByRole("textbox") as HTMLInputElement;
    await fireEvent.input(input, { target: { value } });

    expect(input).toHaveAttribute("aria-invalid", expected);
  });
});
