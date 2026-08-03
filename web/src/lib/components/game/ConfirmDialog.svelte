<script lang="ts">
  import { modal } from "$lib/a11y/modal";
  import Button from "$components/ui/Button.svelte";

  interface Props {
    open: boolean;
    title: string;
    body: string;
    cancelLabel: string;
    confirmLabel: string;
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
    background = null,
    onClose,
    onConfirm,
  }: Props = $props();

  let confirmButton = $state<HTMLButtonElement | null>(null);
</script>

{#if open}
  <div class="layer">
    <button
      class="backdrop"
      type="button"
      aria-label={cancelLabel}
      data-testid="confirm-backdrop"
      onclick={onClose}
    ></button>
    <div
      class="dialog"
      data-testid="confirm-dialog"
      style:overflow-y="auto"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      use:modal={{
        inertTargets: [background],
        initialFocus: confirmButton,
        onEscape: onClose,
      }}
    >
      <div>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-body">{body}</p>
        <div class="actions">
          <Button onclick={onClose}>{cancelLabel}</Button>
          <Button
            bind:element={confirmButton}
            variant="danger"
            onclick={onConfirm}
          >
            {confirmLabel}
          </Button>
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
    place-items: center;
    padding: 1rem;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgb(46 32 25 / 0.55);
  }

  .dialog {
    position: relative;
    width: min(100%, 28rem);
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    border-radius: 1rem;
    background: var(--color-board-50);
    padding: 1rem;
    box-shadow: 0 18px 48px rgb(46 32 25 / 0.28);
    animation: dialog-in 160ms ease-out;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
  }

  p {
    margin: 0.5rem 0 0;
    color: var(--color-board-700);
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  @keyframes dialog-in {
    from {
      transform: translateY(0.5rem) scale(0.98);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dialog {
      animation: none;
    }
  }
</style>
