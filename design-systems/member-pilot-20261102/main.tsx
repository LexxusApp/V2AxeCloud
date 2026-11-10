import ManagementAccess from './ManagementAccess';
import '../shared/page-loading.css';
declare const __PILOT_BUILD_ID__: string;
import React,{lazy,Suspense,useEffect,useRef,useState,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowRight,BookOpen,CalendarDays,ChevronRight,Flame,HelpCircle,Home,Images,LogOut,Menu,Megaphone,MessageCircle,MoreHorizontal,PanelLeftClose,PanelLeftOpen,Search,ShoppingBag,UserRound,Wallet,X} from 'lucide-react';
import {memberSession} from './session';
import {memberTab,memberTabFromLocation,matchesMemberTab,type MemberTab} from './navigation';
import {Modal,Loading,Empty,SearchBox} from './ui';
import {supabase} from '../../src/lib/supabase';
import {endPilotSession} from '../../lib/pilotLogout';
import {initPilotPwa} from '../shared/initPilotPwa';
import PwaInstallAction from '../shared/PwaInstallAction';
import Avatar from './Avatar';
import NotificationPanel from '../../src/components/NotificationPanel';
import {ConfirmActionDialog} from '../../src/components/app/ConfirmActionDialog';
import {HouseToastHost} from '../../src/components/app/HouseToastHost';
import {LocalFeedbackProvider} from '../menu-local-20261029/LocalFeedback';
import PilotUpdateBanner from '../shared/PilotUpdateBanner';
import './base.css';
import './member.css';

function refreshAfterChunkFailure(scope:string){
 if(typeof window==='undefined')return false;
 const key=`axe_chunk_refresh_${scope}`;
 const last=Number(sessionStorage.getItem(key)||0);
 if(Date.now()-last<=30_000)return false;
 sessionStorage.setItem(key,String(Date.now()));
 const target=new URL(window.location.href);
 target.searchParams.set('__axe_refresh',Date.now().toString(36));
 window.location.replace(`${target.pathname}${target.search}${target.hash}`);
 return true;
}
if(typeof window!=='undefined'){
 const current=new URL(window.location.href);
 if(current.searchParams.has('__axe_refresh')){
  current.searchParams.delete('__axe_refresh');
  window.history.replaceState(window.history.state,'',`${current.pathname}${current.search}${current.hash}`);
 }
 window.addEventListener('vite:preloadError',event=>{event.preventDefault();refreshAfterChunkFailure('preload');});
}
function safeLazy<T extends React.ComponentType<any>>(factory:()=>Promise<{default:T}>){
 return lazy(async()=>{try{return await factory();}catch(error:any){
  const message=error?.message||String(error);
  const isChunkError=message.includes('dynamically imported module')||message.includes('Loading chunk')||message.includes('Failed to fetch');
  if(isChunkError&&refreshAfterChunkFailure(window.location.hash||'root'))return new Promise<{default:T}>(()=>{});
  throw error;
 }});
}
const HomePage=safeLazy(()=>import('./Home')),Profile=safeLazy(()=>import('./Profile')),Obligations=safeLazy(()=>import('./Obligations')),Gallery=safeLazy(()=>import('./Gallery'));
const Monthly=safeLazy(()=>import('../../src/views/MensalidadeFilho')),Calendar=safeLazy(()=>import('../../src/views/Calendar')),Library=safeLazy(()=>import('../../src/views/Library')),Store=safeLazy(()=>import('../../src/views/Store')),Notices=safeLazy(()=>import('../../src/views/NoticeBoard')),Chat=safeLazy(()=>import('./ChatInbox'));
const links=[{id:'home',label:'Meu início',icon:Home},{id:'calendar',label:'Giras e encontros',icon:CalendarDays},{id:'obrigacoes',label:'Minha caminhada',icon:Flame},{id:'financial',label:'Minhas contribuições',icon:Wallet},{id:'library',label:'Biblioteca de estudos',icon:BookOpen},{id:'mural',label:'Comunicados',icon:Megaphone},{id:'gallery',label:'Memórias da casa',icon:Images},{id:'store',label:'Loja da casa',icon:ShoppingBag},{id:'chat',label:'Conversas',icon:MessageCircle},{id:'meu-perfil',label:'Meu perfil',icon:UserRound}] as const;
class Boundary extends React.Component<{children:ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}componentDidCatch(error:Error){const message=error?.message||String(error);if(message.includes('dynamically imported module')||message.includes('Loading chunk')||message.includes('Failed to fetch'))refreshAfterChunkFailure('member-boundary');}render(){return this.state.error?<Empty title="Atualização disponível" text="Uma nova versão do sistema foi disponibilizada. Atualize para continuar."><button className="mp-btn" onClick={()=>location.reload()}>Atualizar página</button></Empty>:this.props.children;}}
function Portal(){
 const session=memberSession(),{user,tenant}=session,[member,setMember]=useState(session.member),[tab,setTab]=useState<MemberTab>(()=>memberTabFromLocation(location)),[collapsed,setCollapsed]=useState(false),[drawer,setDrawer]=useState(false),[profileOpen,setProfileOpen]=useState(false),[searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState(''),[guide,setGuide]=useState(false),[offline,setOffline]=useState(navigator.onLine===false),[exiting,setExiting]=useState(false),[logoutError,setLogoutError]=useState('');
 const main=useRef<HTMLElement>(null),profileMenu=useRef<HTMLDivElement>(null);
 const navigate=(raw:string)=>{const next=memberTab(raw);if(location.hash!=='#'+next)location.hash=next;setTab(next);setDrawer(false);setSearchOpen(false);setProfileOpen(false);};
 useEffect(()=>{const hash=()=>{setTab(memberTabFromLocation(location));setDrawer(false);};window.addEventListener('hashchange',hash);return()=>window.removeEventListener('hashchange',hash);},[]);
 useEffect(()=>{document.title=`${links.find(link=>link.id===tab)?.label||'Meu espaço'} | AxéCloud`;const frame=requestAnimationFrame(()=>{main.current?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});return()=>cancelAnimationFrame(frame);},[tab]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true);}if(event.key==='Escape')setProfileOpen(false);};const connection=()=>setOffline(navigator.onLine===false);const outside=(event:PointerEvent)=>{if(!profileMenu.current?.contains(event.target as Node))setProfileOpen(false);};window.addEventListener('keydown',key);window.addEventListener('online',connection);window.addEventListener('offline',connection);document.addEventListener('pointerdown',outside);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);document.removeEventListener('pointerdown',outside);};},[]);
 async function logout(){if(exiting)return;setExiting(true);setLogoutError('');try{await endPilotSession({request:fetch,endAuth:()=>supabase.auth.signOut({scope:'local'}),navigate:()=>location.replace('/entrar')});}catch{setLogoutError('Não foi possível encerrar o acesso. Tente novamente.');setExiting(false);}}
 const menu=(mobile=false)=><><a className="mp-brand" href="#home" onClick={()=>navigate('home')}><img src="/assets/member-pilot-20261102/trident-cropped.png" alt=""/><span>Axé<span>Cloud</span></span></a><div className="mp-nav-house"><strong>{tenant.nome||tenant.nome_terreiro||'Minha casa'}</strong></div><ManagementAccess/><nav aria-label={mobile?'Menu do membro no celular':'Menu do membro'}><p>Minha casa</p>{links.filter(link=>link.id!=='meu-perfil').map(({id,label,icon:Icon})=><a key={id} href={'#'+id} title={collapsed&&!mobile?label:undefined} aria-current={tab===id?'page':undefined} onClick={event=>{event.preventDefault();navigate(id);}}><Icon size={20}/><span>{label}</span>{tab===id&&<i/>}</a>)}<p>Minha conta</p><a href="#meu-perfil" aria-current={tab==='meu-perfil'?'page':undefined} onClick={event=>{event.preventDefault();navigate('meu-perfil');}}><UserRound size={20}/><span>Meu perfil</span></a><PwaInstallAction/><button onClick={()=>{setDrawer(false);setGuide(true);}}><HelpCircle size={20}/><span>Como usar meu espaço</span></button><button onClick={()=>void logout()} disabled={exiting}><LogOut size={20}/><span>{exiting?'Saindo…':'Sair da conta'}</span></button></nav></>;
 const common={user,tenantData:tenant,setActiveTab:navigate};
 const view=tab==='home'?<HomePage navigate={navigate}/>:tab==='meu-perfil'?<Profile onUpdate={setMember} navigate={navigate}/>:tab==='obrigacoes'?<Obligations navigate={navigate}/>:tab==='financial'?<Monthly {...common}/>:tab==='calendar'?<Calendar {...common} userRole="filho"/>:tab==='library'?<Library user={user} userRole="filho" tenantData={tenant} isAdminGlobal={false} setActiveTab={navigate}/>:tab==='store'?<Store userRole="filho" userId={user.id} tenantData={tenant} setActiveTab={navigate} isAdminGlobal={false}/>:tab==='mural'?<Notices isAdmin={false} tenantData={tenant} setActiveTab={navigate}/>:tab==='gallery'?<Gallery/>:<Chat userId={user.id} userRole="filho" tenantData={tenant} setActiveTab={navigate}/>;
 return <div className={`member-pilot ${collapsed?'nav-collapsed':''}`}><a className="mp-skip" href="#member-content">Ir para o conteúdo</a><aside className="mp-sidebar">{menu()}</aside><div className="mp-main"><header className="mp-topbar"><a className="mp-mobile-brand" href="#home" onClick={()=>navigate('home')} aria-label="AxéCloud, meu início"><img src="/assets/member-pilot-20261102/trident-cropped.png" alt=""/></a><button className="mp-icon mp-desktop-toggle" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'Expandir menu':'Recolher menu'}>{collapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button><button className="mp-icon mp-mobile-toggle" onClick={()=>setDrawer(true)} aria-label="Abrir menu" aria-expanded={drawer}><Menu size={22}/></button><div className="mp-breadcrumb"><span>Meu espaço</span><ChevronRight size={14}/><strong>{links.find(link=>link.id===tab)?.label}</strong></div><div className="mp-topbar-actions"><button className="mp-icon mp-top-search" onClick={()=>setSearchOpen(true)} aria-label="Buscar uma área"><Search size={20}/><span>Buscar no meu espaço</span><kbd>Ctrl K</kbd></button><NotificationPanel tenantData={tenant} userId={user.id} userRole="filho" onNavigate={navigate} placement="inline" variant="dashboard"/><div className="mp-profile-menu" ref={profileMenu}><button className="mp-profile-trigger" aria-label="Abrir opções do meu perfil" aria-expanded={profileOpen} aria-controls="mp-profile-options" onClick={()=>setProfileOpen(!profileOpen)}><Avatar src={member.foto_url} name={member.nome} className="h-9 w-9"/></button>{profileOpen&&<div id="mp-profile-options" className="mp-profile-options"><strong>{member.nome}</strong><ManagementAccess/><button onClick={()=>navigate('meu-perfil')}><UserRound size={16}/>Meu perfil</button><button onClick={()=>{setGuide(true);setProfileOpen(false);}}><HelpCircle size={16}/>Como usar</button><button onClick={()=>void logout()} disabled={exiting}><LogOut size={16}/>{exiting?'Saindo…':'Sair da conta'}</button></div>}</div></div></header>{offline&&<p className="mp-offline" role="status">Você está sem conexão. Reconecte para atualizar os dados e enviar alterações.</p>}{logoutError&&<p className="mp-error" role="alert">{logoutError}</p>}<main id="member-content" className="mp-content" ref={main}><Boundary key={tab}><Suspense fallback={<Loading/>}>{view}</Suspense></Boundary></main><footer className="mp-footer"><span>AxéCloud · Seu espaço na casa</span><a href="/privacidade" target="_blank" rel="noreferrer">Privacidade</a></footer></div>
 <nav className="mp-mobile-dock" aria-label="Navegação rápida">{[{id:'home',label:'Início',icon:Home},{id:'calendar',label:'Giras',icon:CalendarDays},{id:'financial',label:'Contribuições',icon:Wallet},{id:'chat',label:'Conversas',icon:MessageCircle}].map(({id,label,icon:Icon})=><a key={id} href={'#'+id} aria-current={tab===id?'page':undefined} onClick={event=>{event.preventDefault();navigate(id);}}><Icon size={21}/><span>{label}</span></a>)}<button onClick={()=>setDrawer(true)} aria-label="Abrir todas as áreas"><MoreHorizontal size={22}/><span>Mais</span></button></nav>
 <Dialog.Root open={drawer} onOpenChange={setDrawer}><Dialog.Portal><Dialog.Overlay className="mp-drawer-overlay"/><Dialog.Content className="mp-drawer"><Dialog.Title className="mp-sr">Menu da minha casa</Dialog.Title><Dialog.Description className="mp-sr">Acesse seus encontros, contribuições, estudos e conversas.</Dialog.Description><Dialog.Close className="mp-drawer-close" aria-label="Fechar menu"><X size={21}/></Dialog.Close>{menu(true)}</Dialog.Content></Dialog.Portal></Dialog.Root>
 <Modal open={searchOpen} onClose={()=>setSearchOpen(false)} title="O que você precisa acessar?" text="Busque uma área do seu espaço."><SearchBox value={query} onChange={setQuery} placeholder="Giras, contribuição, estudos…"/><div className="mp-search-results">{links.filter(link=>matchesMemberTab(link.id,link.label,query)).map(({id,label,icon:Icon})=><button key={id} onClick={()=>{navigate(id);setQuery('');}}><Icon size={19}/>{label}<ArrowRight size={16}/></button>)}</div></Modal>
 <Modal open={guide} onClose={()=>setGuide(false)} title="Seu espaço, sem complicação." text="As rotinas da casa estão organizadas por assunto."><div className="mp-guide">{[{title:'Confirme sua presença',text:'Em Giras e encontros, escolha uma data e informe se vai participar.',target:'calendar',icon:CalendarDays},{title:'Acompanhe contribuições',text:'Consulte cada mensalidade, abra o Pix ou envie o comprovante para análise.',target:'financial',icon:Wallet},{title:'Estude no seu ritmo',text:'Na Biblioteca, encontre os materiais da casa e os reservados para você.',target:'library',icon:BookOpen},{title:'Converse com a casa',text:'Envie mensagens, fotos ou áudios nas Conversas.',target:'chat',icon:MessageCircle}].map(({title,text,target,icon:Icon})=><button key={target} onClick={()=>{setGuide(false);navigate(target);}}><Icon size={22}/><span><strong>{title}</strong><p>{text}</p></span><ArrowRight size={16}/></button>)}</div></Modal><ConfirmActionDialog/><HouseToastHost/></div>;
}
document.body.classList.add('member-pilot-body');
initPilotPwa();
createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion="user"><LocalFeedbackProvider><PilotUpdateBanner buildId={__PILOT_BUILD_ID__} versionUrl="/api/pilot/version"/><Portal/></LocalFeedbackProvider></MotionConfig>);
