import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const wranglerConfig = process.env.SHAXDA_WRANGLER_CONFIG ?? "wrangler.jsonc";
const wranglerPersist = process.env.SHAXDA_WRANGLER_PERSIST;

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      config: wranglerConfig,
      platformProxy: {
        configPath: wranglerConfig,
        remoteBindings: false,
        ...(wranglerPersist
          ? { persist: { path: `${wranglerPersist}/v3` } }
          : {}),
      },
    }),
    alias: {
      $components: "src/lib/components",
      $utils: "src/lib/utils",
    },
  },
};

export default config;
