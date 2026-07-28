<script lang="ts">
  import { Ellipsis } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    children: Snippet;
  }

  let { label, children }: Props = $props();
</script>

<details class="menu">
  <summary aria-label={label}>
    <Ellipsis size={22} aria-hidden="true" />
  </summary>
  <div class="sheet">
    {@render children()}
  </div>
</details>

<style>
  .menu {
    position: absolute;
    z-index: 30;
    top: calc(50% - 1.25rem);
    left: calc(50% - 1.25rem);
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

  .sheet {
    position: fixed;
    z-index: 60;
    right: 0;
    bottom: 0;
    left: 0;
    max-height: min(72dvh, 34rem);
    overflow-y: auto;
    border-radius: 1rem 1rem 0 0;
    background: #fffaf3;
    padding: 1rem;
    box-shadow: 0 -12px 36px rgb(46 32 25 / 0.24);
  }

  @media (min-width: 64rem) {
    .menu {
      display: none;
    }
  }
</style>
