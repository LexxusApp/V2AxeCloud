// AxéCloud pilot granular authorization. Pure functions shared by edge checks
// and tests. Unknown administrative endpoints deny for delegated users.
export const PILOT_DELEGATION_TENANT='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
export const PILOT_MODULE_KEYS=['members','giras','finance','cantina','inventory','communications','gallery','library','store','radar'];
const MATCH=[
 ['members',/^\/api\/(?:children(?:\/|$)|v1\/children(?:\/|$)|whatsapp\/resend-dados-acesso(?:\/|$))/],
 ['giras',/^\/api\/(?:events(?:\/|$)|event-guests(?:\/|$)|v1\/(?:events|preceitos|participacoes|frequencia|giras)(?:\/|$))/],
 ['finance',/^\/api\/(?:transactions(?:\/|$)|v1\/(?:financial|financeiro)(?:\/|$))/],
 ['cantina',/^\/api\/v1\/cantina(?:\/|$)/],
 ['inventory',/^\/api\/(?:inventory(?:\/|$)|v1\/inventory(?:\/|$))/],
 ['communications',/^\/api\/(?:notices(?:\/|$)|notifications(?:\/|$)|v1\/chat(?:\/|$)|whatsapp\/(?:send|resend-dados-acesso|dispatch|status|history|logs)(?:\/|$)|push-(?:broadcast|direct)(?:\/|$))/],
 ['gallery',/^\/api\/v1\/gallery(?:\/|$)/],
 ['library',/^\/api\/(?:library(?:\/|$)|v1\/(?:library|fundamentos)(?:\/|$))/],
 ['store',/^\/api\/(?:store(?:\/|$)|loja-pedidos(?:\/|$)|v1\/store(?:\/|$))/],
 ['radar',/^\/api\/(?:v1\/radar(?:\/|$)|v1\/gestao\/radar(?:\/|$)|v1\/settings\/(?:directory-profile|directory-publicacoes|terreiro-servicos)(?:\/|$))/],
];
const OWNER_ONLY=[
 /^\/api\/(?:admin|admin-console|cron|webhooks|v1\/cron|v1\/account|v1\/subscription|v1\/settings|v1\/onboarding|v1\/founder-program)(?:\/|$)/,
 /^\/api\/(?:whatsapp\/(?:config|templates|connect|disconnect)|v1\/(?:financial|financeiro)\/(?:pix(?:-config)?|configuracoes-pix|subscription|billing))(?:\/|$)/,
];
const PERSONAL=[
 /^\/api\/v1\/(?:support|telemetry\/failure)(?:\/|$)/,
 /^\/api\/(?:v1\/filho|v1\/obrigacao-pdf|push-subscribe)(?:\/|$)/,
 /^\/api\/(?:auth\/|v1\/auth\/)/,
];
const PUBLIC=[
 /^\/api\/(?:ping|health|health-check|public-config|tenant-info|plans)(?:\/|$)/,
 /^\/api\/v1\/(?:public|landing|app-build)(?:\/|$)/,
 /^\/api\/metrics\/public-visit(?:\/|$)/,
];
export function classifyPilotDelegatedOperation(path,method='GET',body=undefined){
 const clean=String(path||'/').split('?')[0];
 if(clean==='/api/whatsapp/send'&&String(method).toUpperCase()==='POST'){
  const messageModules={dados_acesso:'members',cobranca_mensalidade:'finance',cobranca_cantina:'cantina',aviso_gira:'giras',aviso_obrigacao:'giras'};
  const module=messageModules[body?.tipo];
  if(module)return {type:'module',module,level:'gerenciar'};
 }
 const radarDirectory=MATCH.find(([key,re])=>key==='radar'&&re.test(clean));
 if(radarDirectory)return {type:'module',module:'radar',level:['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase())?'visualizar':'gerenciar'};
 if(OWNER_ONLY.some(re=>re.test(clean)))return {type:'blocked',reason:'Apenas o zelador titular pode acessar esta função.'};
 if(PERSONAL.some(re=>re.test(clean)))return {type:'personal'};
 if(PUBLIC.some(re=>re.test(clean)))return {type:'public'};
 const entry=MATCH.find(([,pattern])=>pattern.test(clean));
 if(!entry)return {type:'blocked',reason:'Esta função não está disponível para acessos delegados.'};
 return {type:'module',module:entry[0],level:['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase())?'visualizar':'gerenciar'};
}
export function grantAllows(permissions,module,level){
 if(!PILOT_MODULE_KEYS.includes(module)||!['visualizar','gerenciar'].includes(level))return false;
 const value=permissions&&typeof permissions==='object'&&!Array.isArray(permissions)?permissions[module]:null;
 return value==='gerenciar'||(level==='visualizar'&&value==='visualizar');
}
