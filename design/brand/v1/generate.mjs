import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const requireFromWeb = createRequire(
  new URL("../../../web/package.json", import.meta.url),
);
const { Resvg } = requireFromWeb("@resvg/resvg-js");

const colors = {
  ink: "#241811",
  walnut: "#43291C",
  cream: "#F6EDDE",
  clay: "#A2432C",
  honey: "#EBC285",
};

const fontDirectory =
  process.env.SHAXDA_BRAND_FONTS ?? "/System/Library/Fonts/Supplemental";
const font = {
  loadSystemFonts: false,
  fontFiles: ["STIXTwoText.ttf", "Arial.ttf", "Arial Bold.ttf"].map(
    (file) => `${fontDirectory}/${file}`,
  ),
};
await Promise.all(font.fontFiles.map((path) => access(path)));

const asset = (path) => new URL(path, import.meta.url);

function svg(width, height, title, contents) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  ${contents}
</svg>\n`;
}

function board(x, y, size, line, pieces) {
  return `<g transform="translate(${x} ${y}) scale(${size / 100})">
    <path d="M9 9H91V91H9Z M23 23H77V77H23Z M37 37H63V63H37Z M50 9V37 M50 63V91 M9 50H37 M63 50H91"
      fill="none" stroke="${line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="${pieces}">
      <circle cx="50" cy="9" r="5.8"/>
      <circle cx="50" cy="23" r="5.8"/>
      <circle cx="50" cy="37" r="5.8"/>
    </g>
  </g>`;
}

function display(value, x, y, size, color, tracking = -2) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="STIX Two Text" font-size="${size}" font-weight="600" letter-spacing="${tracking}">${value}</text>`;
}

function label(value, x, y, size, color, tracking = 0, weight = 700) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial" font-size="${size}" font-weight="${weight}" letter-spacing="${tracking}">${value}</text>`;
}

function lockup(x, y, size, line, pieces) {
  return `<g transform="translate(${x} ${y}) scale(${size / 100})">
    ${board(0, 0, 100, line, pieces)}
    ${display("Shaxda", 113, 75, 77, line, -3.8)}
  </g>`;
}

function background(width, height, color, radius = 0) {
  return `<rect width="${width}" height="${height}" rx="${radius}" fill="${color}"/>`;
}

async function photo(filename, x, y, width, height) {
  const bytes = await readFile(asset(`photography/${filename}`));
  return `<image x="${x}" y="${y}" width="${width}" height="${height}"
    preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${bytes.toString("base64")}"/>`;
}

async function vector(path, content, { outline = false, title } = {}) {
  const output = outline ? new Resvg(content, { font }).toString() : content;
  const accessible = outline
    ? output.replace("<svg ", `<svg role="img" aria-label="${title}" `)
    : output;
  await writeFile(asset(path), accessible);
}

async function png(path, content) {
  await writeFile(asset(path), new Resvg(content, { font }).render().asPng());
}

await Promise.all(
  ["logos", "social", "website"].map((folder) =>
    mkdir(asset(folder), { recursive: true }),
  ),
);

const { ink, walnut, cream, clay, honey } = colors;
for (const [name, line, pieces] of [
  ["dark", ink, clay],
  ["light", cream, honey],
  ["mono", ink, ink],
]) {
  await vector(
    `logos/mark-${name}.svg`,
    svg(100, 100, "Summadda Shaxda", board(0, 0, 100, line, pieces)),
  );
  await vector(
    `logos/lockup-${name}.svg`,
    svg(333, 100, "Shaxda", lockup(0, 0, 100, line, pieces)),
    {
      outline: true,
      title: "Shaxda",
    },
  );
}
await vector(
  "logos/wordmark.svg",
  svg(218, 90, "Shaxda", display("Shaxda", 0, 67, 77, ink, -3.8)),
  {
    outline: true,
    title: "Shaxda",
  },
);

const appIcon = svg(
  512,
  512,
  "Shaxda",
  `${background(512, 512, walnut, 100)}${board(65, 65, 382, cream, honey)}`,
);
const maskableIcon = svg(
  512,
  512,
  "Shaxda",
  `${background(512, 512, walnut)}${board(103, 103, 306, cream, honey)}`,
);
await vector("website/app-icon.svg", appIcon);
await vector("website/app-icon-maskable.svg", maskableIcon);
await png("website/app-icon-512.png", appIcon);
await png("website/app-icon-maskable-512.png", maskableIcon);
await png(
  "website/app-icon-192.png",
  svg(
    192,
    192,
    "Shaxda",
    `${background(192, 192, walnut, 38)}${board(24, 24, 144, cream, honey)}`,
  ),
);
await png(
  "website/app-icon-maskable-192.png",
  svg(
    192,
    192,
    "Shaxda",
    `${background(192, 192, walnut)}${board(39, 39, 114, cream, honey)}`,
  ),
);
await png(
  "website/favicon-32.png",
  svg(
    32,
    32,
    "Shaxda",
    `${background(32, 32, walnut, 6)}${board(2, 2, 28, cream, honey)}`,
  ),
);
await png("social/avatar-512.png", maskableIcon);
await png(
  "website/apple-touch-icon-180.png",
  svg(
    180,
    180,
    "Shaxda",
    `${background(180, 180, walnut)}${board(23, 23, 134, cream, honey)}`,
  ),
);

const square = svg(
  1080,
  1080,
  "Saddex dhagax, hal jare.",
  `
  ${background(1080, 1080, clay)}
  ${lockup(65, 54, 51, cream, honey)}
  <path d="M68 131H1012 M68 965H1012" stroke="${cream}" stroke-opacity=".44" stroke-width="2"/>
  ${display("Saddex dhagax,", 66, 287, 117, cream, -3.4)}
  ${display("hal jare.", 66, 393, 117, cream, -4.8)}
  ${board(478, 413, 544, cream, honey)}
  ${label("Ciyaar dhaqameed Soomaali ah", 68, 1016, 25, cream, 0, 400)}
  ${label("shaxda.app", 876, 1016, 25, cream)}
`,
);
await png("social/jare-square-1080.png", square);

const portrait = svg(
  1080,
  1350,
  "La ciyaar saaxiibkaa.",
  `
  ${await photo("saaxiib.jpg", 0, 0, 1080, 1350)}
  <defs><linearGradient id="footer" x2="0" y2="1"><stop stop-color="${ink}" stop-opacity="0"/><stop offset="1" stop-color="${ink}" stop-opacity=".94"/></linearGradient></defs>
  <rect y="1115" width="1080" height="235" fill="url(#footer)"/>
  ${lockup(65, 65, 57, cream, honey)}
  ${display("La ciyaar", 65, 247, 127, cream, -3.6)}
  ${display("saaxiibkaa.", 65, 365, 127, cream, -4.3)}
  <path d="M69 1226H1011" stroke="${cream}" stroke-opacity=".55" stroke-width="2"/>
  ${label("Shaxda ku ciyaar bilaash", 70, 1281, 28, cream)}
  ${label("shaxda.app", 851, 1281, 27, cream)}
`,
);
await png("social/saaxiib-portrait-1080x1350.png", portrait);

const story = svg(
  1080,
  1920,
  "La ciyaar saaxiibkaa.",
  `
  ${background(1080, 1920, ink)}
  ${await photo("saaxiib.jpg", 0, 330, 1080, 1350)}
  <defs>
    <linearGradient id="top" x2="0" y2="1"><stop stop-color="${ink}"/><stop offset="1" stop-color="${ink}" stop-opacity="0"/></linearGradient>
    <linearGradient id="bottom" x2="0" y2="1"><stop stop-color="${ink}" stop-opacity="0"/><stop offset="1" stop-color="${ink}"/></linearGradient>
  </defs>
  <rect y="329" width="1080" height="390" fill="url(#top)"/>
  <rect y="1390" width="1080" height="291" fill="url(#bottom)"/>
  ${lockup(70, 244, 62, cream, honey)}
  ${display("La ciyaar", 68, 465, 139, cream, -4.6)}
  ${display("saaxiibkaa.", 68, 594, 139, cream, -5)}
  <path d="M74 1545H1006" stroke="${cream}" stroke-opacity=".55" stroke-width="2"/>
  ${label("Ciyaar bilaash", 74, 1614, 30, cream)}
  ${label("shaxda.app", 842, 1614, 29, cream)}
`,
);
await png("social/saaxiib-story-1080x1920.png", story);

const cover = svg(
  1500,
  500,
  "Shaxda — Saddex dhagax, hal jare.",
  `
  ${background(1500, 500, walnut)}
  ${await photo("jare.jpg", 611, 0, 889, 500)}
  <defs><linearGradient id="blend"><stop stop-color="${walnut}"/><stop offset="1" stop-color="${walnut}" stop-opacity="0"/></linearGradient></defs>
  <rect x="610" width="200" height="500" fill="url(#blend)"/>
  ${lockup(141, 74, 59, cream, honey)}
  ${display("Saddex dhagax,", 140, 247, 80, cream, -2.8)}
  ${display("hal jare.", 140, 321, 80, cream, -3)}
  ${label("shaxda.app", 143, 382, 25, honey)}
`,
);
await png("social/cover-1500x500.png", cover);

const openGraph = svg(
  1200,
  630,
  "Shaxda — Ciyaar dhaqameed Soomaali ah",
  `
  ${background(1200, 630, cream)}
  <defs><clipPath id="image"><rect x="535" y="35" width="630" height="560" rx="4"/></clipPath></defs>
  <g clip-path="url(#image)">
    ${await photo("jare.jpg", 217, 35, 995, 560)}
  </g>
  ${board(62, 61, 80, ink, clay)}
  ${display("Shaxda", 60, 314, 151, ink, -7.4)}
  ${label("Ciyaar dhaqameed Soomaali ah", 67, 365, 23, walnut, 0, 400)}
  <path d="M67 507H470" stroke="${clay}" stroke-opacity=".5" stroke-width="1"/>
  ${label("shaxda.app", 67, 549, 23, clay)}
`,
);
await png("website/share-card-1200x630.png", openGraph);
