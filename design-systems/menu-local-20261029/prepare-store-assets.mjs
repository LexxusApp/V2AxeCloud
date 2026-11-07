import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/store');
for (const name of ['colar', 'camiseta', 'vela']) {
  const result = await sharp(path.join(root, `${name}-v1.png`)).webp({ lossless: true, effort: 4 }).toFile(path.join(root, `${name}-v1.webp`));
  console.log(`${name}-v1.webp: ${result.size} bytes`);
}
