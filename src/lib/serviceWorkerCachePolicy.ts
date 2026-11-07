/** Kept self-contained: Workbox serializes this callback into sw.js. */
export function shouldCacheStaticAsset({ request, url, sameOrigin }: {
  request: Pick<Request, 'method' | 'mode' | 'destination' | 'headers' | 'cache'>;
  url: URL;
  sameOrigin: boolean;
}) {
  return sameOrigin && request.method === 'GET' && request.mode !== 'navigate'
    && request.cache !== 'no-store' && !request.headers.has('Authorization')
    && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/webhook/')
    && ['script', 'style', 'font', 'worker'].includes(request.destination);
}
