import { cn } from "$lib/utils";

export type ButtonVariant = "primary" | "outline" | "success" | "danger";
export type ButtonSize = "default" | "compact" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-board-900 text-board-50 hover:bg-board-700 disabled:cursor-not-allowed disabled:opacity-55",
  outline:
    "border border-board-700/30 bg-white/50 text-board-900 hover:bg-board-100/65 disabled:cursor-not-allowed disabled:opacity-55",
  success: "bg-green-900 text-white hover:bg-green-800",
  danger: "bg-accent text-white hover:bg-red-900",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-4 py-2 text-sm",
  compact: "px-3 py-2 text-sm",
  icon: "min-w-11 p-2",
};

export function buttonStyles(
  variant: ButtonVariant = "outline",
  size: ButtonSize = "default",
  className?: string,
): string {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-reduce:transition-none",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}
