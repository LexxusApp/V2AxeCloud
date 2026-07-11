/** Bump ao atualizar PNGs em public/screenshots (tour, hero, apps). */
export const LANDING_SCREENSHOT_VERSION = '20260711';

export function landingScreenshot(file: string): string {
  const name = file.replace(/^\/?screenshots\//, '');
  return `/screenshots/${name}?v=${LANDING_SCREENSHOT_VERSION}`;
}

export function landingBrandLogo(): string {
  return `/logo-topo-matriz.png?v=${LANDING_SCREENSHOT_VERSION}`;
}
