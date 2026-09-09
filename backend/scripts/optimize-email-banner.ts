import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

async function main() {
  const src = path.resolve(
    __dirname,
    '../../frontend/public/header_email.png',
  );
  const outDir = path.resolve(__dirname, '../../frontend/public/email-assets');
  const out = path.join(outDir, 'header-banner.jpg');

  fs.mkdirSync(outDir, { recursive: true });

  const before = fs.statSync(src).size;
  await sharp(src)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 78, progressive: true })
    .toFile(out);
  const after = fs.statSync(out).size;

  console.log(
    `header-banner.jpg: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
