import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import {
  buildHomeBodyInject,
  buildHomeHeadInject,
  buildHomeNoscript,
} from '../src/constants/seoHome';
import { injectSiteVerificationHtml } from '../src/constants/seoSearchConsole';

const HEAD_MARKER = /<!-- SEO_HEAD_INJECT -->[\s\S]*?<!-- \/SEO_HEAD_INJECT -->/;
const BODY_MARKER = /<!-- SEO_BODY_INJECT -->[\s\S]*?<!-- \/SEO_BODY_INJECT -->/;
const NOSCRIPT_MARKER = /<!-- SEO_NOSCRIPT_INJECT -->[\s\S]*?<!-- \/SEO_NOSCRIPT_INJECT -->/;

export type SeoHomeInjectOptions = {
  preloadTourImage?: boolean;
};

/** Injeta meta tags, JSON-LD e HTML estático da home a partir de src/constants/seoHome.ts */
export function seoHomeInject(options: SeoHomeInjectOptions = {}): Plugin {
  const { preloadTourImage = true } = options;
  return {
    name: 'seo-home-inject',
    transformIndexHtml(html, ctx) {
      const mode = ctx.server?.config.mode ?? process.env.NODE_ENV ?? 'production';
      const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
      return injectSiteVerificationHtml(
        html
          .replace(
            HEAD_MARKER,
            `<!-- SEO_HEAD_INJECT -->\n    ${buildHomeHeadInject({ preloadTourImage })}\n    <!-- /SEO_HEAD_INJECT -->`,
          )
          .replace(
            BODY_MARKER,
            `<!-- SEO_BODY_INJECT -->\n${buildHomeBodyInject()}\n    <!-- /SEO_BODY_INJECT -->`,
          )
          .replace(
            NOSCRIPT_MARKER,
            `<!-- SEO_NOSCRIPT_INJECT -->\n      ${buildHomeNoscript()}\n    <!-- /SEO_NOSCRIPT_INJECT -->`,
          ),
        env,
      );
    },
  };
}
