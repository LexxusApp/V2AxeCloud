import {runStartup} from '../menu-local-20261029/startup';
const stage=document.getElementById('boot-status')!,boot=document.getElementById('boot-screen')!;
document.getElementById('boot-retry')!.addEventListener('click',event=>{event.preventDefault();location.reload();});
const fail=(reason:unknown)=>{boot.setAttribute('aria-busy','false');document.getElementById('boot-progress')!.hidden=true;const message=document.getElementById('boot-error')!;message.textContent=navigator.onLine===false?'Você está sem conexão. Confira sua internet e tente novamente.':reason instanceof Error?reason.message:'Não foi possível abrir seu espaço.';message.hidden=false;document.getElementById('boot-recovery')!.hidden=false;};
void runStartup({
 async configure(signal){const response=await fetch('/api/public-config',{cache:'no-store',signal});if(!response.ok)throw Error('Não foi possível conectar à casa.');const config=await response.json();if(!config.supabaseUrl||!config.supabaseAnonKey)throw Error('A configuração de acesso não está disponível.');window.__AXECLOUD_RUNTIME__=config;},
 async connect(signal){const {connectMember}=await import('./session');return connectMember(signal);},
 mount:()=>import('./main'),
 onStage:value=>{stage.textContent=({config:'Conectando ao AxéCloud…',session:'Conferindo sua sessão…',access:'Validando seu acesso…',house:'Consultando sua casa…',opening:'Abrindo seu espaço…'})[value];},onError:fail,
});
