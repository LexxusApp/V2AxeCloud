/** Local opt-in never changes authentication, tenant or feature permissions. */
export function modernInterfaceEnabled(options: { development: boolean; released?: string; search?: string }): boolean {
  if (options.released === 'true') return true;
  return options.development && new URLSearchParams(options.search || '').get('interface') === 'modern';
}
