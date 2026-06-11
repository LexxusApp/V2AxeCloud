import { injectSiteVerificationHtml } from '../../src/constants/seoSearchConsole.js';

export type RuntimePublicConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  vapidPublicKey: string;
};

export function getRuntimePublicConfig(): RuntimePublicConfig {
  return {
    supabaseUrl: String(process.env.VITE_SUPABASE_URL || '').trim(),
    supabaseAnonKey: String(process.env.VITE_SUPABASE_ANON_KEY || '').trim(),
    vapidPublicKey: String(process.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
  };
}

export function injectRuntimeConfigHtml(html: string): string {
  const cfg = getRuntimePublicConfig();
  const script = `<script>window.__AXECLOUD_RUNTIME__=${JSON.stringify(cfg)};</script>`;
  let out = html;
  if (html.includes('<!-- RUNTIME_CONFIG_INJECT -->')) {
    out = html.replace('<!-- RUNTIME_CONFIG_INJECT -->', script);
  } else {
    out = html.replace('</head>', `${script}\n</head>`);
  }
  return injectSiteVerificationHtml(out);
}
