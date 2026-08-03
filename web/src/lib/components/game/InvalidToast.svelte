<script lang="ts">
  interface Props {
    message: string;
    nonce: number;
    testId: string;
  }

  let { message, nonce, testId }: Props = $props();
  let visible = $state(true);
  let fading = $state(false);

  $effect(() => {
    void nonce;
    visible = true;
    fading = false;

    const fadeTimer = window.setTimeout(() => {
      fading = true;
    }, 2_000);
    const removalTimer = window.setTimeout(() => {
      visible = false;
    }, 2_200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removalTimer);
    };
  });
</script>

{#if visible}
  <p
    class="toast"
    class:fading
    role="status"
    data-testid={testId}
    data-feedback-nonce={nonce}
    style:pointer-events="none"
  >
    {message}
  </p>
{/if}

<style>
  .toast {
    pointer-events: none;
    position: absolute;
    z-index: 30;
    right: 0.75rem;
    bottom: 0.75rem;
    left: 0.75rem;
    margin: 0;
    border: 1px solid rgb(185 28 28 / 0.25);
    border-radius: 999px;
    background: rgb(254 242 242 / 0.96);
    padding: 0.5rem 0.75rem;
    color: var(--color-accent);
    box-shadow: 0 4px 14px rgb(68 38 22 / 0.14);
    text-align: center;
    font-size: 0.875rem;
    font-weight: 600;
    opacity: 1;
    transition: opacity 200ms ease;
  }

  .toast.fading {
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      transition: none;
    }
  }
</style>
