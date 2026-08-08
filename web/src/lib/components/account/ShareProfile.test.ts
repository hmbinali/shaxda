import { siteContent } from "@shaxda/i18n";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShareProfile from "./ShareProfile.svelte";

const copy = siteContent.so.pages.profile.share;

// The account behind the profile; none of these private fields may reach the
// share payload or the URL.
const PRIVATE = [
  "private@example.test",
  "Mahamed Ali Google Name",
  "user-id-42",
  "google",
  "session-token",
];

function stub(name: "share" | "clipboard", value: unknown): void {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

function unsupported(name: "share" | "clipboard"): void {
  Object.defineProperty(navigator, name, {
    value: undefined,
    configurable: true,
  });
}

function renderShare(username = "mahamed") {
  const view = render(ShareProfile, { username });
  return {
    ...view,
    button: view.getByRole("button", { name: copy.action }),
    status: view.getByRole("status"),
  };
}

describe("share profile", () => {
  afterEach(() => {
    unsupported("share");
    unsupported("clipboard");
  });

  it("shares the canonical profile URL through the Web Share API", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub("share", share);
    stub("clipboard", { writeText });
    const { button, status } = renderShare();

    await fireEvent.click(button);

    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0] as Record<string, string>;
    expect(payload.url).toBe("https://shaxda.example/u/mahamed");
    expect(payload.title).toContain("@mahamed");
    expect(payload.text).toContain("@mahamed");
    // The Web Share path must not also write to the clipboard.
    expect(writeText).not.toHaveBeenCalled();
    expect(status).toHaveTextContent(copy.shared);
  });

  it("keeps every private account field out of the share payload", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub("share", share);
    const { button } = renderShare();

    await fireEvent.click(button);

    const serialized = JSON.stringify(share.mock.calls[0][0]);
    expect(Object.keys(share.mock.calls[0][0] as object).sort()).toEqual([
      "text",
      "title",
      "url",
    ]);
    for (const field of PRIVATE) expect(serialized).not.toContain(field);
  });

  it("shares the current username, never an old alias", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub("share", share);
    const { button } = renderShare("mahamed_now");

    await fireEvent.click(button);

    const payload = share.mock.calls[0][0] as { url: string };
    expect(payload.url).toBe("https://shaxda.example/u/mahamed_now");
    expect(payload.url).not.toContain("old_alias");
  });

  it("copies the URL when the Web Share API is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    unsupported("share");
    stub("clipboard", { writeText });
    const { button, status } = renderShare();

    await fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith("https://shaxda.example/u/mahamed");
    expect(status).toHaveTextContent(copy.copied);
  });

  it("falls back to the clipboard when the share sheet fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub("share", vi.fn().mockRejectedValue(new Error("no share target")));
    stub("clipboard", { writeText });
    const { button, status } = renderShare();

    await fireEvent.click(button);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(status).toHaveTextContent(copy.copied);
  });

  it("treats a dismissed share sheet as a normal choice", async () => {
    const cancelled = Object.assign(new Error("dismissed"), {
      name: "AbortError",
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub("share", vi.fn().mockRejectedValue(cancelled));
    stub("clipboard", { writeText });
    const { button, status } = renderShare();

    await fireEvent.click(button);

    expect(writeText).not.toHaveBeenCalled();
    expect(status).toHaveTextContent("");
  });

  it("reports a failure when neither sharing nor copying works", async () => {
    unsupported("share");
    stub("clipboard", {
      writeText: vi.fn().mockRejectedValue(new Error("no")),
    });
    const { button, status } = renderShare();

    await fireEvent.click(button);

    expect(status).toHaveTextContent(copy.failed);
  });

  it("reports a failure when the clipboard API is missing entirely", async () => {
    unsupported("share");
    unsupported("clipboard");
    const { button, status } = renderShare();

    await fireEvent.click(button);

    expect(status).toHaveTextContent(copy.failed);
  });

  it("exposes a named button and a labelled status region", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub("clipboard", { writeText });
    render(ShareProfile, { username: "mahamed", label: "La wadaag boggayga" });

    const button = screen.getByRole("button", { name: "La wadaag boggayga" });
    expect(button).toHaveAttribute("type", "button");
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      copy.statusLabel,
    );

    // Keyboard activation goes through the same handler as a pointer click.
    button.focus();
    expect(button).toHaveFocus();
    await fireEvent.click(button);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
