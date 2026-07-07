import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    svelteTesting(),
    SvelteKitPWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Shaxda",
        short_name: "Shaxda",
        description:
          "Shaxda waa ciyaar Soomaali ah oo lagu barto xeerarka, lagu ciyaaro hal qalab, laguna diyaariyay ciyaar marti ah.",
        lang: "so",
        start_url: "/",
        display: "standalone",
        background_color: "#f5efe5",
        theme_color: "#4a2f1f",
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
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,wav}"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
