<script lang="ts">
  import { resolve } from "$app/paths";
  import { siteContent } from "@shaxda/i18n";
  import Button from "$components/ui/Button.svelte";
  import ButtonLink from "$components/ui/ButtonLink.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import { authClient } from "$lib/client/auth";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const copy = siteContent.so.pages.login;
  let loading = $state(false);
  let error = $state("");

  async function signIn(): Promise<void> {
    loading = true;
    error = "";
    const callbackURL = `/login?returnTo=${encodeURIComponent(data.returnTo)}`;
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: callbackURL,
    });
    if (result.error) {
      error = copy.failure;
      loading = false;
    }
  }
</script>

<PageMeta title={copy.title} description={copy.description} path={copy.path} />

<section class="grid min-h-full place-items-center px-4 py-12 sm:px-6">
  <div
    class="w-full max-w-lg rounded-3xl border border-board-700/20 bg-board-50 p-6 shadow-xl sm:p-9"
  >
    <p class="text-sm font-bold uppercase tracking-wide text-red-800">
      {copy.eyebrow}
    </p>
    <h1 class="mt-2 text-4xl font-semibold">{copy.title}</h1>
    <p class="mt-4 leading-7 text-board-700">{copy.body}</p>
    {#if error}<p class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">
        {error}
      </p>{/if}
    <Button
      class="mt-7 w-full"
      variant="primary"
      disabled={loading}
      onclick={signIn}
    >
      {loading ? copy.loading : copy.google}
    </Button>
    <ButtonLink
      class="mt-3 w-full"
      href={resolve(
        `/register?returnTo=${encodeURIComponent(data.returnTo)}` as "/register",
      )}
    >
      {copy.registerLink}
    </ButtonLink>
  </div>
</section>
