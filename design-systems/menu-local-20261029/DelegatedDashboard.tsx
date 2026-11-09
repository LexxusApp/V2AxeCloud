import {ArrowRight,ShieldCheck,UserRound} from 'lucide-react';
import {COADMIN_MODULES,normalizeCoAdminPermissions} from './CoAdminPermissions';
const destinations:Record<string,string>={members:'children',giras:'calendar',finance:'financial',cantina:'financial-cantina',inventory:'inventory',communications:'mural',gallery:'gallery',library:'library',store:'store',radar:'radar'};
export default function DelegatedDashboard({permissions,house,onNavigate}:{permissions:unknown;house:string;onNavigate:(tab:string)=>void}){
 const grants=normalizeCoAdminPermissions(permissions);
 return <section className="cap-home">
  <header className="cap-home-heading"><ShieldCheck size={28}/><div><h1 tabIndex={-1}>Gestão da Casa</h1><p>{house}</p></div></header>
  <p className="cap-home-intro">Estas são as áreas liberadas pelo zelador para você ajudar na rotina da casa.</p>
  <div className="cap-home-areas">{COADMIN_MODULES.filter(module=>grants[module.key]).map(({key,label,description,icon:Icon})=><button key={key} type="button" className="cap-home-area" onClick={()=>onNavigate(destinations[key])}><Icon size={23}/><span><strong>{label}</strong><small>{description}</small><em>{grants[key]==='gerenciar'?'Pode consultar e gerenciar':'Somente consulta'}</em></span><ArrowRight size={18}/></button>)}</div>
  <a className="cap-home-return" href="/dashboard?space=member"><UserRound size={18}/>Voltar ao meu espaço de membro<ArrowRight size={16}/></a>
 </section>;
}
