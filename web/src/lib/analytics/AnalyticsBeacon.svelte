<script lang="ts">
  interface Props {
    token?: string;
  }

  let { token = import.meta.env.PUBLIC_CF_BEACON_TOKEN ?? "" }: Props =
    $props();

  const normalizedToken = $derived(token.trim());
</script>

<svelte:head>
  {#if normalizedToken.length > 0}
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: normalizedToken })}
    ></script>
  {/if}
</svelte:head>
