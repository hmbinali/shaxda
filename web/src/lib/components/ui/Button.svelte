<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  type ButtonVariant = "primary" | "outline" | "success";
  type ButtonSize = "default" | "compact" | "icon";

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
  }

  let {
    variant = "outline",
    size = "default",
    class: className,
    children,
    testId,
    ariaPressed,
    type = "button",
    ...rest
  }: Props = $props();

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      "bg-board-900 text-board-50 hover:bg-board-700 disabled:cursor-not-allowed disabled:opacity-55",
    outline:
      "border border-board-700/30 bg-white/50 text-board-900 hover:bg-board-100/65 disabled:cursor-not-allowed disabled:opacity-55",
    success: "bg-green-900 text-white hover:bg-green-800",
  };

  const sizeClasses: Record<ButtonSize, string> = {
    default: "px-4 py-2 text-sm",
    compact: "px-3 py-2 text-sm",
    icon: "min-w-11 p-2",
  };
</script>

<button
  {...rest}
  {type}
  data-testid={testId}
  aria-pressed={ariaPressed}
  class={cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
    variantClasses[variant],
    sizeClasses[size],
    className,
  )}
>
  {@render children()}
</button>
