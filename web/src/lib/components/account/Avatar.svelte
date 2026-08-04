<script lang="ts">
  import { allowedGoogleAvatarUrl } from "@shaxda/shared";

  interface Props {
    username: string;
    initial: string;
    color: string;
    avatarMode: "initial" | "google";
    imageUrl?: string | null;
    size?: "small" | "large";
  }

  let {
    username,
    initial,
    color,
    avatarMode,
    imageUrl = null,
    size = "large",
  }: Props = $props();
  let failed = $state(false);
  const googleSource = $derived(allowedGoogleAvatarUrl(imageUrl));
  const showGoogle = $derived(
    avatarMode === "google" && googleSource !== null && !failed,
  );
</script>

<span
  class="avatar relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white shadow-sm ring-1 ring-board-900/15"
  class:h-9={size === "small"}
  class:w-9={size === "small"}
  class:text-sm={size === "small"}
  class:h-24={size === "large"}
  class:w-24={size === "large"}
  class:text-3xl={size === "large"}
  style:background-color={color}
  aria-label={`@${username}`}
>
  {#if showGoogle}
    <img
      src={googleSource ?? undefined}
      alt=""
      referrerpolicy="no-referrer"
      class="h-full w-full object-cover"
      onerror={() => (failed = true)}
    />
  {:else}
    <span aria-hidden="true">{initial}</span>
  {/if}
</span>
