# Shaxda brand kit

First design round, 14 November 2026. Open [the Somali preview](index.html) to see the assets together. To use the download controls, serve this directory locally with `python3 -m http.server --bind 127.0.0.1 4173 --directory design/brand/v1` and open `http://127.0.0.1:4173`.

## Identity

The mark draws the three connected squares of the Shaxda board. Three matching pieces on the upper spoke form a jare. That same line drives the campaign headline, “Saddex dhagax, hal jare.” The wordmark and campaign headlines use STIX Two Text. Supporting copy uses a plain sans serif. The exported SVG lockups use outlines so they render without requiring a font installation.

| Color  | Hex       | Role                                                |
| ------ | --------- | --------------------------------------------------- |
| Ink    | `#241811` | Type and single-color logo                          |
| Walnut | `#43291C` | Dark brand surface                                  |
| Cream  | `#F6EDDE` | Light surface and reversed type                     |
| Clay   | `#A2432C` | Campaign accent and jare pieces in the primary logo |
| Honey  | `#EBC285` | Jare pieces on dark backgrounds                     |

Use the dark lockup on cream, the light lockup on walnut, and the single-color lockup where only one ink is available. Use the mark alone at favicon and avatar sizes. Keep roughly one piece diameter of clearance around the logo artwork. For rules or teaching, use the full labeled board and established game diagrams.

## Exports

| Folder         | Contents                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logos/`       | Dark, light, and one-color mark and lockup, plus the wordmark as a standalone SVG                                                                         |
| `social/`      | 1080 × 1080 jare post, 1080 × 1350 invite post, 1080 × 1920 story, 1500 × 500 cover, and 512 × 512 avatar                                                 |
| `website/`     | 1200 × 630 link card, 1672 px and 836 px WebP hero images, 192 px and 512 px app icons with maskable variants, 180 px Apple touch icon, and 32 px favicon |
| `photography/` | Clean editorial images used in the compositions                                                                                                           |

The app icon and Open Graph files in `web/static` are the current production assets. This kit lives under `design/` for review before integration.

## Rebuild and sources

Use `node design/brand/v1/generate.mjs` from the repository root with workspace dependencies installed. The script uses the web package's existing resvg dependency and reads the photos above. It regenerates the SVG and PNG exports. On non-macOS systems, set `SHAXDA_BRAND_FONTS` to a directory containing `STIXTwoText.ttf`, `Arial.ttf`, and `Arial Bold.ttf`.

The board and logo artwork came from the project geometry. The two editorial images were created with Codex's built-in ImageGen. The preview loads local assets and system fonts. Asset licensing is pending the owner’s choice, consistent with the [existing Shaxda asset notes](../../../docs/shaxda_assets.md).

### ImageGen prompts used

- **Jare hero and share images.** Landscape editorial website hero photograph for Shaxda. Extreme close-up of exactly three low, smooth, softly chamfered ivory maple game discs aligned along a single straight engraved groove on oiled dark walnut. Keep three discs recognizable on the right two-thirds and the left third quiet. Warm raking light from top left, tactile end grain, rich espresso shadows, warm chalk highlights, close-up medium-format photography. Crop the full grid out. No typography, logo, borders, extra objects, or checker grid.
- **Invite post and story.** Vertical 4:5 editorial photograph for Shaxda. Keep the upper third near-black and quiet for copy. Two adult hands enter from opposite sides at a dark walnut table. A hand with a cream cotton cuff sets down one maple disc while the other reaches toward four loose maple and walnut discs. No board lines. Use low directional light and natural skin and wood texture. No lettering, logo, or props.
