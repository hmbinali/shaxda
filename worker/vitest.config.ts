import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.toml",
      },
      // The pool calls `unstable_getMiniflareWorkerOptions` without `envFiles`,
      // so Wrangler loads `worker/.dev.vars` into the test Worker and there is
      // no pool option to stop it. A developer with a real `TURNSTILE_SECRET`
      // then fails every room-creation test, including the one asserting that
      // Turnstile is bypassed when no secret is configured. These bindings are
      // merged over the Wrangler-derived ones, which pins the test environment.
      miniflare: {
        bindings: {
          ALLOWED_ORIGIN: "http://127.0.0.1:4173",
          // Empty on purpose: the Worker skips Turnstile when this is unset.
          TURNSTILE_SECRET: "",
          ONLINE_IDENTITY_SECRET:
            "shaxda-online-identity-dev-test-secret-000000000001",
        },
      },
    }),
  ],
});
