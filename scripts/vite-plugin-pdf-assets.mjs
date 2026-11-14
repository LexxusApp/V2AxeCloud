import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));

// Fonts, CMaps and decoders must match the bundled PDF.js version and stay same-origin.
export function pdfAssetsPlugin() {
  return {
    name: 'pdf-reader-assets',
    generateBundle() {
      for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
        for (const name of fs.readdirSync(path.join(pdfRoot, folder))) {
          this.emitFile({ type: 'asset', fileName: `pdfjs/${folder}/${name}`, source: fs.readFileSync(path.join(pdfRoot, folder, name)) });
        }
      }
    },
  };
}
