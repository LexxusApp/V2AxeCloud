import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'gallery');
// Encoding only: preserve the generated pixels and keep every original PNG.
for (const name of ['atabaque', 'flores', 'patio']) {
  await sharp(path.join(root, `${name}-v1.png`)).webp({ lossless: true, effort: 4 }).toFile(path.join(root, `${name}-v1.webp`));
}
