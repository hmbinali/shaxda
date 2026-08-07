import type { ButtonVariant } from "$components/ui/buttonStyles";

export interface GameResultAction {
  id: string;
  label: string;
  onSelect: () => void;
  variant?: ButtonVariant;
  testId?: string;
}
