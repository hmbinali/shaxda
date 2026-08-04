<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  type NoticeTone = "danger" | "warning" | "info" | "success";

  interface Props {
    tone?: NoticeTone;
    children: Snippet;
    actions?: Snippet;
    class?: string;
    testId?: string;
  }

  let {
    tone = "info",
    children,
    actions,
    class: className,
    testId,
  }: Props = $props();

  const toneClasses: Record<NoticeTone, string> = {
    danger: "border-accent/25 bg-red-50 text-accent",
    warning: "border-jare/25 bg-amber-50 text-amber-950",
    info: "border-board-700/20 bg-white/70 text-board-900",
    success: "border-success/25 bg-green-50 text-green-950",
  };
</script>

<div
  class={cn(
    "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
    toneClasses[tone],
    className,
  )}
  role="status"
  data-testid={testId}
>
  <span>{@render children()}</span>
  {#if actions}
    <span class="flex-none">{@render actions()}</span>
  {/if}
</div>
