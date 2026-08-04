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

    const panel = screen.getByRole("dialog", {
      name: topBarCopy.menuPanelLabel,
    });
    expect(within(panel).getByText(topBarCopy.groupPages)).toBeVisible();
    expect(within(panel).getByText(topBarCopy.groupGame)).toBeVisible();
    expect(
      within(panel).getByRole("link", { name: "Baro xeerarka" }),
    ).toHaveAttribute("href", "/learn");
    const resign = within(panel).getByRole("button", { name: "Is dhiib" });
    expect(resign).toHaveClass("text-danger");

    await fireEvent.click(resign);
    expect(onResign).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to its trigger", async () => {
    const { trigger } = renderPanel();
    trigger.focus();
    await fireEvent.click(trigger);
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveFocus();

    await fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await Promise.resolve();
    expect(trigger).toHaveFocus();
  });

  it("traps Tab in both directions", async () => {
    const { trigger } = renderPanel();
    await fireEvent.click(trigger);
    const panel = screen.getByRole("dialog");
    const first = within(panel).getByRole("link", { name: "Baro xeerarka" });
    const last = within(panel).getByRole("button", {
      name: "Ka bax ciyaarta",
    });

    last.focus();
    await fireEvent.keyDown(panel, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    await fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });
});
