<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import {
    buttonStyles,
    type ButtonSize,
    type ButtonVariant,
  } from "./buttonStyles";

  interface Props extends Omit<
    HTMLButtonAttributes,
    "aria-pressed" | "class" | "children"
  > {
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    children: Snippet;
    testId?: string;
    ariaPressed?: boolean;
    element?: HTMLButtonElement | null;
  }

  let {
    variant = "outline",
    size = "default",
    class: className,
    children,
    testId,
    ariaPressed,
    element = $bindable(null),
    type = "button",
    ...rest
  }: Props = $props();
</script>

<button
  bind:this={element}
  {...rest}
  {type}
  data-testid={testId}
  aria-pressed={ariaPressed}
  class={buttonStyles(variant, size, className)}
>
  {@render children()}
</button>
