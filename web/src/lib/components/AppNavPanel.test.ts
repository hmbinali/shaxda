import { BookOpen, Flag, LogOut, Menu } from "@lucide/svelte";
import { siteContent } from "@shaxda/i18n";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import AppTopBarHarness from "$lib/shell/AppTopBarHarness.svelte";

const topBarCopy = siteContent.so.topBar;

function renderPanel(onResign = vi.fn()) {
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
      panels: [
        {
          id: "pages",
          label: topBarCopy.groupPages,
          items: [
            {
              id: "learn",
              label: "Baro xeerarka",
              icon: BookOpen,
              href: "/learn",
            },
          ],
        },
        {
          id: "game",
          label: topBarCopy.groupGame,
          items: [
            {
              id: "resign",
              label: "Is dhiib",
              icon: Flag,
              onSelect: onResign,
              danger: true,
            },
            {
              id: "exit",
              label: "Ka bax ciyaarta",
              icon: LogOut,
              onSelect: vi.fn(),
            },
          ],
        },
      ],
      brandGuard: null,
    },
  });

  return {
    trigger: screen.getByRole("button", { name: topBarCopy.menuLabel }),
    onResign,
  };
}

describe("AppNavPanel", () => {
  it("renders grouped links and actions and closes after selection", async () => {
    const { trigger, onResign } = renderPanel();
    await fireEvent.click(trigger);

    const menu = screen.getByRole("menu", { name: topBarCopy.menuPanelLabel });
    expect(within(menu).getByText(topBarCopy.groupPages)).toBeVisible();
    expect(within(menu).getByText(topBarCopy.groupGame)).toBeVisible();
    expect(
      within(menu).getByRole("menuitem", { name: "Baro xeerarka" }),
    ).toHaveAttribute("href", "/learn");
    const resign = within(menu).getByRole("menuitem", { name: "Is dhiib" });
    expect(resign).toHaveClass("text-danger");

    await fireEvent.click(resign);
    expect(onResign).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to its trigger", async () => {
    const { trigger } = renderPanel();
    trigger.focus();
    await fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(menu).toHaveFocus();

    await fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await Promise.resolve();
    expect(trigger).toHaveFocus();
  });

  it("traps Tab in both directions", async () => {
    const { trigger } = renderPanel();
    await fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");

    items.at(-1)?.focus();
    await fireEvent.keyDown(menu, { key: "Tab" });
    expect(items[0]).toHaveFocus();

    items[0].focus();
    await fireEvent.keyDown(menu, { key: "Tab", shiftKey: true });
    expect(items.at(-1)).toHaveFocus();
  });
});
