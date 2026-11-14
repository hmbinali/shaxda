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
    element?: HTMLAnchorElement | null;
  }

  let {
    variant = "outline",
    size = "default",
    class: className,
    children,
    element = $bindable(null),
    ...rest
  }: Props = $props();
</script>

<a bind:this={element} {...rest} class={buttonStyles(variant, size, className)}>
  {@render children()}
</a>
