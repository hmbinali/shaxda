<script lang="ts">
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let open = $state(false);
  let background = $state<HTMLElement | null>(null);
  let confirmed = $state(false);
</script>

<div bind:this={background} data-testid="dialog-background">
  <button type="button" onclick={() => (open = true)}>Open</button>
</div>

<output>{confirmed ? "confirmed" : "idle"}</output>

<ConfirmDialog
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
