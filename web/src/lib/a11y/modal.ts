import { tick } from "svelte";
import type { Action } from "svelte/action";

export interface ModalOptions {
  inertTargets?: readonly (HTMLElement | null | undefined)[];
  initialFocus?: HTMLElement | null;
  onEscape?: (() => void) | null;
  restoreFocus?: boolean;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const modal: Action<HTMLElement, ModalOptions | undefined> = (
  node,
  initialOptions,
) => {
  let options = initialOptions ?? {};
  const focusReturn =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  function setInert(value: boolean): void {
    for (const target of options.inertTargets ?? []) {
      if (target !== null && target !== undefined && !target.contains(node)) {
        target.inert = value;
      }
    }
  }

  function focusInitial(): void {
    void tick().then(() => (options.initialFocus ?? node).focus());
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      options.onEscape?.();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    const first = focusable[0] ?? node;
    const last = focusable.at(-1) ?? node;

    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === node)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  setInert(true);
  node.addEventListener("keydown", handleKeydown);
  focusInitial();

  return {
    update(nextOptions) {
      setInert(false);
      options = nextOptions ?? {};
      setInert(true);
      focusInitial();
    },
    destroy() {
      node.removeEventListener("keydown", handleKeydown);
      setInert(false);
      if (options.restoreFocus !== false) {
        void tick().then(() => focusReturn?.focus());
      }
    },
  };
};
