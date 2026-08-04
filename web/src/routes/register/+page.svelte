<script lang="ts">
  import { enhance } from "$app/forms";
  import { siteContent } from "@shaxda/i18n";
  import { avatarInitial } from "@shaxda/shared";
  import { untrack } from "svelte";
  import Avatar from "$components/account/Avatar.svelte";
  import UsernameField from "$components/account/UsernameField.svelte";
  import Button from "$components/ui/Button.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import { authClient } from "$lib/client/auth";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const copy = siteContent.so.pages.register;
  const errors = siteContent.so.accountErrors;
  let username = $state(
    untrack(() => form?.values?.username ?? data.suggestions[0] ?? "player1"),
  );
  let avatarMode = $state<"initial" | "google">(
    untrack(() =>
      form?.values?.avatarMode === "google" ? "google" : "initial",
    ),
  );
  let loading = $state(false);
  const errorCopy = $derived(
    form?.error ? errors[form.error as keyof typeof errors] : "",
  );

  async function signIn(): Promise<void> {
    loading = true;
    const callbackURL = `/login?returnTo=${encodeURIComponent(`/register?returnTo=${encodeURIComponent(data.returnTo)}`)}`;
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
    });
    if (result.error) loading = false;
  }
</script>

<PageMeta title={copy.title} description={copy.description} path={copy.path} />

<section class="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
  <div
    class="rounded-3xl border border-board-700/20 bg-board-50 p-6 shadow-xl sm:p-9"
  >
    <p class="text-sm font-bold uppercase tracking-wide text-red-800">
      {copy.eyebrow}
    </p>
    <h1 class="mt-2 text-4xl font-semibold">{copy.title}</h1>

    {#if data.registration === null}
      <p class="mt-4 leading-7 text-board-700">{copy.signedOutBody}</p>
      <Button
        class="mt-7 w-full"
        variant="primary"
        disabled={loading}
        onclick={signIn}
      >
        {copy.google}
      </Button>
    {:else}
      <p class="mt-4 leading-7 text-board-700">{copy.body}</p>
      {#if errorCopy}<p
          class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900"
        >
          {errorCopy}
        </p>{/if}

      <form
        method="POST"
        action="?/confirm"
        use:enhance
        class="mt-7 grid gap-6"
      >
        <input type="hidden" name="returnTo" value={data.returnTo} />
        <UsernameField
          bind:value={username}
          label={copy.usernameLabel}
          suggestions={data.suggestions}
          suggestionsLabel={copy.suggestionsLabel}
        />

        <fieldset>
          <legend class="text-sm font-semibold">{copy.avatarLabel}</legend>
          <div class="mt-3 flex items-center gap-5">
            <Avatar
              {username}
              initial={avatarInitial(username)}
              color={data.registration.avatarColor}
              {avatarMode}
              imageUrl={data.registration.imageUrl}
            />
            <div class="grid gap-3 text-sm">
              <label class="flex items-center gap-2"
                ><input
                  type="radio"
                  name="avatarMode"
                  value="initial"
                  bind:group={avatarMode}
                />
                {copy.initialAvatar}</label
              >
              <label class="flex items-center gap-2"
                ><input
                  type="radio"
                  name="avatarMode"
                  value="google"
                  bind:group={avatarMode}
                />
                {copy.googleAvatar}</label
              >
            </div>
          </div>
          <p class="mt-3 text-sm leading-6 text-board-700">
            {copy.googleDisclosure}
          </p>
        </fieldset>

        <Button type="submit" variant="primary">{copy.confirm}</Button>
      </form>
    {/if}
  </div>
</section>
