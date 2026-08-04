<script lang="ts">
  import { isNormalizedUsername } from "@shaxda/shared";

  interface Props {
    value: string;
    label: string;
    suggestions?: string[];
    suggestionsLabel?: string;
  }

  let {
    value = $bindable(),
    label,
    suggestions = [],
    suggestionsLabel = "Talooyin",
  }: Props = $props();
  const valid = $derived(isNormalizedUsername(value));
</script>

<label class="grid gap-2 text-sm font-semibold text-board-900">
  <span>{label}</span>
  <span
    class="flex items-center rounded-xl border border-board-700/30 bg-white focus-within:ring-2 focus-within:ring-focus"
  >
    <span class="pl-3 text-board-700" aria-hidden="true">@</span>
    <input
      name="username"
      bind:value
      required
      minlength="3"
      maxlength="20"
      pattern="[a-z0-9_]+"
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
      aria-invalid={value.length > 0 && !valid}
      class="min-h-12 min-w-0 flex-1 rounded-xl bg-transparent px-1.5 py-2 outline-none"
    />
  </span>
</label>

{#if suggestions.length > 0}
  <fieldset class="mt-3">
    <legend class="text-xs font-bold uppercase tracking-wide text-board-700">
      {suggestionsLabel}
    </legend>
    <div class="mt-2 flex flex-wrap gap-2">
      {#each suggestions as suggestion (suggestion)}
        <button
          type="button"
          class="rounded-full border border-board-700/30 bg-board-50 px-3 py-1.5 text-sm font-semibold hover:bg-board-100 focus-visible:ring-2 focus-visible:ring-focus"
          onclick={() => (value = suggestion)}
        >
          @{suggestion}
        </button>
      {/each}
    </div>
  </fieldset>
{/if}
