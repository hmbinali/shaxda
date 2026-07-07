import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const staticDir = resolve(webRoot, "static");
const docsDir = resolve(webRoot, "..", "docs");

const soundFiles = [
  "place.wav",
  "move.wav",
  "jare.wav",
  "capture.wav",
  "invalid.wav",
  "win.wav",
] as const;

const pngFiles = {
  "icon-192.png": [192, 192],
  "icon-512.png": [512, 512],
  "icon-maskable-192.png": [192, 192],
  "icon-maskable-512.png": [512, 512],
  "apple-touch-icon.png": [180, 180],
  "favicon.png": [32, 32],
  "og-image.png": [1200, 630],
} as const;

const documentedAssets = [
  "web/static/icon.svg",
  "web/static/icon-maskable.svg",
  "web/static/og-image.svg",
  ...Object.keys(pngFiles).map((file) => `web/static/${file}`),
  ...soundFiles.map((file) => `web/static/sounds/${file}`),
  "web/scripts/generate-audio.mjs",
  "web/scripts/generate-icons.mjs",
] as const;

describe("E1 assets", () => {
  it("commits all generated sound cues as non-empty WAV files", async () => {
    for (const file of soundFiles) {
      const path = resolve(staticDir, "sounds", file);
      const [metadata, data] = await Promise.all([stat(path), readFile(path)]);

      expect(metadata.size).toBeGreaterThan(44);
      expect(data.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
    }
  });

  it("commits PNG fallbacks at the expected dimensions", async () => {
    for (const [file, expectedDimensions] of Object.entries(pngFiles)) {
      const data = await readFile(resolve(staticDir, file));

      expect(readPngDimensions(data)).toEqual(expectedDimensions);
    }
  });

  it("documents source and licensing notes for every E1 asset", async () => {
    const docs = await readFile(resolve(docsDir, "shaxda_assets.md"), "utf8");

    for (const asset of documentedAssets) {
      expect(docs).toContain(asset);
    }

    expect(docs).toContain("License TBD by owner");
    expect(docs).not.toContain("CC0-equivalent");
    expect(docs).not.toContain("License = CC0");
  });
});

function readPngDimensions(data: Buffer): [number, number] {
  expect(data.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}
