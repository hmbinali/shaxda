import { AudioLines, Flag } from "@lucide/svelte";
import { siteContent } from "@shaxda/i18n";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import AppShellHarness from "$lib/shell/AppShellHarness.svelte";
import AppTopBarHarness from "$lib/shell/AppTopBarHarness.svelte";

const sidebar = siteContent.so.sidebar;

describe("AppTopBar", () => {
  it("toggles the drawer state with the global hamburger", async () => {
    render(AppShellHarness);

    const menuButton = screen.getByRole("button", {
      name: sidebar.openMenu,
    });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveAttribute(
      "aria-controls",
      "app-navigation-drawer",
    );

    await fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("renders registered actions in order with pressed state", () => {
    const first = vi.fn();
    const second = vi.fn();

    render(AppTopBarHarness, {
      actions: [
        {
          id: "sound",
          label: "Cod",
          icon: AudioLines,
          onSelect: first,
          pressed: true,
        },
        {
          id: "resign",
          label: "Is dhiib",
          icon: Flag,
          onSelect: second,
          tone: "danger",
        },
      ],
    });

    const topBar = within(screen.getByTestId("app-top-bar"));
    const buttons = topBar.getAllByRole("button");

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      sidebar.openMenu,
      "Cod",
      "Is dhiib",
    ]);
    expect(topBar.getByRole("button", { name: "Cod" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      topBar.getByRole("button", { name: "Is dhiib" }),
    ).not.toHaveAttribute("aria-pressed");
  });
});
