export type LoadingVariant='page'|'list'|'cards'|'form'|'conversation'|'document'|'inline';
export function pageLoadingVariant(route=''):LoadingVariant{
 if(/config|settings|perfil|profile|subscription|suporte/.test(route))return 'form';
 if(/chat/.test(route))return 'conversation';
 if(/cantina|gallery|library|store|inventory/.test(route))return 'cards';
 if(/children|mensal|mural|notice|obrig|frequencia|calendar/.test(route))return 'list';
 return 'page';
}
export default function PageLoading({label='Carregando informações…',route,variant=pageLoadingVariant(route)}:{label?:string;route?:string;variant?:LoadingVariant}){
 return <section className={`axe-loading axe-loading--${variant}`} role="status" aria-busy="true" aria-label={label}><span className="axe-loading-caption"><i aria-hidden="true"/>{label}</span><div className="axe-loading-content" aria-hidden="true">
 {variant==='inline'?<div className="axe-loading-lines"><i/><i/><i/></div>:variant==='document'?<div className="axe-loading-paper"><i/><i/><i/><i/><i/><i/></div>:variant==='conversation'?<div className="axe-loading-conversation"><div>{[0,1,2,3].map(key=><div className="axe-loading-contact" key={key}><i/><span><i/><i/></span></div>)}</div><div className="axe-loading-thread"><i/><i/><i/><span/></div></div>:<>
 {variant!=='form'&&<div className="axe-loading-metrics">{[0,1,2].map(key=><div key={key}><i/><span/><span/></div>)}</div>}
 <div className="axe-loading-surface"><div className="axe-loading-toolbar"><i/><i/></div>{variant==='form'?<div className="axe-loading-fields">{[0,1,2,3,4,5].map(key=><div key={key}><i/><span/></div>)}<i className="axe-loading-submit"/></div>:variant==='cards'?<div className="axe-loading-cards">{[0,1,2].map(key=><div key={key}><i/><span/><span/></div>)}</div>:<div className="axe-loading-rows">{[0,1,2,3,4].map(key=><div key={key}><i/><span/><span/></div>)}</div>}</div></>}
 </div></section>;
}
