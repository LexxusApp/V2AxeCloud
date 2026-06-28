/** Perfis oficiais AxéCloud — usados no rodapé, JSON-LD (sameAs) e SEO. */
export const SOCIAL_HANDLE = 'axecloudoficial' as const;

export const SOCIAL_LINKS = [
  {
    id: 'instagram',
    label: 'Instagram',
    href: `https://www.instagram.com/${SOCIAL_HANDLE}/`,
    /** Ajuda buscadores a associar o site ao perfil. */
    rel: 'me noopener noreferrer',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    href: `https://www.tiktok.com/@${SOCIAL_HANDLE}`,
    rel: 'me noopener noreferrer',
  },
] as const;

/** URLs para schema.org Organization.sameAs */
export const SOCIAL_SAME_AS: readonly string[] = SOCIAL_LINKS.map((s) => s.href);

/** Inclui GBP quando `VITE_GOOGLE_BUSINESS_PROFILE_URL` estiver no .env (build Vite). */
export function buildOrganizationSameAs(
  env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>,
): string[] {
  const gbp = String(env.VITE_GOOGLE_BUSINESS_PROFILE_URL || '').trim();
  const urls = [...SOCIAL_SAME_AS];
  if (gbp && !urls.includes(gbp)) urls.push(gbp);
  return urls;
}
