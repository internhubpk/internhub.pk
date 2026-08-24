#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generate PWA icons from src/app/icon.svg
 * Outputs to public/: icon-96.png, icon-192.png, icon-512.png,
 * icon-maskable-192.png, icon-maskable-512.png, apple-touch-icon.png (180x180)
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SVG_PATH = path.join(__dirname, "..", "src", "app", "icon.svg");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

if (!fs.existsSync(SVG_PATH)) {
  console.error(`Source SVG not found: ${SVG_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const svg = fs.readFileSync(SVG_PATH);

const sizes = [
  { name: "icon-96.png", size: 96, padding: 0 },
  { name: "icon-192.png", size: 192, padding: 0 },
  { name: "icon-512.png", size: 512, padding: 0 },
  { name: "apple-touch-icon.png", size: 180, padding: 0 },
  { name: "icon-maskable-192.png", size: 192, padding: 24 },
  { name: "icon-maskable-512.png", size: 512, padding: 64 },
];

// apple-touch-icon and maskable icons need an opaque background (no
// transparency support on iOS home screen / Android adaptive icons).
// Everything else stays transparent so it sits cleanly in browser tabs.
const BG_COLOR = "#ffffff";

(async () => {
  for (const { name, size, padding } of sizes) {
    const outPath = path.join(PUBLIC_DIR, name);
    try {
      const innerSize = size - padding * 2;
      const svgBuf = await sharp(svg).resize(innerSize, innerSize).toBuffer();
      const needsOpaqueBg = name.includes("apple-touch") || name.includes("maskable");

      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: needsOpaqueBg ? BG_COLOR : { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: svgBuf, gravity: "center" }])
        .png({ palette: true, compressionLevel: 9 })
        .toFile(outPath);
      console.log(`Generated ${name} (${size}x${size})`);
    } catch (err) {
      console.error(`Failed to generate ${name}:`, err);
      process.exit(1);
    }
  }
  console.log("All PWA icons generated.");
})();
