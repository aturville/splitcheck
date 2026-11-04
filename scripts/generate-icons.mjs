// Renders public/icon.svg to the PNG sizes used by the web manifest and iOS.
// Run after editing the SVG: node scripts/generate-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = fs.readFileSync(path.join(publicDir, 'icon.svg'));

const outputs = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of outputs) {
  // Render at high density so small sizes stay crisp, then flatten (iOS shows transparency as black)
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .flatten({ background: '#16a34a' })
    .png()
    .toFile(path.join(publicDir, file));
  console.log(`wrote public/${file} (${size}x${size})`);
}
