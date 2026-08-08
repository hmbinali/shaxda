<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import Avatar from "$components/account/Avatar.svelte";
  import ShareProfile from "$components/account/ShareProfile.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import { profilePath } from "$lib/site/metadata";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const copy = siteContent.so.pages.profile;
  // `resolveProfile` redirects aliases, so this is always the current username.
  const username = $derived(data.profile.username);
</script>

<PageMeta
  title={copy.pageTitle.replace("{username}", username)}
  description={copy.pageDescription.replace("{username}", username)}
  path={profilePath(username)}
/>

<section class="grid min-h-full place-items-center px-4 py-12 sm:px-6">
  <article
    class="w-full max-w-lg rounded-3xl border border-board-700/20 bg-board-50 p-8 text-center shadow-xl"
  >
    <Avatar
      {username}
      initial={data.profile.initial}
      color={data.profile.avatarColor}
      avatarMode={data.profile.avatarMode}
      imageUrl={data.profile.imageUrl}
    />
    <p class="mt-5 text-sm font-bold uppercase tracking-wide text-board-700">
      {copy.memberLabel}
    </p>
    <h1 class="mt-2 text-4xl font-semibold">@{username}</h1>
    <ShareProfile
      class="mt-6"
      {username}
      variant="primary"
      testId="share-profile"
    />
  </article>
</section>
