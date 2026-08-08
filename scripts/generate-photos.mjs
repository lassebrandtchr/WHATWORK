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
import { existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'src/assets/images');

const LANDSCAPE = [1600, 1024, 640];
const PORTRAIT = [1200, 800, 500];
const THUMB = [200, 400, 640];

/** Et kvadratisk motiv pr. workoutformat, i samme raekkefoelge som FORMAT_LIST. */
const FORMAT_THUMBS = [
  [30, 'amrap'], [31, 'emom'], [32, 'e2mom'], [33, 'e3mom'], [34, 'e4mom'],
  [35, 'e5mom'], [36, 'fortime'], [37, 'chipper'], [38, 'ladder'], [39, 'interval'],
  [40, 'strength'], [41, 'strength-cond'], [42, 'you-go-i-go'], [43, 'partner-shared'],
  [44, 'team-rotation'],
].map(([n, id]) => [`${n}_format_${id.replace(/-/g, '_')}`, `format-${id}`, THUMB]);

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
  ['20_program_phone_mand', 'program-phone', PORTRAIT],
  ['16_program_wide', 'program-wide', LANDSCAPE],
  ['17_login_landscape', 'login-landscape', [2000, 1400, 900]],
  ['21_equipment_collage', 'equipment-collage', LANDSCAPE],
  ['22_moments_collage', 'moments-collage', LANDSCAPE],
  ['23_workout_anatomy', 'workout-anatomy', LANDSCAPE],
  // Formatikonerne paa Hjaelp vises smaat, saa de behoever ikke bannerbredder.
  ...FORMAT_THUMBS,
];

const source = process.argv[2];
if (!source) {
  console.error('Brug: node scripts/generate-photos.mjs <mappe-med-raa-png>');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

let total = 0;
let written = 0;
for (const [raw, name, widths] of PHOTOS) {
  // Mappen indeholder sjældent alle motiver på én gang — et enkelt motiv
  // udskiftes typisk for sig. Dem der ikke ligger der, springes bare over.
  const input = join(source, `${raw}.png`);
  if (!existsSync(input)) continue;

  for (const width of widths) {
    const file = resolve(outDir, `${name}-${width}.webp`);
    await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(file);
    total += (await stat(file)).size;
  }
  written += 1;
  console.log(`skrev images/${name} i ${widths.length} bredder`);
}

if (!written) {
  console.error(`Ingen kendte motiver fundet i ${source}`);
  process.exit(1);
}
console.log(`${written} motiver, i alt ${(total / 1024 / 1024).toFixed(2)} MB`);
