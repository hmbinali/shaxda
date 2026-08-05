import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const wranglerConfig = process.env.SHAXDA_WRANGLER_CONFIG ?? "wrangler.jsonc";
const wranglerPersist = process.env.SHAXDA_WRANGLER_PERSIST;
const outDir = process.env.SHAXDA_KIT_OUT_DIR;

// Wrangler only consults `.dev.vars` when no `envFiles` are given, so passing a
// non-empty list is what keeps a developer's real `web/.dev.vars` out of an
// end-to-end run. A named Wrangler environment is not enough: it falls back to
// plain `.dev.vars` when `.dev.vars.<env>` is missing.
const wranglerEnvFiles = process.env.SHAXDA_WRANGLER_ENV_FILES?.split(",")
  .map((file) => file.trim())
  .filter((file) => file.length > 0);

const config = {
  preprocess: vitePreprocess(),
  kit: {
    ...(outDir ? { outDir } : {}),
    adapter: adapter({
      config: wranglerConfig,
      platformProxy: {
        configPath: wranglerConfig,
        remoteBindings: false,
        ...(wranglerPersist
          ? { persist: { path: `${wranglerPersist}/v3` } }
          : {}),
        ...(wranglerEnvFiles?.length ? { envFiles: wranglerEnvFiles } : {}),
      },
    }),
    alias: {
      $components: "src/lib/components",
      $utils: "src/lib/utils",
    },
  },
};

export default config;
