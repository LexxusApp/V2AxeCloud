import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Check, CheckCheck, ChevronDown, CircleAlert, Clock3, LoaderCircle, Send, Upload, X } from 'lucide-react';
import { activityUsesPanel, fileTransferPercent, operations, operationPending, withOperation, type Activity, type FilePhase } from './operations';
import {createActivityAutoDismiss} from './activityLifecycle';
import './local-feedback.css';
import './operations.css';

type FeedbackApi = { change: (label: string, write: () => void | Promise<void>) => Promise<void> };
const FeedbackContext = createContext<FeedbackApi>({ change: async (label, write) => { const task = operations.begin(label); try { await withOperation(task, write); task.complete(); } catch(error) { task.fail(error); throw error; } } });
export const useLocalFeedback = () => useContext(FeedbackContext);
const InlineActivityContext=createContext<(resource:string)=>()=>void>(()=>()=>{});
const phases: Record<FilePhase,string> = { queued:'Na fila', preparing:'Preparando arquivo', uploading:'Enviando', confirming:'Transmitido; confirmando no servidor', done:'Salvo no sistema', error:'Falha' };
const deliveryNames = { queued:'Na fila', sending:'Enviando', accepted:'Aceito pelo WhatsApp', sent:'Enviado; entrega pendente', delivered:'Entregue', read:'Lido', failed:'Falhou', unknown:'Aguardando atualização' };
function ActivityRow({ activity, expandedFiles = false }: { activity: Activity; expandedFiles?: boolean }) {
 const percent = fileTransferPercent(activity.files), done = activity.files.filter(file => file.phase === 'done').length;
 const confirmedDelivery = activity.delivery && ['delivered','read'].includes(activity.delivery.status);
 const pending=operationPending(activity);
 const Icon = activity.state === 'error' ? CircleAlert : activity.delivery ? confirmedDelivery ? CheckCheck : Send : activity.state === 'done'&&!pending ? Check : activity.kind === 'upload' ? Upload : LoaderCircle;
 const label = activity.delivery ? deliveryNames[activity.delivery.status] : activity.state === 'error' ? 'Não concluído' : pending ? 'Em andamento' : 'Concluído';
 return <li className={`activity-row ${activity.state} ${activity.delivery && !confirmedDelivery ? 'delivery-pending' : ''}`}>
  <header><Icon size={18} aria-hidden="true"/><div><strong>{activity.title}</strong><span>{label}</span></div>{activity.state !== 'working' && <button type="button" aria-label={`Dispensar atividade: ${activity.title}`} onClick={() => operations.dismiss(activity.id)}><X size={17}/></button>}</header>
  <p>{activity.detail}</p>
  {activity.files.length > 0 ? <><div className="activity-file-summary"><strong>{done} de {activity.files.length} arquivos salvos</strong><span>{percent == null ? 'Transferência sem percentual disponível' : `${percent}% transmitido`}</span></div><progress max={100} value={percent} aria-label="Transferência dos arquivos"/>
    <details className="activity-file-details" open={expandedFiles || activity.files.some(file => file.phase === 'error') || undefined}><summary>Ver arquivos<ChevronDown size={15}/></summary><ol>{activity.files.map(file => <li key={file.id} className={file.phase}><span><strong>{file.name}</strong><small>{phases[file.phase]}{file.phase === 'uploading' && file.progress != null ? ` · ${Math.round(file.progress * 100)}%` : ''}</small></span>{file.phase === 'done' ? <Check size={16}/> : file.phase === 'error' ? <CircleAlert size={16}/> : <Clock3 size={16}/>}<progress max={100} value={file.progress == null ? undefined : file.progress * 100} aria-label={`Transferência de ${file.name}`}/>{file.message && <p>{file.message}</p>}</li>)}</ol></details></>
    : activity.state === 'working' && <progress aria-label="Aguardando confirmação da operação"/>}
  {activity.delivery && <a className="activity-history-link" href="#settings" onClick={() => window.dispatchEvent(new CustomEvent('axecloud-open-whatsapp-history'))}>Consultar histórico de disparos</a>}
 </li>;
}
function CompactActivity({activity,withPanel,onPointer,onFocus}:{activity:Activity;withPanel:boolean;onPointer:(active:boolean)=>void;onFocus:(active:boolean)=>void}) {
 const pending=operationPending(activity),Icon=activity.state==='error'?CircleAlert:pending?LoaderCircle:Check;
 const stateLabel=activity.state==='error'?'Não foi possível concluir':pending?'Em andamento':'Concluído';
 return <aside className={`local-activity ${activity.state} ${withPanel?'with-panel':''}`} role={activity.state==='error'?'alert':'status'} aria-live={activity.state==='error'?'assertive':'polite'} onPointerEnter={()=>onPointer(true)} onPointerLeave={()=>onPointer(false)} onFocusCapture={()=>onFocus(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))onFocus(false);}}>
  <div className="local-activity-copy"><Icon size={19} aria-hidden="true"/><span><strong>{activity.title}</strong><small>{stateLabel}{activity.detail&&activity.detail!=='Processando sua solicitação…'?` · ${activity.detail}`:''}</small></span>{activity.state!=='working'&&<button type="button" aria-label={`Dispensar aviso: ${activity.title}`} onClick={()=>operations.dismiss(activity.id)}><X size={17}/></button>}</div>
  {pending&&<div className="local-activity-track" aria-hidden="true"><span/></div>}
 </aside>;
}
export function useOperationBusy(resource: string) { return useSyncExternalStore(operations.subscribe,()=>operations.snapshot().some(row=>row.key===resource&&row.state==='working'),()=>false); }
export function OperationStatus({resource,since=0}:{resource:string;since?:number}) { const register=useContext(InlineActivityContext);useEffect(()=>register(resource),[resource,register]);const activity=useSyncExternalStore(operations.subscribe,()=>operations.snapshot().filter(row=>row.key===resource&&row.started>=since).at(-1),()=>undefined); return activity ? <ol className="inline-activity"><ActivityRow activity={activity} expandedFiles/></ol> : null; }
export function LocalFeedbackProvider({ children }: { children: ReactNode }) {
 const allActivities = useSyncExternalStore(operations.subscribe, operations.snapshot, operations.snapshot), [expanded,setExpanded] = useState(true), last = useRef(new Map<string,string>());
 const [inlineResources,setInlineResources]=useState<Record<string,number>>({});
 const registerInline=useCallback((resource:string)=>{setInlineResources(previous=>({...previous,[resource]:(previous[resource]||0)+1}));return()=>setInlineResources(previous=>({...previous,[resource]:Math.max(0,(previous[resource]||1)-1)}));},[]);
 const visibleActivities=allActivities.filter(row=>row.key!=='notifications'&&!(row.key&&inlineResources[row.key]));
 const activities=visibleActivities.filter(activityUsesPanel),compactActivities=visibleActivities.filter(row=>!activityUsesPanel(row)),compactActivity=compactActivities.at(-1);
 const autoDismiss=useRef<ReturnType<typeof createActivityAutoDismiss>|null>(null),interaction=useRef({pointer:false,focus:false});
 useEffect(()=>{autoDismiss.current=createActivityAutoDismiss(operations);return()=>{autoDismiss.current?.stop();autoDismiss.current=null;};},[]);
 const pause=(kind:'pointer'|'focus',active:boolean)=>{interaction.current[kind]=active;autoDismiss.current?.setPaused(interaction.current.pointer||interaction.current.focus);};
 const running = activities.filter(row => row.state === 'working'||row.state!=='error'&&row.files.some(file=>!['done','error'].includes(file.phase))).length, failed = activities.filter(row => row.state === 'error').length, awaiting = activities.filter(row => row.state !== 'working' && row.delivery && operationPending(row)).length;
 useEffect(() => {let reveal=false;for(const row of activities){if(!last.current.has(row.id)||row.state==='error'&&last.current.get(row.id)!=='error')reveal=true;last.current.set(row.id,row.state);}if(reveal)setExpanded(true);},[activities]);
 useEffect(()=>{if(!activities.length){interaction.current={pointer:false,focus:false};autoDismiss.current?.setPaused(false);}},[activities.length]);
 useEffect(() => { const failed = (event: PromiseRejectionEvent) => { event.preventDefault(); if(!operations.handled(event.reason)) operations.begin('A ação não foi concluída').fail(event.reason); }; window.addEventListener('unhandledrejection', failed); return () => window.removeEventListener('unhandledrejection', failed); },[]);
 const change: FeedbackApi['change'] = async (label, write) => {
  const operation = operations.begin(label);
  try { await withOperation(operation, write); operation.complete(); }
  catch (reason) { const error = reason instanceof Error ? reason : new Error('A operação não foi confirmada. Confira os dados antes de tentar novamente.'); operation.fail(error); throw error; }
 };
 return <FeedbackContext.Provider value={{change}}><InlineActivityContext.Provider value={registerInline}>{children}{compactActivity&&<CompactActivity activity={compactActivity} withPanel={activities.length>0} onPointer={active=>pause('pointer',active)} onFocus={active=>pause('focus',active)}/>} {activities.length > 0 && <aside className="activity-center" aria-label="Atividades do sistema" onPointerEnter={()=>pause('pointer',true)} onPointerLeave={()=>pause('pointer',false)} onFocusCapture={()=>pause('focus',true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))pause('focus',false);}}><div className="activity-center-header"><button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="activity-center-list"><span><strong>Atividades</strong><small role="status">{running ? `${running} em andamento` : failed ? `${failed} com falha` : awaiting ? `${awaiting} aguardando entrega` : 'Operações recentes'}</small></span><ChevronDown size={18} className={expanded ? 'expanded' : ''}/></button>{activities.some(row => !operationPending(row)) && <button type="button" className="activity-clear" onClick={() => operations.clearFinished()} aria-label="Limpar atividades finalizadas"><CheckCheck size={18}/></button>}</div>{expanded && <ol id="activity-center-list" className="activity-center-list">{activities.slice().reverse().map(activity => <ActivityRow key={activity.id} activity={activity}/>)}</ol>}</aside>}</InlineActivityContext.Provider></FeedbackContext.Provider>;
}
