import { siteContent } from "@shaxda/i18n";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "$lib/sidebar/preferences";

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
    window.localStorage.clear();
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn(() => {
        const animation = {
          cancel: vi.fn(),
          finished: Promise.resolve(),
        } as unknown as Animation;

        Object.defineProperty(animation, "onfinish", {
          configurable: true,
          set: (callback: Animation["onfinish"]) => {
            if (callback !== null) {
              queueMicrotask(() =>
                callback.call(animation, {} as AnimationPlaybackEvent),
              );
            }
          },
        });

        return animation;
      }),
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

  it("collapses to an accessible icon rail and persists the preference", async () => {
    render(AppSidebar);
    const desktopSidebar = screen.getByTestId("desktop-sidebar");
    const collapseButton = await screen.findByRole("button", {
      name: sidebar.collapseSidebar,
    });

    expect(desktopSidebar).toHaveAttribute("data-collapsed", "false");

    await fireEvent.click(collapseButton);

    expect(desktopSidebar).toHaveAttribute("data-collapsed", "true");
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: nav.localPlay })).toHaveAttribute(
      "data-tooltip",
      nav.localPlay,
    );
    expect(screen.getByRole("link", { name: nav.privacy })).toHaveAttribute(
      "data-tooltip",
      nav.privacy,
    );
    expect(screen.getByRole("link", { name: nav.terms })).toHaveAttribute(
      "data-tooltip",
      nav.terms,
    );

    await fireEvent.click(
      screen.getByRole("button", { name: sidebar.expandSidebar }),
    );

    expect(desktopSidebar).toHaveAttribute("data-collapsed", "false");
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe(
      "false",
    );
  });

  it("restores a valid collapsed preference after mounting", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, "true");

    render(AppSidebar);

    await waitFor(() =>
      expect(screen.getByTestId("desktop-sidebar")).toHaveAttribute(
        "data-collapsed",
        "true",
      ),
    );
    expect(
      screen.getByRole("button", { name: sidebar.expandSidebar }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("ignores an invalid collapsed preference", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, "sometimes");

    render(AppSidebar);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: sidebar.collapseSidebar }),
      ).toHaveAttribute("aria-expanded", "true"),
    );
    expect(screen.getByTestId("desktop-sidebar")).toHaveAttribute(
      "data-collapsed",
      "false",
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

  it("keeps the mobile drawer usable when reduced motion is requested", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    render(AppSidebar);

    await fireEvent.click(
      screen.getByRole("button", { name: sidebar.openMenu }),
    );
    const drawer = screen.getByRole("dialog", { name: "Hagaha bogga" });
    expect(drawer).toHaveFocus();

    await fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(drawer).not.toBeInTheDocument());
  });
});
