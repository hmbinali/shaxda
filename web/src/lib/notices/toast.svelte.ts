export interface TransientToastMessage {
  message: string;
  nonce: number;
}

export class TransientToast {
  current = $state<TransientToastMessage | null>(null);

  #nonce = 0;

  show(message: string): void {
    this.current = { message, nonce: (this.#nonce += 1) };
  }

  clear(): void {
    this.current = null;
  }
}

export function createTransientToast(): TransientToast {
  return new TransientToast();
}
