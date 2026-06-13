import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const META_MARKER = /<!-- BUILD_ID_INJECT -->[\s\S]*?<!-- \/BUILD_ID_INJECT -->/;

/** Injeta meta axecloud-build no HTML para o PWA comparar com o servidor. */
export function buildIdInject(): Plugin {
  return {
    name: 'build-id-inject',
    transformIndexHtml(html) {
      let buildId = 'dev';
      try {
        const raw = fs.readFileSync(path.resolve('public/build-info.json'), 'utf8');
        buildId = JSON.parse(raw).buildId || buildId;
      } catch {
        /* build local sem write-build-info */
      }
      return html.replace(
        META_MARKER,
        `<!-- BUILD_ID_INJECT -->\n    <meta name="axecloud-build" content="${buildId}" />\n    <!-- /BUILD_ID_INJECT -->`,
      );
    },
  };
}
