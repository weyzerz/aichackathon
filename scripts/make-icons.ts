import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const SAGE = "#8A9A7B";
const CREAM = "#FAF7F0";

// Two interlocking rings motif. `radius` = corner radius (0 for full-bleed/maskable),
// `scale` shrinks the motif to keep it inside the maskable safe zone.
function svg(radius: number, scale = 1): string {
  const s = 512;
  const r = 92 * scale;
  const stroke = 26 * scale;
  const dx = 58 * scale;
  const cy = s / 2 - 10 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${radius}" fill="${SAGE}"/>
  <circle cx="${s / 2 - dx}" cy="${cy}" r="${r}" fill="none" stroke="${CREAM}" stroke-width="${stroke}"/>
  <circle cx="${s / 2 + dx}" cy="${cy}" r="${r}" fill="none" stroke="${CREAM}" stroke-width="${stroke}" opacity="0.92"/>
  <text x="${s / 2}" y="${cy + r + 78 * scale}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
    font-size="${60 * scale}" font-style="italic" fill="${CREAM}">Party Line</text>
</svg>`;
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  const rounded = svg(112);
  writeFileSync("public/icons/icon.svg", rounded);
  const out: [string, string, number][] = [
    ["public/icons/icon-192.png", rounded, 192],
    ["public/icons/icon-512.png", rounded, 512],
    ["public/icons/icon-maskable-512.png", svg(0, 0.78), 512],
    // iOS applies its own rounding; use a full-bleed square.
    ["public/icons/apple-touch-icon.png", svg(0), 180],
  ];
  for (const [file, markup, size] of out) {
    await sharp(Buffer.from(markup)).resize(size, size).png().toFile(file);
    console.log("wrote", file);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
