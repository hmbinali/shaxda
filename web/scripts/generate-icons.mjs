import { Resvg } from "@resvg/resvg-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = resolve(rootDir, "static");

const images = [
  { source: "icon.svg", output: "icon-192.png", width: 192 },
  { source: "icon.svg", output: "icon-512.png", width: 512 },
  { source: "icon-maskable.svg", output: "icon-maskable-192.png", width: 192 },
  { source: "icon-maskable.svg", output: "icon-maskable-512.png", width: 512 },
  { source: "icon.svg", output: "apple-touch-icon.png", width: 180 },
  { source: "icon.svg", output: "favicon.png", width: 32 },
  { source: "og-image.svg", output: "og-image.png", width: 1200 },
];

await mkdir(staticDir, { recursive: true });

for (const image of images) {
  const svg = await readFile(resolve(staticDir, image.source), "utf8");
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: image.width },
  })
    .render()
    .asPng();

  await writeFile(resolve(staticDir, image.output), png);
}
