import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const META_MARKER = /<!-- BUILD_ID_INJECT -->[\s\S]*?<!-- \/BUILD_ID_INJECT -->/;

function readBuildId(): string {
  try {
    const raw = fs.readFileSync(path.resolve('public/build-info.json'), 'utf8');
    return JSON.parse(raw).buildId || 'dev';
  } catch {
    return 'dev';
  }
}

/** Injeta meta axecloud-build no HTML e constante no bundle JS para detecção de update. */
export function buildIdInject(): Plugin {
  return {
    name: 'build-id-inject',
    config() {
      const buildId = readBuildId();
      return {
        define: {
          __AXECLOUD_BUILD_ID__: JSON.stringify(buildId),
        },
      };
    },
    transformIndexHtml(html) {
      const buildId = readBuildId();
      return html.replace(
        META_MARKER,
        `<!-- BUILD_ID_INJECT -->\n    <meta name="axecloud-build" content="${buildId}" />\n    <!-- /BUILD_ID_INJECT -->`,
      );
    },
  };
}
