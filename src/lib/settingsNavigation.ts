export const SETTINGS_NAVIGATION_EVENT = 'axecloud:settings-navigation';
export type SettingsDestination = { section: 'profile' | 'whatsapp'; view?: 'automacoes' | 'historico' };
export function openSettingsDestination(destination: SettingsDestination, navigate: (tab: string) => void) {
  try {
    sessionStorage.setItem('axecloud:settings-section', destination.section);
    if (destination.view) sessionStorage.setItem('axecloud:whatsapp-view', destination.view);
  } catch { /* The event still handles an already mounted settings page. */ }
  window.dispatchEvent(new CustomEvent(SETTINGS_NAVIGATION_EVENT, { detail: destination }));
  navigate('settings');
}
