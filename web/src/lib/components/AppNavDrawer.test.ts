import { siteContent } from "@shaxda/i18n";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShellHarness from "$lib/shell/AppShellHarness.svelte";

const appState = vi.hoisted(() => ({
  page: {
    url: new URL("https://shaxda.example/local"),
  },
}));

vi.mock("$app/state", () => appState);

const sidebar = siteContent.so.sidebar;
const nav = siteContent.so.nav;

describe("AppNavDrawer", () => {
  beforeEach(() => {
    appState.page.url = new URL("https://shaxda.example/local");
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

  it("marks the current route and traps focus in both directions", async () => {
    render(AppShellHarness, { withDrawer: true });
    await openDrawer();

    const drawer = screen.getByRole("dialog", { name: "Hagaha bogga" });
    const drawerQueries = within(drawer);
    expect(
      drawerQueries.getByRole("link", { name: nav.localPlay }),
    ).toHaveAttribute("aria-current", "page");

    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);

    drawer.focus();
    await fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    first.focus();
    await fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    last?.focus();
    await fireEvent.keyDown(drawer, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("inerts the full shell and releases its main scroll lock", async () => {
    render(AppShellHarness, { withDrawer: true });
    const background = screen.getByTestId("shell-background");
    const main = screen.getByTestId("shell-main");

    await openDrawer();

    expect(background.inert).toBe(true);
    expect(main).toHaveClass("overflow-hidden");

    await fireEvent.keyDown(window, { key: "Escape" });
    await waitForDrawerToClose();

    expect(background.inert).toBe(false);
    expect(main).not.toHaveClass("overflow-hidden");
  });

  it.each([
    ["Escape", "escape"],
    ["backdrop", "backdrop"],
    ["close button", "button"],
  ])("closes from %s and restores focus", async (_label, closePath) => {
    render(AppShellHarness, { withDrawer: true });
    const menuButton = await openDrawer();

    if (closePath === "escape") {
      await fireEvent.keyDown(window, { key: "Escape" });
    } else if (closePath === "backdrop") {
      await fireEvent.click(screen.getByTestId("navigation-drawer-backdrop"));
    } else {
      await fireEvent.click(
        within(screen.getByRole("dialog", { name: "Hagaha bogga" })).getByRole(
          "button",
          { name: sidebar.closeMenu },
        ),
      );
    }

    await waitForDrawerToClose();
    expect(menuButton).toHaveFocus();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("closes after a navigation link is selected", async () => {
    render(AppShellHarness, { withDrawer: true });
    const menuButton = await openDrawer();
    const currentRouteLink = within(
      screen.getByRole("dialog", { name: "Hagaha bogga" }),
    ).getByRole("link", { name: nav.localPlay });
    currentRouteLink.addEventListener("click", (event) =>
      event.preventDefault(),
    );

    await fireEvent.click(currentRouteLink);

    await waitForDrawerToClose();
    expect(menuButton).toHaveFocus();
  });

  it("marks the legal footer link current and closes after selection", async () => {
    appState.page.url = new URL("https://shaxda.example/legal");
    render(AppShellHarness, { withDrawer: true });
    const menuButton = await openDrawer();
    const legalLink = within(
      screen.getByRole("dialog", { name: "Hagaha bogga" }),
    ).getByRole("link", { name: nav.legal });
    legalLink.addEventListener("click", (event) => event.preventDefault());

    expect(legalLink).toHaveAttribute("aria-current", "page");
    await fireEvent.click(legalLink);

    await waitForDrawerToClose();
    expect(menuButton).toHaveFocus();
  });

  it("opens and closes without animation for reduced motion", async () => {
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
    render(AppShellHarness, { withDrawer: true });

    await openDrawer();
    expect(screen.getByRole("dialog", { name: "Hagaha bogga" })).toHaveFocus();

    await fireEvent.keyDown(window, { key: "Escape" });
    await waitForDrawerToClose();
  });
});

async function openDrawer(): Promise<HTMLElement> {
  const menuButton = screen.getByRole("button", {
    name: sidebar.openMenu,
  });
  await fireEvent.click(menuButton);

  expect(
    await screen.findByRole("dialog", { name: "Hagaha bogga" }),
  ).toHaveFocus();

  return menuButton;
}

async function waitForDrawerToClose(): Promise<void> {
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Hagaha bogga" }),
    ).not.toBeInTheDocument(),
  );
}
