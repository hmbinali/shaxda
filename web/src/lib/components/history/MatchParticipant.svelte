<script lang="ts">
  import { resolve } from "$app/paths";
  import UserRound from "@lucide/svelte/icons/user-round";
  import Avatar from "$components/account/Avatar.svelte";
  import { participantName, type Participant } from "$lib/history/presentation";

  let { participant }: { participant: Participant } = $props();
</script>

{#if participant.kind === "member"}
  {@const profile = participant.profile}
  <a
    href={resolve(participant.href)}
    class="inline-flex min-w-0 max-w-full items-center gap-2.5 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:underline"
  >
    <span aria-hidden="true" class="flex">
      <Avatar
        username={profile.username}
        initial={profile.initial}
        color={profile.avatarColor}
        avatarMode={profile.avatarMode}
        imageUrl={profile.imageUrl}
        size="small"
      />
    </span>
    <span class="break-all">{participantName(participant)}</span>
  </a>
{:else}
  <span class="inline-flex items-center gap-2.5 font-semibold text-board-700">
    <span
      class="inline-grid size-9 shrink-0 place-items-center rounded-full bg-board-200 text-board-700"
      aria-hidden="true"
    >
      <UserRound size={18} />
    </span>
    {participantName(participant)}
  </span>
{/if}
