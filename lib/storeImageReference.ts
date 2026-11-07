/** Persist storage object keys, never expiring signed links or private-bucket public URLs. */
export function storeImagePath(value:unknown):string|null {
  const raw=String(value||'').trim();if(!raw)return null;
  if(!/^https?:/i.test(raw))return raw.startsWith('/')?null:raw;
  try{const url=new URL(raw);if(url.hostname!=='vlaojhfwhqmwudqsumpi.supabase.co')return null;const match=url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/loja_imagens\/(.+)$/);return match?decodeURIComponent(match[1]):null;}catch{return null;}
}
