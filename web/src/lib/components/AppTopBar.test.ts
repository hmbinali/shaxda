import { AudioLines, Flag, Menu } from "@lucide/svelte";
import { siteContent } from "@shaxda/i18n";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import AppShellHarness from "$lib/shell/AppShellHarness.svelte";
import AppTopBarHarness from "$lib/shell/AppTopBarHarness.svelte";

const topBarCopy = siteContent.so.topBar;

describe("AppTopBar", () => {
  it("renders the default Home brand link and menu action", () => {
    render(AppShellHarness, { pathname: "/" });

    expect(
      screen.getByRole("link", { name: topBarCopy.brandLabel }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("button", { name: topBarCopy.menuLabel }),
    ).toBeVisible();
  });

  it("renders a guarded brand button", async () => {
    const brandGuard = vi.fn();
    render(AppTopBarHarness, {
      config: { actions: [], panels: [], brandGuard },
    });

    const brand = screen.getByRole("button", {
      name: topBarCopy.brandLabel,
    });
    await fireEvent.click(brand);
    expect(brandGuard).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("link", { name: topBarCopy.brandLabel }),
    ).not.toBeInTheDocument();
  });

  it("renders registered actions in order with responsive labels and pressed state", () => {
    render(AppTopBarHarness, {
      config: {
        actions: [
          {
            id: "sound",
            label: "Codka dami",
            shortLabel: "Cod",
            icon: AudioLines,
            onSelect: vi.fn(),
            pressed: true,
          },
          {
            id: "resign",
            label: "Is dhiib",
            shortLabel: "Is dhiib",
            icon: Flag,
            onSelect: vi.fn(),
            tone: "danger",
          },
        ],
        panels: [],
        brandGuard: null,
      },
    });

    const navigation = screen.getByRole("navigation", {
      name: topBarCopy.actionsLabel,
    });
    const buttons = within(navigation).getAllByRole("button");

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Codka dami",
      "Is dhiib",
    ]);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).not.toHaveAttribute("aria-pressed");
    expect(within(buttons[0]).getByText("Cod")).toHaveClass(
      "hidden",
      "md:inline",
    );
  });

  it("toggles the configured panel and expanded state", async () => {
    render(AppTopBarHarness, {
      config: {
        actions: [
          {
            id: "menu",
            label: topBarCopy.menuLabel,
            shortLabel: topBarCopy.menuShort,
            icon: Menu,
            panel: "menu",
          },
        ],
        panels: [],
        brandGuard: null,
      },
    });

    const trigger = screen.getByRole("button", { name: topBarCopy.menuLabel });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "app-nav-panel");

    await fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toHaveAttribute("id", "app-nav-panel");

    await fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
