import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  buildPublicPageBodyInject,
  buildPublicPageHeadInject,
  buildPublicPageNoscript,
  PUBLIC_PRERENDER_PAGES,
} from '../src/constants/seoPublicPages';

const HEAD_MARKER = /<!-- SEO_HEAD_INJECT -->[\s\S]*?<!-- \/SEO_HEAD_INJECT -->/;
const BODY_MARKER = /<!-- SEO_BODY_INJECT -->[\s\S]*?<!-- \/SEO_BODY_INJECT -->/;
const NOSCRIPT_MARKER = /<!-- SEO_NOSCRIPT_INJECT -->[\s\S]*?<!-- \/SEO_NOSCRIPT_INJECT -->/;

/**
 * Gera dist/{rota}/index.html com meta e HTML estático corretos por URL.
 * O Vercel serve esses arquivos antes do rewrite SPA — essencial para indexação.
 */
export function prerenderPublicPages(): Plugin {
  return {
    name: 'prerender-public-pages',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(process.cwd(), 'dist');
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        this.warn('[prerender] dist/index.html ausente — pulando pré-render público.');
        return;
      }

      const template = fs.readFileSync(indexPath, 'utf8');

      for (const page of PUBLIC_PRERENDER_PAGES) {
        const segment = page.path.replace(/^\//, '');
        const outDir = path.join(distDir, segment);
        const html = template
          .replace(
            HEAD_MARKER,
            `<!-- SEO_HEAD_INJECT -->\n    ${buildPublicPageHeadInject(page)}\n    <!-- /SEO_HEAD_INJECT -->`,
          )
          .replace(
            BODY_MARKER,
            `<!-- SEO_BODY_INJECT -->\n${buildPublicPageBodyInject(page)}\n    <!-- /SEO_BODY_INJECT -->`,
          )
          .replace(
            NOSCRIPT_MARKER,
            `<!-- SEO_NOSCRIPT_INJECT -->\n      ${buildPublicPageNoscript(page)}\n    <!-- /SEO_NOSCRIPT_INJECT -->`,
          );

        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
      }

      console.log(
        `[prerender] ${PUBLIC_PRERENDER_PAGES.length} página(s) pública(s): ${PUBLIC_PRERENDER_PAGES.map((p) => p.path).join(', ')}`,
      );
    },
  };
}
