import { siteContent } from "@shaxda/i18n";
import { fireEvent, render, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/site/metadata", () => ({
  absoluteUrl: (path: string) => `https://shaxda.example${path}`,
  ogImagePath: "/og-image.png",
}));

vi.mock("$lib/client/auth", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

import RegisterPage from "./+page.svelte";

const copy = siteContent.so.pages.register;
const errors = siteContent.so.accountErrors;

// Suggestions are derived from the private Google email local part, so they must
// never reach the public username without an explicit click or keystroke.
const SUGGESTIONS = ["mahamed_ali7", "mahamed_ali42", "mahamed_ali913"];

type RegisterForm = {
  values: { username: string; avatarMode: string };
  error: string;
};

function pageData(suggestions: string[]) {
  return {
    account: { status: "incomplete" as const },
    returnTo: "/",
    registration: { imageUrl: null, avatarColor: "#332016" },
    suggestions,
  };
}

function renderRegister(
  options: { suggestions?: string[]; form?: RegisterForm } = {},
) {
  const view = render(RegisterPage, {
    data: pageData(options.suggestions ?? SUGGESTIONS),
    form: options.form ?? null,
  });
  const input = view.getByRole("textbox") as HTMLInputElement;
  const confirm = view.getByRole("button", { name: copy.confirm });
  return { ...view, input, confirm };
}

describe("/register username selection", () => {
  it("starts with an empty field and blocked submission even when suggestions exist", () => {
    const { input, confirm, getByText } = renderRegister();

    expect(input.value).toBe("");
    expect(confirm).toBeDisabled();
    expect(getByText(copy.suggestionsLabel)).toBeInTheDocument();
  });

  it("does not apply the first suggestion automatically", () => {
    const { input, getByRole } = renderRegister();

    expect(input.value).toBe("");
    for (const suggestion of SUGGESTIONS) {
      expect(input.value).not.toBe(suggestion);
      expect(
        getByRole("button", { name: `@${suggestion}` }),
      ).toBeInTheDocument();
    }
  });

  it("fills the field only when a suggestion is clicked", async () => {
    const { input, confirm, getByRole } = renderRegister();

    await fireEvent.click(getByRole("button", { name: `@${SUGGESTIONS[1]}` }));

    expect(input.value).toBe(SUGGESTIONS[1]);
    expect(confirm).toBeEnabled();
  });

  it("accepts a manually typed username without suggesting over it", async () => {
    const { input, confirm } = renderRegister();

    await fireEvent.input(input, { target: { value: "cabdi_shaxda" } });

    expect(input.value).toBe("cabdi_shaxda");
    expect(confirm).toBeEnabled();
  });

  it("keeps a typed username when the suggestion list rerenders", async () => {
    const { input, rerender } = renderRegister();
    await fireEvent.input(input, { target: { value: "cabdi_shaxda" } });

    await rerender({
      data: pageData(["another_name1", "another_name2"]),
      form: null,
    });

    expect(input.value).toBe("cabdi_shaxda");
  });

  it("blocks submission while the username is invalid or reserved", async () => {
    const { input, confirm } = renderRegister();

    for (const invalid of ["", "ab", "Mahamed", "with-dash", "admin"]) {
      await fireEvent.input(input, { target: { value: invalid } });
      expect(confirm).toBeDisabled();
    }

    await fireEvent.input(input, { target: { value: "mahamed_ok" } });
    expect(confirm).toBeEnabled();
  });

  it("replays the rejected username instead of inserting a suggestion", () => {
    const { input, getByText } = renderRegister({
      form: {
        values: { username: "taken_name", avatarMode: "initial" },
        error: "taken",
      },
    });

    expect(input.value).toBe("taken_name");
    expect(getByText(errors.taken)).toBeInTheDocument();
  });

  it("leaves the field empty when an empty submission was rejected", () => {
    const { input, confirm } = renderRegister({
      form: {
        values: { username: "", avatarMode: "initial" },
        error: "invalid",
      },
    });

    expect(input.value).toBe("");
    expect(confirm).toBeDisabled();
  });

  it("submits the typed username through the confirm action", async () => {
    const { input, confirm } = renderRegister();
    await fireEvent.input(input, { target: { value: "mahamed_ok" } });

    const form = confirm.closest("form");
    if (form === null) throw new Error("Expected a confirmation form.");
    expect(form).toHaveAttribute("method", "POST");
    expect(form).toHaveAttribute("action", "?/confirm");
    expect((within(form).getByRole("textbox") as HTMLInputElement).name).toBe(
      "username",
    );
    expect(input.value).toBe("mahamed_ok");
  });
});
