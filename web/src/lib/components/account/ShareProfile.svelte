<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import ShareLink from "$components/ShareLink.svelte";
  import { profileUrl } from "$lib/site/metadata";
  import type { ButtonVariant } from "$components/ui/buttonStyles";

  let {
    username,
    label,
    variant = "outline",
    class: className,
    testId,
  }: {
    username: string;
    label?: string;
    variant?: ButtonVariant;
    class?: string;
    testId?: string;
  } = $props();

  const copy = siteContent.so.pages.profile.share;
  // Always the account's current username, never an old alias, and never any
  // private field: the payload is exactly the public profile.
  const url = $derived(profileUrl(username));
  const payload = $derived({
    title: copy.shareTitle.replace("{username}", username),
    text: copy.shareText.replace("{username}", username),
    url,
  });
</script>

<ShareLink {payload} {copy} {label} {variant} class={className} {testId} />
