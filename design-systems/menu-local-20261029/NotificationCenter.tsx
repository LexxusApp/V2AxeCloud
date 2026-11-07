import {useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {Check,CheckCheck,ChevronRight,LoaderCircle,MessageCircle,X} from 'lucide-react';
import './notification-center.css';
export type HouseNotification={id:string;title:string;description:string;time:string;tab:string;read:boolean};
type ChatAlert={id:string;title:string;body:string;count:number;date?:string|null};
type Props={open:boolean;onOpenChange:(open:boolean)=>void;notifications:HouseNotification[];chatAlerts:ChatAlert[];chatError?:string;onRefreshChat:()=>void;onRead:(ids:string[])=>Promise<void>;onNavigate:(tab:string)=>void;onOpenConversation:(id:string)=>void;focus?:{onOpenAutoFocus:()=>void;onCloseAutoFocus:(event:Event)=>void}};
export default function NotificationCenter(p:Props){
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),lock=useRef(false);
 const unreadNotices=p.notifications.filter(row=>!row.read),unread=unreadNotices.length+p.chatAlerts.length;
 async function read(ids:string[],key:string,then:()=>void){
  if(lock.current||!ids.length)return;lock.current=true;setBusy(key);setError('');
  try{await p.onRead(ids);then();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível confirmar a leitura. Tente novamente.');}
  finally{lock.current=false;setBusy(null);}
 }
 return <Dialog.Root open={p.open} onOpenChange={open=>{if(!open&&!lock.current)setError('');p.onOpenChange(open);}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content {...p.focus} className="dialog notice-dialog"><div className="dialog-heading"><Dialog.Title>Notificações</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Fechar notificações"><X size={20}/></button></Dialog.Close></div><Dialog.Description>{unread?`${unread} ${unread===1?'notificação não lida':'notificações não lidas'} da sua casa.`:'Nenhuma notificação não lida da sua casa.'}</Dialog.Description>
 {error&&<p className="notice-read-error" role="alert">{error}</p>}
 <div className="chat-alerts">{p.chatError&&<p role="status">{p.chatError}<button className="text-button" onClick={p.onRefreshChat}>Tentar novamente</button></p>}{p.chatAlerts.map(alert=><button key={alert.id} className="notice-row" onClick={()=>{p.onOpenChange(false);p.onOpenConversation(alert.id);}}><MessageCircle size={20}/><span><strong>{alert.title} · {alert.count} {alert.count===1?'mensagem não lida':'mensagens não lidas'}</strong><p>{alert.body}</p><time dateTime={alert.date||undefined}>{alert.date?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(alert.date)):''}</time></span><ChevronRight size={17}/></button>)}</div>
 {unreadNotices.length>0&&<button className="text-button read-all" disabled={busy!==null} aria-busy={busy==='all'} onClick={()=>void read(unreadNotices.map(row=>row.id),'all',()=>p.onOpenChange(false))}>{busy==='all'?<LoaderCircle className="notice-read-spinner" size={16}/>:<CheckCheck size={16}/>}<span role={busy==='all'?'status':undefined}>{busy==='all'?'Marcando avisos…':'Marcar avisos como lidos'}</span></button>}
 {p.notifications.map(row=><div key={row.id} className={`notice-item ${row.read?'read':''}`}><button className={`notice-row ${row.read?'read':''}`} disabled={busy!==null} aria-busy={busy===`open-${row.id}`} onClick={()=>{const open=()=>{p.onOpenChange(false);p.onNavigate(row.tab);};if(row.read)open();else void read([row.id],`open-${row.id}`,open);}}><span className="notice-point"/><span><strong>{row.title}</strong><p>{row.description}</p><time>{row.time}</time>{busy===`open-${row.id}`&&<small role="status">Marcando como lida…</small>}</span><ChevronRight size={17}/></button>{!row.read&&<button className="notice-mark-one" disabled={busy!==null} aria-busy={busy===row.id} onClick={()=>void read([row.id],row.id,()=>{})}>{busy===row.id?<LoaderCircle className="notice-read-spinner" size={14}/>:<Check size={14}/>}<span role={busy===row.id?'status':undefined}>{busy===row.id?'Salvando leitura…':'Marcar como lida'}</span></button>}</div>)}
 {!p.notifications.length&&!p.chatAlerts.length&&!p.chatError&&<p className="notice-empty" role="status">Nenhum aviso para acompanhar agora.</p>}
 </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
