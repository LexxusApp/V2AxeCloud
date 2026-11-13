import {loadingStyles,loadingMarkup} from './pilot-loading.js';
// This client hint only prevents a flash of the old screen. The signed-cookie
// endpoint remains the sole authority for selecting either private interface.
export function pilotBootstrap(ids,allowManagers=false) {
 return `(${pilotConnector})(${JSON.stringify({ids,allowManagers,styles:loadingStyles,markup:loadingMarkup})});`;
}
// Keep the connector as source text: Worker bundlers add closure helpers such as
// __name to real functions, which cannot survive Function.toString() in the page.
const pilotConnector=String.raw`function connectPilot({ids,allowManagers,styles,markup}) {
 const handoff='__axe_pilot_handoff';
 let last='',candidate='',failures=0,busy=false,cover=null,style=null;
 const release=()=>{cover?.remove();style?.remove();cover=style=null;};
 const feedback=(message,failed=false)=>{if(cover){cover.querySelector('#boot-status').textContent=message;cover.querySelector('#boot-progress').hidden=failed;cover.querySelector('#boot-recovery').hidden=!failed;}};
 const hold=()=>{
  if(cover)return;
  style=document.createElement('style');style.textContent='body{visibility:hidden!important}#axe-pilot-connecting,#axe-pilot-connecting *{visibility:visible!important}#axe-pilot-connecting{position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#f4f7f3}'+styles;document.head.append(style);
  cover=document.createElement('section');cover.id='axe-pilot-connecting';cover.innerHTML=markup;document.documentElement.append(cover);
  cover.querySelector('#boot-retry').onclick=event=>{event.preventDefault();last='';failures=0;void probe();};
 };
 async function probe(){
  const params=new URLSearchParams(location.search);
  if(busy||!location.pathname.startsWith('/dashboard')||params.has('classic')||params.has(handoff))return;
  let session;try{session=JSON.parse(localStorage.getItem('axecloud-auth-token')||'null');}catch{return;}
  const token=session?.access_token;
  if(!token||(!allowManagers&&!ids.includes(session?.user?.id))){release();return;}
  if(token!==candidate){candidate=token;failures=0;}
  if(token===last)return;
  if(failures>=3)return;
  hold();feedback('Conectando sua conta…');busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const explicitSpace=params.get('space');
   // An unqualified dashboard URL must not grant priority to the manager UI.
   // The verified backend decides: delegated member by default, owner stays manager.
   const targetSpace=explicitSpace==='member'?'member':explicitSpace==='manager'?'manager':'auto';
   const response=await fetch('/api/pilot/interface-access?space='+targetSpace,{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
   const result=await response.json();
   // A response for an abandoned account must not select the next account's UI.
   let active;try{active=JSON.parse(localStorage.getItem('axecloud-auth-token')||'null');}catch{return;}
   if(active?.access_token!==token||active?.user?.id!==session.user.id)return;
   if(response.ok){
    last=token;
    if(result.enabled){
     // Change the navigation URL so installed clients fetch the document with the new cookie.
     params.set(handoff,Date.now().toString(36));
     location.replace(location.pathname+'?'+params.toString()+(location.hash||''));
     return;
    }
    release();
   }
   else if(response.status===401||response.status===403){last=token;release();}
   else throw Error('access');
  }catch{failures++;feedback(failures<3?'Reconectando sua conta…':'Não foi possível conectar agora. Tente novamente.',failures>=3);}
  finally{clearTimeout(timer);busy=false;}
 }
 void probe();setInterval(probe,3000);window.addEventListener('storage',probe);
}`;
