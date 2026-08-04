<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import {
    buttonStyles,
    type ButtonSize,
    type ButtonVariant,
  } from "./buttonStyles";

  interface Props extends Omit<HTMLAnchorAttributes, "class" | "children"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    children: Snippet;
  }

  let {
    variant = "outline",
    size = "default",
    class: className,
    children,
    ...rest
  }: Props = $props();
</script>

<a {...rest} class={buttonStyles(variant, size, className)}>
  {@render children()}
</a>
