import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import postcss from 'postcss';
const require = createRequire(import.meta.url);
const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));

export function scopePdfViewerCss(css) {
  const sheet = postcss.parse(css);
  sheet.walkRules(rule => {
    // Nested selectors already inherit their scoped parent. Keyframes aren't selectors.
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === 'rule' || (parent.type === 'atrule' && /keyframes$/i.test(parent.name))) return;
    }
    rule.selectors = rule.selectors.map(selector => selector.includes(':root')
      ? selector.replaceAll(':root', '.ac-pdf-reader')
      : `.ac-pdf-reader ${selector}`);
  });
  return sheet.toString();
}

// Fonts, CMaps and decoders must match the bundled PDF.js version and stay same-origin.
export function pdfAssetsPlugin() {
  return {
    name: 'pdf-reader-assets',
    enforce: 'pre',
    transform(code, id) {
      if (id.split('?')[0].replaceAll('\\', '/').endsWith('/pdfjs-dist/web/pdf_viewer.css')) {
        return { code: scopePdfViewerCss(code), map: null };
      }
    },
    generateBundle() {
      for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
        for (const name of fs.readdirSync(path.join(pdfRoot, folder))) {
          this.emitFile({ type: 'asset', fileName: `pdfjs/${folder}/${name}`, source: fs.readFileSync(path.join(pdfRoot, folder, name)) });
        }
      }
    },
  };
}
