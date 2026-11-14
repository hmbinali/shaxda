<script lang="ts">
  import { resolve } from "$app/paths";
  import { siteContent } from "@shaxda/i18n";
  import Button from "$components/ui/Button.svelte";
  import { onMount } from "svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const copy = siteContent.so.accountDelete;
  let localTime = $state(false);
  onMount(() => {
    localTime = true;
  });
  const due = $derived(form?.dueAt ?? data.dueAt);
  const dueText = $derived(
    due === null
      ? ""
      : new Intl.DateTimeFormat("so-SO", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: localTime ? undefined : "UTC",
        }).format(due) + (localTime ? "" : " UTC"),
  );
</script>

<svelte:head>
  <title>{copy.title} | Shaxda</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="mx-auto max-w-xl space-y-6 px-4 py-10 sm:px-6">
  <h1 class="text-3xl font-semibold">
    {due === null ? copy.title : copy.pendingTitle}
  </h1>
  {#if form?.error}
    <p role="alert" class="text-red-800">
      {copy.errors[form.error as keyof typeof copy.errors]}
    </p>
  {/if}
  {#if form?.cancelled}
    <p role="status">{copy.cancelled}</p>
  {/if}
  {#if due !== null}
    <p>
      {copy.pendingBody}
      <time datetime={new Date(due).toISOString()}>{dueText}</time>.
    </p>
    {#if form?.requested}
      <p role="status">{copy.requested}</p>
      <a
        class="underline"
        href={resolve("/login?returnTo=/account/delete" as "/login")}
      >
        {siteContent.so.nav.login}
      </a>
    {:else if data.now < due}
      <form method="POST" action="?/cancel">
        <Button type="submit" variant="primary">{copy.cancel}</Button>
      </form>
    {:else}
      <p>{copy.finalizing}</p>
    {/if}
    {#if !form?.requested}
      <form method="POST" action={resolve("/logout")}>
        <Button type="submit" variant="outline"
          >{siteContent.so.nav.logout}</Button
        >
      </form>
    {/if}
  {:else}
    <ul class="list-disc space-y-2 pl-5">
      {#each copy.effects as effect (effect)}
        <li>{effect}</li>
      {/each}
    </ul>
    {#if !data.recent || form?.error === "differentAccount"}
      <p>{copy.reauthBody}</p>
      <form method="POST" action="?/reauth">
        <Button type="submit" variant="outline">{copy.reauth}</Button>
      </form>
    {:else}
      <form method="POST" action="?/request" class="space-y-4">
        <label class="block">
          {data.username
            ? `${copy.confirmUsername} (@${data.username})`
            : copy.confirmEmail}
          <input
            name="confirm"
            required
            maxlength="254"
            autocomplete="off"
            class="mt-2 block w-full rounded-lg border border-board-700/30 bg-board-50 px-3 py-2"
          />
        </label>
        <label class="flex items-start gap-2">
          <input name="acknowledge" type="checkbox" required class="mt-1" />
          <span>{copy.acknowledge}</span>
        </label>
        <Button type="submit" variant="primary">{copy.submit}</Button>
      </form>
    {/if}
  {/if}
</section>
