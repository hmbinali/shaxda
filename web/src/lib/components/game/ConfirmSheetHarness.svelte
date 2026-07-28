<script lang="ts">
  import ConfirmSheet from "./ConfirmSheet.svelte";

  let open = $state(false);
  let background = $state<HTMLElement | null>(null);
  let confirmed = $state(false);
</script>

<div bind:this={background} data-testid="sheet-background">
  <button type="button" onclick={() => (open = true)}>Open</button>
</div>

<output>{confirmed ? "confirmed" : "idle"}</output>

<ConfirmSheet
  {open}
  title="Confirm"
  body="A deliberately long confirmation body that can scroll on short screens."
  cancelLabel="Cancel"
  confirmLabel="Continue"
  {background}
  onClose={() => (open = false)}
  onConfirm={() => {
    confirmed = true;
    open = false;
  }}
/>
