import { siteContent } from "@shaxda/i18n";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/state", () => ({
  page: {
    url: new URL("https://shaxda.example/local"),
  },
}));

import AppSidebar from "./AppSidebar.svelte";

const sidebar = siteContent.so.sidebar;
const nav = siteContent.so.nav;

describe("AppSidebar", () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            cancel: vi.fn(),
            finished: Promise.resolve(),
          }) as unknown as Animation,
      ),
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("marks the current route in the primary navigation", () => {
    render(AppSidebar);

    expect(screen.getByRole("link", { name: nav.localPlay })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: nav.home })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("moves focus into the mobile drawer and restores it on Escape", async () => {
    render(AppSidebar);
    const menuButton = screen.getByRole("button", { name: sidebar.openMenu });

    await fireEvent.click(menuButton);

    const drawer = screen.getByRole("dialog", { name: "Hagaha bogga" });
    expect(drawer).toHaveFocus();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(drawer).not.toBeInTheDocument());
    expect(menuButton).toHaveFocus();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile drawer from its backdrop", async () => {
    render(AppSidebar);
    await fireEvent.click(
      screen.getByRole("button", { name: sidebar.openMenu }),
    );

    await fireEvent.click(
      screen.getAllByRole("button", { name: sidebar.closeMenu })[0],
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Hagaha bogga" }),
      ).not.toBeInTheDocument(),
    );
  });
});
