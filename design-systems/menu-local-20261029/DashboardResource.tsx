import PageLoading from '../shared/PageLoading';
import type {ReactNode} from 'react';
export type DashboardResourceState={ready:boolean;loading:boolean;error:string};
export function DashboardResource({states,resources,label,children,onRetry,className=''}:{states?:Record<string,DashboardResourceState>;resources:string[];label:string;children:ReactNode;onRetry?:(keys:string[])=>void;className?:string}){
 if(!states||resources.every(key=>states[key]?.ready))return <>{children}</>;
 const error=resources.some(key=>states[key]?.error);
 return <section className={`d-resource-placeholder ${className}`} aria-label={error?`${label} indisponível`:`Carregando ${label}`} aria-busy={!error} role={error?'alert':undefined}><span>{label}</span>{error?<><p>Não foi possível atualizar esta área.</p><button className="button secondary" onClick={()=>onRetry?.(resources)}>Tentar novamente</button></>:<PageLoading variant="inline" label={`Carregando ${label}`}/>}</section>;
}
