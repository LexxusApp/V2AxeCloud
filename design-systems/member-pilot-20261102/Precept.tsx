import {useRef,useState} from 'react';
import {Check,Flame,MessageCircle} from 'lucide-react';
import {useRead,readJson} from './data';
import {ErrorBox,Modal,date} from './ui';
export function Precept({tenantId,navigate}:{tenantId:string;navigate:(tab:string)=>void}){
 const feed=useRead('/api/v1/preceitos/current?tenantId='+encodeURIComponent(tenantId)),cycle=feed.data?.data?.[0];
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 async function act(kind:'acknowledge'|'guidance'){if(!cycle||lock.current)return;lock.current=true;setBusy(true);setError('');try{await readJson(`/api/v1/preceitos/${encodeURIComponent(cycle.id)}/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId})});await feed.refresh();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível registrar.');}finally{lock.current=false;setBusy(false);}}
 if(feed.error)return <ErrorBox message="Não foi possível consultar as orientações de preceito." onRetry={()=>void feed.refresh()}/>;
 if(!cycle)return null;
 return <><section className="mp-precept"><Flame size={27}/><div><span>Preceito em andamento</span><h2>{cycle.titulo}</h2><p>Até {date(cycle.fim_em,true)}</p></div><button className="mp-btn secondary" onClick={()=>setOpen(true)}>Ver orientações</button></section><Modal open={open} onClose={()=>{if(!busy)setOpen(false);}} title={cycle.titulo} text={`De ${date(cycle.inicio_em,true)} até ${date(cycle.fim_em,true)}`}><p className="mp-prose">{cycle.orientacoes}</p>{error&&<ErrorBox message={error}/>}<div className="mp-actions"><button className="mp-btn" disabled={busy||cycle.participacao?.status==='ciente'} onClick={()=>void act('acknowledge')}><Check size={16}/>{busy?'Registrando…':cycle.participacao?.status==='ciente'?'Ciência registrada':'Li e estou ciente'}</button><button className="mp-btn secondary" disabled={busy||cycle.participacao?.status==='orientacao_solicitada'} onClick={()=>void act('guidance')}>{cycle.participacao?.status==='orientacao_solicitada'?'Orientação solicitada':'Pedir orientação'}</button><button className="mp-text-btn" onClick={()=>navigate('chat')}><MessageCircle size={16}/>Conversar com a casa</button></div></Modal></>;
}
