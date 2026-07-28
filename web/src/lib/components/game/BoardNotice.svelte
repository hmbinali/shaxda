<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    body?: string | null;
    sided?: boolean;
    testId?: string;
    actions?: Snippet;
  }

  let { title, body = null, sided = false, testId, actions }: Props = $props();
</script>

<section class="notice" class:sided role="status" data-testid={testId}>
  {#each sided ? [true, false] : [false] as rotate, index (index)}
    <div class:rotated={rotate}>
      <strong>{title}</strong>
      {#if body !== null}
        <span>{body}</span>
      {/if}
      {#if actions}
        {@render actions()}
      {/if}
    </div>
  {/each}
</section>

<style>
  .notice {
    position: absolute;
    z-index: 20;
    top: 50%;
    left: 50%;
    width: min(80%, 20rem);
    transform: translate(-50%, -50%);
    overflow: hidden;
    border: 1px solid rgb(135 90 18 / 0.42);
    border-radius: 0.8rem;
    background: rgb(248 233 189 / 0.96);
    color: #713f12;
    box-shadow: 0 10px 30px rgb(68 38 22 / 0.18);
  }

  .notice.sided {
    display: grid;
    grid-template-rows: 1fr 1fr;
  }

  .notice > div {
    display: grid;
    gap: 0.2rem;
    padding: 0.65rem 0.8rem;
    text-align: center;
  }

  .notice.sided > div:first-child {
    border-bottom: 1px solid rgb(135 90 18 / 0.25);
  }

  .rotated {
    transform: rotate(180deg);
  }

  strong {
    font-size: 0.8rem;
  }

  span {
    font-size: 0.7rem;
    line-height: 1.35;
  }
</style>
