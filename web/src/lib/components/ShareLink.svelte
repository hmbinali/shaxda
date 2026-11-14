<script lang="ts">
  import Share2 from "@lucide/svelte/icons/share-2";
  import Button from "$components/ui/Button.svelte";
  import type { ButtonVariant } from "$components/ui/buttonStyles";

  let {
    payload,
    copy,
    label,
    variant = "outline",
    class: className,
    testId,
  }: {
    payload: { title: string; text: string; url: string };
    copy: {
      action: string;
      statusLabel: string;
      shared: string;
      copied: string;
      failed: string;
    };
    label?: string;
    variant?: ButtonVariant;
    class?: string;
    testId?: string;
  } = $props();

  let status = $state<"idle" | "shared" | "copied" | "failed">("idle");
  const statusMessage = $derived(status === "idle" ? "" : copy[status]);

  function wasCancelled(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "AbortError"
    );
  }

  async function share(): Promise<void> {
    const { url } = payload;
    status = "idle";

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        status = "shared";
        return;
      } catch (error) {
        // A dismissed share sheet is a normal choice, not an app failure, so it
        // leaves no message behind. Anything else falls back to the clipboard.
        if (wasCancelled(error)) return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      status = "copied";
    } catch {
      status = "failed";
    }
  }
</script>

<div class={className}>
  <Button {variant} {testId} onclick={() => void share()}>
    <Share2 size={16} aria-hidden="true" />
    {label ?? copy.action}
  </Button>
  <p
    role="status"
    aria-label={copy.statusLabel}
    class="mt-2 text-sm"
    class:text-red-900={status === "failed"}
    class:text-board-700={status !== "failed"}
  >
    {statusMessage}
  </p>
</div>
