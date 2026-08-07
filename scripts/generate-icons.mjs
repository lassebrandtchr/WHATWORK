/**
 * Rasteriserer public/icons/icon.svg til de PNG'er, manifestet peger på.
 * Køres med `npm run icons` — kun nødvendigt når mærket ændres.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = resolve(root, 'public/icons');
const source = resolve(iconsDir, 'icon.svg');

/** Maskable-ikonet skal tåle at blive beskåret, så mærket skrumpes ind i en sikker zone. */
const MASKABLE_INSET = 0.8;

const targets = [
  { file: 'icon-180.png', size: 180, inset: 1 },
  { file: 'icon-192.png', size: 192, inset: 1 },
  { file: 'icon-512.png', size: 512, inset: 1 },
  { file: 'apple-touch-icon.png', size: 180, inset: 1 },
  { file: 'maskable-512.png', size: 512, inset: MASKABLE_INSET },
];

await mkdir(iconsDir, { recursive: true });

for (const { file, size, inset } of targets) {
  const inner = Math.round(size * inset);
  const pad = Math.round((size - inner) / 2);
  const mark = await sharp(source, { density: 384 }).resize(inner, inner).png().toBuffer();
  const out = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0x10, g: 0x12, b: 0x15, alpha: 1 },
    },
  })
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toBuffer();
  await writeFile(resolve(iconsDir, file), out);
  console.log(`skrev icons/${file} (${size}×${size})`);
}
