// The web project also checks browser DOM code. Importing the Worker globals
// in its tsconfig would replace browser declarations with the Workers DOM.
declare module "cloudflare:workers" {
  export abstract class WorkerEntrypoint<Env> {
    protected readonly env: Env;
    protected readonly ctx: { waitUntil(promise: Promise<unknown>): void };
  }
}
