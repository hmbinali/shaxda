<script lang="ts">
  import { allowedGoogleAvatarUrl } from "@shaxda/shared";

  interface Props {
    username: string;
    initial: string;
    color: string;
    avatarMode: "initial" | "google";
    imageUrl?: string | null;
    size?: "small" | "large";
    sizeClass?: string;
  }

  let {
    username,
    initial,
    color,
    avatarMode,
    imageUrl = null,
    size = "large",
    sizeClass,
  }: Props = $props();
  let failed = $state(false);
  const googleSource = $derived(allowedGoogleAvatarUrl(imageUrl));
  const showGoogle = $derived(
    avatarMode === "google" && googleSource !== null && !failed,
  );
</script>

<span
  class={`avatar relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white shadow-sm ring-1 ring-board-900/15 ${sizeClass ?? ""}`}
  class:h-9={sizeClass === undefined && size === "small"}
  class:w-9={sizeClass === undefined && size === "small"}
  class:text-sm={sizeClass === undefined && size === "small"}
  class:h-24={sizeClass === undefined && size === "large"}
  class:w-24={sizeClass === undefined && size === "large"}
  class:text-3xl={sizeClass === undefined && size === "large"}
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
