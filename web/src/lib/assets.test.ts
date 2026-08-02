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
  "web/static/images/learn/irmaan-example.jpg",
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

  it("commits the optimized Irmaan photograph at its display dimensions", async () => {
    const photoPath = resolve(
      staticDir,
      "images",
      "learn",
      "irmaan-example.jpg",
    );
    const sourcePath = resolve(docsDir, "shaxda_irmaan_example.jpg");
    const [photo, photoMetadata, sourceMetadata] = await Promise.all([
      readFile(photoPath),
      stat(photoPath),
      stat(sourcePath),
    ]);

    expect(readJpegDimensions(photo)).toEqual([960, 1280]);
    expect(photoMetadata.size).toBeLessThan(sourceMetadata.size);
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

function readJpegDimensions(data: Buffer): [number, number] {
  expect(data.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

  let offset = 2;

  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    const segmentLength = data.readUInt16BE(offset + 2);
    const isStartOfFrame =
      marker !== undefined &&
      ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf));

    if (isStartOfFrame) {
      return [data.readUInt16BE(offset + 7), data.readUInt16BE(offset + 5)];
    }

    offset += segmentLength + 2;
  }

  throw new Error("JPEG start-of-frame marker not found");
}
