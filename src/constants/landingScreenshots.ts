/** Bump ao atualizar PNGs em public/screenshots (tour, hero, apps). */
export const LANDING_SCREENSHOT_VERSION = '20260628';

export function landingScreenshot(file: string): string {
  const name = file.replace(/^\/?screenshots\//, '');
  return `/screenshots/${name}?v=${LANDING_SCREENSHOT_VERSION}`;
}
