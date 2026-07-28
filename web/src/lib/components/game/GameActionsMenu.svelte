<script lang="ts">
  import { Ellipsis, X } from "@lucide/svelte";
  import { tick } from "svelte";
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    closeLabel: string;
    children: Snippet;
  }

  let { label, closeLabel, children }: Props = $props();
  let open = $state(false);
  let sheet = $state<HTMLElement | null>(null);
  let closeButton = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (!open) {
      return;
    }

    const focusReturn =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    void tick().then(() => closeButton?.focus());

    return () => {
      void tick().then(() => focusReturn?.focus());
    };
  });

  function close(): void {
    open = false;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab" || sheet === null) {
      return;
    }

    const focusable = Array.from(
      sheet.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<details class="menu" bind:open>
  <summary aria-label={label}>
    <Ellipsis size={22} aria-hidden="true" />
  </summary>
  {#if open}
    <div class="layer">
      <button
        class="backdrop"
        type="button"
        aria-label={closeLabel}
        data-testid="game-actions-backdrop"
        onclick={close}
      ></button>
      <div
        bind:this={sheet}
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid="game-actions-sheet"
      >
        <div class="sheet-header">
          <strong>{label}</strong>
          <button
            bind:this={closeButton}
            class="close"
            type="button"
            aria-label={closeLabel}
            data-testid="game-actions-close"
            onclick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {@render children()}
      </div>
    </div>
  {/if}
</details>

<style>
  .menu {
    position: absolute;
    z-index: 10;
    top: calc(50% - 1.25rem);
    left: calc(50% - 1.25rem);
  }

  .menu[open] {
    z-index: 60;
  }

  summary {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    cursor: pointer;
    list-style: none;
    place-items: center;
    border: 1px solid rgb(106 61 37 / 0.3);
    border-radius: 999px;
    background: rgb(255 250 243 / 0.92);
    color: #2e2019;
    box-shadow: 0 4px 14px rgb(68 38 22 / 0.16);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .layer {
    position: fixed;
    z-index: 60;
    inset: 0;
    display: grid;
    align-items: end;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgb(46 32 25 / 0.55);
  }

  .sheet {
    position: relative;
    z-index: 1;
    width: 100%;
    max-height: min(72dvh, 34rem);
    overflow-y: auto;
    border-radius: 1rem 1rem 0 0;
    background: #fffaf3;
    padding: 1rem;
    box-shadow: 0 -12px 36px rgb(46 32 25 / 0.24);
  }

  .sheet-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .sheet-header strong {
    font-size: 1rem;
  }

  .close {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: none;
    cursor: pointer;
    place-items: center;
    border: 1px solid rgb(106 61 37 / 0.25);
    border-radius: 999px;
    background: #fffaf3;
    color: #2e2019;
  }

  @media (min-width: 64rem) {
    .menu {
      display: none;
    }
  }
</style>
