/** Preserve links received through notifications, old URLs and copied tabs. */
export function managerTab(location:Pick<Location,'hash'|'search'>,allowed:readonly string[]):string{
 const raw=location.hash.slice(1).split('?')[0]||new URLSearchParams(location.search).get('tab')||'dashboard';
 const aliases:Record<string,string>={home:'dashboard',notices:'mural',messages:'chat',support:'suporte',attendance:'frequencia',monthly:'financial-mensalidades',cantina:'financial-cantina',pix:'financial-configs'};
 const resolved=aliases[raw]||raw;
 return allowed.includes(resolved)?resolved:'dashboard';
}
