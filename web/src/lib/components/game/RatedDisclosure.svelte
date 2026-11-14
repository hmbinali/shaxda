<script lang="ts">
  import { resolve } from "$app/paths";
  import { messages } from "@shaxda/i18n";

  const { rated, friendly, learnMore } = messages.so.ratedPlay.disclosure;
</script>

<div class="grid gap-1 text-xs leading-snug" data-testid="rated-disclosure">
  <p>{rated}</p>
  <p>{friendly}</p>
  <a
    class="font-semibold underline"
    href={resolve("/learn#tartan")}
    target="_blank"
    rel="noopener noreferrer"
  >
    {learnMore}
  </a>
</div>
