import { AudioLines } from "@lucide/svelte";
import { describe, expect, it, vi } from "vitest";
import { createAppShell, type TopBarConfig } from "./appShell.svelte";

function config(id: string): TopBarConfig {
  return {
    actions: [
      {
        id,
        label: id,
        shortLabel: id,
        icon: AudioLines,
        onSelect: vi.fn(),
      },
    ],
    panels: [],
    brandGuard: null,
  };
}

describe("AppShellState", () => {
  it("ignores top-bar cleanup from a non-owner", () => {
    const shell = createAppShell();
    const owner = Symbol("owner");

    shell.setTopBar(owner, config("current"));
    shell.clearTopBar(Symbol("stale"));

    expect(shell.config?.actions.map(({ id }) => id)).toEqual(["current"]);
  });

  it("lets a second registration replace the first", () => {
    const shell = createAppShell();

    shell.setTopBar(Symbol("first"), config("first"));
    shell.setTopBar(Symbol("second"), config("second"));

    expect(shell.config?.actions.map(({ id }) => id)).toEqual(["second"]);
  });

  it("does not let stale teardown wipe the live registration", () => {
    const shell = createAppShell();
    const firstOwner = Symbol("first");
    const secondOwner = Symbol("second");

    shell.setTopBar(firstOwner, config("first"));
    shell.setTopBar(secondOwner, config("second"));
    shell.clearTopBar(firstOwner);

    expect(shell.config?.actions.map(({ id }) => id)).toEqual(["second"]);
  });
});
