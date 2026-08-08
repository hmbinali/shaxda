<script lang="ts">
  import { enhance } from "$app/forms";
  import { siteContent } from "@shaxda/i18n";
  import { untrack } from "svelte";
  import Avatar from "$components/account/Avatar.svelte";
  import ShareProfile from "$components/account/ShareProfile.svelte";
  import UsernameField from "$components/account/UsernameField.svelte";
  import Button from "$components/ui/Button.svelte";
  import ButtonLink from "$components/ui/ButtonLink.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import { profilePath } from "$lib/site/metadata";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const copy = siteContent.so.pages.account;
  const errors = siteContent.so.accountErrors;
  let username = $state(untrack(() => data.settings.username));
  let avatarMode = $state<"initial" | "google">(
    untrack(() => data.settings.avatarMode),
  );
  const errorCopy = $derived.by(() => {
    if (!form?.error) return "";
    if (
      form.error === "cooldown" &&
      "eligibleDate" in form &&
      typeof form.eligibleDate === "string"
    ) {
      return errors.cooldown.replace("{date}", form.eligibleDate);
    }
    return errors[form.error as keyof typeof errors] ?? errors.invalid;
  });
</script>

<PageMeta title={copy.title} description={copy.description} path={copy.path} />

<section class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
  <h1 class="text-4xl font-semibold">{copy.title}</h1>
  <p class="mt-3 text-board-700">{copy.description}</p>

  {#if errorCopy}<p class="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-900">
      {errorCopy}
    </p>{/if}
  {#if form?.saved}<p
      class="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
    >
      {errors.saved}
    </p>{/if}

  <div class="mt-8 grid gap-6">
    <article
      class="rounded-3xl border border-board-700/20 bg-board-50 p-6 shadow-sm"
    >
      <div class="flex flex-wrap items-center gap-5">
        <Avatar
          username={data.settings.username}
          initial={data.settings.initial}
          color={data.settings.avatarColor}
          {avatarMode}
          imageUrl={data.settings.imageUrl}
        />
        <dl class="grid gap-2 text-sm">
          <div>
            <dt class="font-semibold">{copy.emailLabel}</dt>
            <dd class="text-board-700">{data.settings.email}</dd>
          </div>
          <div>
            <dt class="font-semibold">{copy.joinedLabel}</dt>
            <dd class="text-board-700">{data.settings.joinedAt}</dd>
          </div>
          {#if data.settings.nextChangeAt}<div>
              <dt class="font-semibold">{copy.nextChangeLabel}</dt>
              <dd class="text-board-700">{data.settings.nextChangeAt}</dd>
            </div>{/if}
        </dl>
      </div>
      <div class="mt-5 flex flex-wrap items-start gap-3">
        <ButtonLink href={profilePath(data.settings.username)}
          >{copy.profileLink}</ButtonLink
        >
        <ShareProfile
          username={data.settings.username}
          label={copy.shareProfile}
          testId="share-my-profile"
        />
      </div>
    </article>

    <form
      method="POST"
      action="?/username"
      use:enhance
      class="rounded-3xl border border-board-700/20 bg-board-50 p-6 shadow-sm"
    >
      <UsernameField bind:value={username} label={copy.usernameLabel} />
      <Button class="mt-5" type="submit" variant="primary"
        >{copy.saveUsername}</Button
      >
    </form>

    <form
      method="POST"
      action="?/avatarMode"
      use:enhance
      class="rounded-3xl border border-board-700/20 bg-board-50 p-6 shadow-sm"
    >
      <fieldset class="grid gap-3 text-sm">
        <legend class="font-semibold"
          >{siteContent.so.pages.register.avatarLabel}</legend
        >
        <label class="flex items-center gap-2"
          ><input
            type="radio"
            name="avatarMode"
            value="initial"
            bind:group={avatarMode}
          />
          {siteContent.so.pages.register.initialAvatar}</label
        >
        <label class="flex items-center gap-2"
          ><input
            type="radio"
            name="avatarMode"
            value="google"
            bind:group={avatarMode}
          />
          {siteContent.so.pages.register.googleAvatar}</label
        >
      </fieldset>
      <p class="mt-3 text-sm text-board-700">
        {siteContent.so.pages.register.googleDisclosure}
      </p>
      <Button class="mt-5" type="submit" variant="primary"
        >{copy.saveAvatar}</Button
      >
    </form>

    <form method="POST" action="/logout">
      <Button type="submit">{copy.logout}</Button>
    </form>

    <aside
      class="rounded-3xl border border-board-700/30 p-6"
      aria-labelledby="delete-account-title"
    >
      <h2 id="delete-account-title" class="text-lg font-semibold">
        {copy.deleteTitle}
      </h2>
      <p class="mt-2 text-sm leading-6 text-board-700">{copy.deleteLater}</p>
    </aside>
  </div>
</section>
