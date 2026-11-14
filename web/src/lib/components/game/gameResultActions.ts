import type { ButtonVariant } from "$components/ui/buttonStyles";

interface ResultAction {
  id: string;
  label: string;
  variant?: ButtonVariant;
  testId?: string;
}

export type GameResultAction = ResultAction &
  ({ onSelect: () => void; href?: never } | { href: string; onSelect?: never });
