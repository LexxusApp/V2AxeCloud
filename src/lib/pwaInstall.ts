const STANDALONE_DISPLAY_MODES = [
  'standalone',
  'fullscreen',
  'minimal-ui',
  'window-controls-overlay',
] as const;

/** PWA instalado (atalho / app) — inclui modos do Chrome desktop e iOS Safari. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;

  if (
    STANDALONE_DISPLAY_MODES.some((mode) =>
      window.matchMedia(`(display-mode: ${mode})`).matches,
    )
  ) {
    return true;
  }

  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Chrome/Edge: manifest.id + getInstalledRelatedApps (quando disponível). */
export async function isInstalledRelatedWebApp(
  manifestId = 'https://axecloud.com.br/',
): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const api = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string; url?: string; platform?: string }>>;
  };
  if (typeof api.getInstalledRelatedApps !== 'function') return false;

  const normalizedId = manifestId.replace(/\/$/, '');

  try {
    const related = await api.getInstalledRelatedApps();
    return related.some((app) => {
      if (app.platform !== 'webapp') return false;
      // Só o próprio PWA está listado em related_applications; qualquer webapp
      // instalado retornado aqui é o AxéCloud. Ainda assim confirmamos por id/url.
      if (app.id === manifestId || app.id === normalizedId) return true;
      if (typeof app.url === 'string' && app.url.startsWith(normalizedId)) return true;
      return true;
    });
  } catch {
    return false;
  }
}
