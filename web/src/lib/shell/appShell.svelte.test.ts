import { AudioLines } from "@lucide/svelte";
import { describe, expect, it, vi } from "vitest";
import { createAppShell, type TopBarAction } from "./appShell.svelte";

function action(id: string): TopBarAction {
  return {
    id,
    label: id,
    icon: AudioLines,
    onSelect: vi.fn(),
  };
}

describe("AppShellState", () => {
  it("ignores action cleanup from a non-owner", () => {
    const shell = createAppShell();
    const owner = Symbol("owner");

    shell.setActions(owner, [action("current")]);
    shell.clearActions(Symbol("stale"));

    expect(shell.actions.map(({ id }) => id)).toEqual(["current"]);
  });

  it("lets a second registration replace the first", () => {
    const shell = createAppShell();

    shell.setActions(Symbol("first"), [action("first")]);
    shell.setActions(Symbol("second"), [action("second")]);

    expect(shell.actions.map(({ id }) => id)).toEqual(["second"]);
  });

  it("does not let stale teardown wipe the live registration", () => {
    const shell = createAppShell();
    const firstOwner = Symbol("first");
    const secondOwner = Symbol("second");

    shell.setActions(firstOwner, [action("first")]);
    shell.setActions(secondOwner, [action("second")]);
    shell.clearActions(firstOwner);

    expect(shell.actions.map(({ id }) => id)).toEqual(["second"]);
  });
});
