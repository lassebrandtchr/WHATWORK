/**
 * Skalerer de rå fotos ned til de WebP-bredder, skærmene refererer til i
 * `src/assets/images/index.ts`.
 *
 * Køres med `npm run photos -- <mappe-med-raa-png>` — kun nødvendigt når et motiv
 * udskiftes. De rå filer hører ikke i repoet; kun de færdige WebP'er gør.
 *
 * Bredderne følger orienteringen: liggende motiver skal kunne fylde en desktop-banner,
 * stående motiver skal kun dække en telefon eller en smal sidebar.
 */
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'src/assets/images');

const LANDSCAPE = [1600, 1024, 640];
const PORTRAIT = [1200, 800, 500];

/** [rå filnavn uden endelse, navn i appen, bredder] */
const PHOTOS = [
  ['01_gen_over_shoulder_mand', 'gen-phone-solo', PORTRAIT],
  ['02_gen_to_maend', 'gen-phone-duo', LANDSCAPE],
  ['03_gen_par', 'gen-phone-par', PORTRAIT],
  ['04_wall_ball', 'wall-ball', LANDSCAPE],
  ['05_sled_push', 'sled-push', LANDSCAPE],
  ['06_ski_erg', 'ski-erg', PORTRAIT],
  ['07_kb_swing', 'kb-swing', LANDSCAPE],
  ['08_sandbag_lunge', 'sandbag-lunge', LANDSCAPE],
  ['09_row_erg', 'row-erg', LANDSCAPE],
  ['10_box_jump_over', 'box-jump-over', PORTRAIT],
  ['11_thruster', 'thruster', PORTRAIT],
  ['12_high_five', 'high-five', LANDSCAPE],
  // Login-hero'en findes i to udsnit, så telefon og desktop får hver sit motivudsnit.
  ['13_login_wide', 'login-portrait', [1400, 900, 600]],
  ['14_login_portrait', 'chalk-barbell', PORTRAIT],
  ['15_program_phone', 'program-phone', PORTRAIT],
  ['16_program_wide', 'program-wide', LANDSCAPE],
  ['17_login_landscape', 'login-landscape', [2000, 1400, 900]],
];

const source = process.argv[2];
if (!source) {
  console.error('Brug: node scripts/generate-photos.mjs <mappe-med-raa-png>');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

let total = 0;
for (const [raw, name, widths] of PHOTOS) {
  for (const width of widths) {
    const file = resolve(outDir, `${name}-${width}.webp`);
    await sharp(join(source, `${raw}.png`))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(file);
    total += (await stat(file)).size;
  }
  console.log(`skrev images/${name} i ${widths.length} bredder`);
}

console.log(`i alt ${(total / 1024 / 1024).toFixed(2)} MB`);
