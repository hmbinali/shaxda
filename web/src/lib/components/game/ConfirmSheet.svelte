<script lang="ts">
  import { tick } from "svelte";
  import Button from "$components/ui/Button.svelte";

  interface Props {
    open: boolean;
    title: string;
    body: string;
    cancelLabel: string;
    confirmLabel: string;
    edge?: "top" | "bottom";
    background?: HTMLElement | null;
    onClose: () => void;
    onConfirm: () => void;
  }

  let {
    open,
    title,
    body,
    cancelLabel,
    confirmLabel,
    edge = "bottom",
    background = null,
    onClose,
    onConfirm,
  }: Props = $props();

  let dialog = $state<HTMLElement | null>(null);
  let confirmButton = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (!open) {
      return;
    }

    const focusReturn =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const inertTarget = background;
    if (inertTarget !== null) {
      inertTarget.inert = true;
    }
    void tick().then(() => confirmButton?.focus());

    return () => {
      if (inertTarget !== null) {
        inertTarget.inert = false;
      }
      void tick().then(() => focusReturn?.focus());
    };
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab" || dialog === null) {
      return;
    }

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
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

{#if open}
  <div class="layer" data-edge={edge}>
    <button
      class="backdrop"
      type="button"
      aria-label={cancelLabel}
      data-testid="confirm-backdrop"
      onclick={onClose}
    ></button>
    <div
      bind:this={dialog}
      class="sheet"
      class:top={edge === "top"}
      data-testid="confirm-sheet"
      style:overflow-y="auto"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="confirm-sheet-title"
      aria-describedby="confirm-sheet-body"
      onkeydown={handleKeydown}
    >
      <div class:rotated={edge === "top"}>
        <h2 id="confirm-sheet-title">{title}</h2>
        <p id="confirm-sheet-body">{body}</p>
        <div class="actions">
          <Button onclick={onClose}>{cancelLabel}</Button>
          <button
            bind:this={confirmButton}
            class="confirm"
            type="button"
            onclick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .layer {
    position: fixed;
    z-index: 70;
    inset: 0;
    display: grid;
    align-items: end;
  }

  .layer[data-edge="top"] {
    align-items: start;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgb(46 32 25 / 0.55);
  }

  .sheet {
    position: relative;
    width: 100%;
    max-height: min(70dvh, 28rem);
    overflow-y: auto;
    border-radius: 1rem 1rem 0 0;
    background: #fffaf3;
    padding: 1rem;
    box-shadow: 0 -12px 36px rgb(46 32 25 / 0.24);
    animation: sheet-in 160ms ease-out;
  }

  .sheet.top {
    border-radius: 0 0 1rem 1rem;
    box-shadow: 0 12px 36px rgb(46 32 25 / 0.24);
  }

  .rotated {
    transform: rotate(180deg);
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
  }

  p {
    margin: 0.5rem 0 0;
    color: #765e50;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  .confirm {
    min-height: 2.75rem;
    border: 0;
    border-radius: 0.5rem;
    background: #991b1b;
    padding: 0.5rem 1rem;
    color: white;
    font-size: 0.875rem;
    font-weight: 700;
  }

  @keyframes sheet-in {
    from {
      transform: translateY(1rem);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet {
      animation: none;
    }
  }
</style>
