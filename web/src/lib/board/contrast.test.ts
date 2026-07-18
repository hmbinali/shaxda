import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cueColors = {
  success: "#047857",
  danger: "#b91c1c",
  warning: "#92400e",
  jare: "#92610a",
  focus: "#1e40af",
  selected: "#0369a1",
} as const;

const boardPalette = {
  lightGrain: "#f3dfc6",
  surface: "#ead8c2",
  darkGrain: "#b67a45",
  signalUnderlay: "#f8f1e8",
} as const;

describe("board cue contrast", () => {
  it("keeps every meaningful cue at 3:1 against its light underlay", () => {
    for (const [name, color] of Object.entries(cueColors)) {
      expect(
        contrastRatio(color, boardPalette.signalUnderlay),
        `${name} against the signal underlay`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the deterministic palette synchronized with theme tokens", () => {
    const css = readFileSync("src/app.css", "utf8");
    const board = readFileSync("src/lib/components/Board.svelte", "utf8");

    for (const [name, color] of Object.entries(cueColors)) {
      expect(css).toContain(`--color-${name}: ${color};`);
    }

    for (const color of Object.values(boardPalette)) {
      expect(`${css}\n${board}`).toContain(color);
    }
  });
});

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map(linearize);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hex: string): [number, number, number] {
  const channels = hex.slice(1).match(/.{2}/g);

  if (channels === null || channels.length !== 3) {
    throw new Error(`Invalid color: ${hex}`);
  }

  return channels.map((channel) => Number.parseInt(channel, 16) / 255) as [
    number,
    number,
    number,
  ];
}

function linearize(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}
