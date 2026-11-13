// Captura antes dos módulos e da validação de sessão, em desktop e celular.
export const earlyPwaCapture = `window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();window.__axecloudDeferredInstall=event;window.dispatchEvent(new Event('axecloud:beforeinstallprompt'));});window.addEventListener('appinstalled',function(){window.__axecloudDeferredInstall=null;});`;

export function pilotPwaPlugin() {
  return {name: 'pilot-pwa', transformIndexHtml() {return [
    {tag: 'script', children: earlyPwaCapture, injectTo: 'head-prepend'},
    {tag: 'link', attrs: {rel: 'apple-touch-icon', href: '/pwa-192.png'}, injectTo: 'head'},
    {tag: 'meta', attrs: {name: 'apple-mobile-web-app-capable', content: 'yes'}, injectTo: 'head'},
    {tag: 'meta', attrs: {name: 'mobile-web-app-capable', content: 'yes'}, injectTo: 'head'},
    {tag: 'meta', attrs: {name: 'apple-mobile-web-app-title', content: 'AxéCloud'}, injectTo: 'head'},
  ];}};
}
