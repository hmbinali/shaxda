import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

function requireProductionPublicEnv(): Plugin {
  return {
    name: "shaxda-require-production-public-env",
    configResolved(config) {
      if (
        config.command !== "build" ||
        process.env.SHAXDA_REQUIRE_PUBLIC_ENV !== "1"
      ) {
        return;
      }

      const env = loadEnv(config.mode, config.envDir, "PUBLIC_");
      const requiredOrigins = [
        "PUBLIC_SITE_ORIGIN",
        "PUBLIC_WORKER_ORIGIN",
      ] as const;
      const invalidOrigins = requiredOrigins.filter(
        (name) => !env[name]?.trim().startsWith("https://"),
      );

      if (invalidOrigins.length > 0) {
        throw new Error(
          `Production build requires HTTPS values for: ${invalidOrigins.join(", ")}`,
        );
      }
    },
  };
}

export default defineConfig({
  envPrefix: ["VITE_", "PUBLIC_"],
  plugins: [
    requireProductionPublicEnv(),
    tailwindcss(),
    sveltekit(),
    svelteTesting(),
    SvelteKitPWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: [
        "apple-touch-icon.png",
        "favicon.png",
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable.svg",
        "icon-maskable-192.png",
        "icon-maskable-512.png",
        "og-image.png",
        "og-image.svg",
        "sounds/*.wav",
      ],
      manifest: {
        name: "Shaxda",
        short_name: "Shaxda",
        description:
          "Shaxda waa ciyaar Soomaali ah oo lagu barto xeerarka, lagu ciyaaro hal qalab, laguna diyaariyay ciyaar marti ah.",
        lang: "so",
        start_url: "/",
        display: "standalone",
        background_color: "#f8f1e8",
        theme_color: "#332016",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
          {
            src: "/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/local",
        navigateFallbackAllowlist: [/\/local$/],
        globPatterns: ["**/*.{js,css,html,json,svg,png,webp,wav,webmanifest}"],
        ignoreURLParametersMatching: [
          /^utm_/,
          /^fbclid$/,
          /^x-sveltekit-invalidated$/,
        ],
        skipWaiting: false,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
