import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

// Círculo negro (#222222, coincide con EMAIL_COLORS.black) + glifo blanco simple
// de cada red social. Rasterizado a PNG @2x (80x80, se muestra a 40x40) porque
// Outlook desktop no soporta SVG en HTML de correo.

const SIZE = 80;
const BG = '#222222';
const FG = '#FFFFFF';

function wrap(glyph: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
      <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="${BG}"/>
      ${glyph}
    </svg>
  `;
}

const icons: Record<string, string> = {
  facebook: wrap(`
    <path d="M46 24h-6v-5c0-2 1-3 3-3h4v-7h-6c-6 0-9 4-9 9v6h-5v8h5v20h9V32h6l1-8z" fill="${FG}"/>
  `),
  instagram: wrap(`
    <rect x="20" y="20" width="40" height="40" rx="11" fill="none" stroke="${FG}" stroke-width="4"/>
    <circle cx="40" cy="40" r="10" fill="none" stroke="${FG}" stroke-width="4"/>
    <circle cx="52" cy="28" r="2.6" fill="${FG}"/>
  `),
  youtube: wrap(`
    <rect x="18" y="26" width="44" height="28" rx="8" fill="none" stroke="${FG}" stroke-width="4"/>
    <path d="M36 32l12 8-12 8z" fill="${FG}"/>
  `),
  x: wrap(`
    <path d="M25 25 L55 55 M55 25 L25 55" stroke="${FG}" stroke-width="5" stroke-linecap="round"/>
  `),
  tiktok: wrap(`
    <path d="M42 20v25a7 7 0 1 1-6-6.9" fill="none" stroke="${FG}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M42 20c1 5 5 9 10 10" fill="none" stroke="${FG}" stroke-width="4" stroke-linecap="round"/>
  `),
};

async function main() {
  const outDir = path.resolve(__dirname, '../../frontend/public/email-assets');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, svg] of Object.entries(icons)) {
    const out = path.join(outDir, `social-${name}.png`);
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log(`social-${name}.png generado`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
