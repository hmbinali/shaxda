<script lang="ts">
  import { CircleAlert, Lightbulb, ShieldCheck } from "@lucide/svelte";
  import type { ContentCalloutVariant } from "@shaxda/i18n";
  import type { Component, Snippet } from "svelte";

  interface Props {
    variant: ContentCalloutVariant;
    children: Snippet;
  }

  let { variant, children }: Props = $props();

  const variants = {
    xeer: {
      label: "Xeer",
      icon: ShieldCheck,
      className: "border-emerald-800/25 bg-emerald-50/70 text-emerald-950",
    },
    digniin: {
      label: "Digniin",
      icon: CircleAlert,
      className: "border-red-900/25 bg-red-50/75 text-red-950",
    },
    talo: {
      label: "Xeer ma aha · Talo",
      icon: Lightbulb,
      className: "border-amber-800/25 bg-amber-50/75 text-amber-950",
    },
  } as const satisfies Record<
    ContentCalloutVariant,
    { label: string; icon: Component; className: string }
  >;

  const treatment = $derived(variants[variant]);
</script>

<aside class={`rounded-xl border p-4 ${treatment.className}`}>
  <p class="flex items-center gap-2 text-sm font-bold">
    <treatment.icon size={18} aria-hidden="true" />
    <span>{treatment.label}</span>
  </p>
  <div class="mt-2 text-sm leading-6 sm:text-base sm:leading-7">
    {@render children()}
  </div>
</aside>
