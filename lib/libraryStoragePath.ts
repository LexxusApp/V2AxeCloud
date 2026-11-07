/** Extract only the object key; legacy public/signed links never bypass current authorization. */
export function libraryStoragePath(raw: string): string | null {
  try {
    const url = new URL(raw, 'https://library.invalid');
    if (url.pathname === '/api/v1/library/pdf-proxy' || url.pathname === '/api/pilot/library/pdf-proxy') {
      return url.searchParams.get('path');
    }
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/biblioteca_estudos\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}
