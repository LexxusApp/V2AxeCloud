declare const __AXECLOUD_BUILD_ID__: string;

/** Build do bundle JS em execução (fonte confiável — não muda se só o HTML for atualizado). */
export function getRunningBuildId(): string {
  if (typeof __AXECLOUD_BUILD_ID__ === 'string' && __AXECLOUD_BUILD_ID__) {
    return __AXECLOUD_BUILD_ID__;
  }
  const meta = document.querySelector('meta[name="axecloud-build"]')?.getAttribute('content')?.trim();
  if (meta) return meta;
  try {
    return localStorage.getItem('axecloud_running_build') || '';
  } catch {
    return '';
  }
}

export function persistRunningBuildId(buildId?: string): void {
  const id = (buildId || getRunningBuildId()).trim();
  if (!id) return;
  try {
    localStorage.setItem('axecloud_running_build', id);
  } catch {
    /* */
  }
}
