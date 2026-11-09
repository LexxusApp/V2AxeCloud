import {useEffect,useMemo,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowRight,BookOpen,CalendarDays,Check,Eye,Image,Landmark,MapPin,MessageCircle,Package,ShieldCheck,ShoppingBag,UsersRound,Wallet,X} from 'lucide-react';
import './coadmin-permissions.css';

export const COADMIN_MODULES=[
 {key:'members',label:'Filhos de Santo',description:'Cadastros, fichas e dados dos membros',icon:UsersRound},
 {key:'giras',label:'Giras e obrigações',description:'Agenda, frequência, preceitos e preparações',icon:CalendarDays},
 {key:'finance',label:'Financeiro da casa',description:'Mensalidades, lançamentos e relatórios internos',icon:Wallet},
 {key:'cantina',label:'Cantina',description:'Cardápio, pedidos e movimentações da cantina',icon:ShoppingBag},
 {key:'inventory',label:'Almoxarifado',description:'Estoque e movimentações de materiais',icon:Package},
 {key:'communications',label:'Comunicados e mensagens',description:'Avisos e conversas da casa',icon:MessageCircle},
 {key:'gallery',label:'Galeria',description:'Álbuns e imagens da casa',icon:Image},
 {key:'library',label:'Biblioteca',description:'Materiais compartilhados e publicações',icon:BookOpen},
 {key:'store',label:'Loja',description:'Produtos e pedidos da loja',icon:Landmark},
 {key:'radar',label:'Radar AxéCloud',description:'Perfil e conteúdo público do terreiro',icon:MapPin},
] as const;
export type CoAdminModule=typeof COADMIN_MODULES[number]['key'];
export type AccessLevel='visualizar'|'gerenciar';
export type CoAdminPermissions=Partial<Record<CoAdminModule,AccessLevel>>;
export type CoAdminEntry={
 id?:string;filho_id:string;nome:string;email?:string|null;ativo:boolean;permissoes?:CoAdminPermissions;
 updated_at?:string;user_id?:string|null;
};

export function normalizeCoAdminPermissions(data:unknown):CoAdminPermissions{
 if(!data||typeof data!=='object'||Array.isArray(data))return {};
 const permissions:CoAdminPermissions={};
 for(const module of COADMIN_MODULES){
  const value=(data as Record<string,unknown>)[module.key];
  if(value==='visualizar'||value==='gerenciar')permissions[module.key]=value;
 }
 return permissions;
}
export function summarizeCoAdminPermissions(permissions:CoAdminPermissions){
 const count=Object.values(normalizeCoAdminPermissions(permissions)).length;
 return count===1?'1 área liberada':`${count} áreas liberadas`;
}

export function CoAdminPermissionsDialog({
 member,existing,busy=false,onClose,onSave,
}:{
 member:{id:string;name:string;email?:string}|null;
 existing?:CoAdminEntry|null;
 busy?:boolean;
 onClose:()=>void;
 onSave:(permissions:CoAdminPermissions,active:boolean)=>Promise<void>;
}){
 const [levels,setLevels]=useState<CoAdminPermissions>({});
 const [error,setError]=useState('');
 const [confirmRevoke,setConfirmRevoke]=useState(false);
 const submitting=useRef(false);
 const opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  setLevels(normalizeCoAdminPermissions(existing?.permissoes));
  setError('');
  setConfirmRevoke(false);
 },[member?.id,existing?.ativo,existing?.updated_at,existing?.permissoes]);
 const total=useMemo(()=>Object.keys(levels).length,[levels]);
 const manages=useMemo(()=>Object.values(levels).filter(v=>v==='gerenciar').length,[levels]);
 const active=existing?.ativo===true;
 const update=(key:CoAdminModule,value:'none'|AccessLevel)=>{
  setLevels(prev=>{
   const next={...prev};
   if(value==='none')delete next[key];
   else next[key]=value;
   return next;
  });
  setError('');
 };
 const submit=async(activeAccess:boolean)=>{
  if(busy||submitting.current)return;
  if(activeAccess&&total===0){setError('Escolha pelo menos uma área para conceder acesso.');return;}
  setError('');
  submitting.current=true;
  try{await onSave(levels,activeAccess);}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar as permissões.');}
  finally{submitting.current=false;}
 };
 return <Dialog.Root open={Boolean(member)} onOpenChange={open=>{if(!open&&!busy)onClose();}}>
  <Dialog.Portal>
   <Dialog.Overlay className="cap-overlay"/>
   <Dialog.Content className="cap-dialog" aria-describedby="cap-description" aria-busy={busy}
    onOpenAutoFocus={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}}
    onCloseAutoFocus={event=>{if(opener.current?.isConnected){event.preventDefault();opener.current.focus();}}}
    onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}}>
    <div className="cap-header">
     <div className="cap-heading">
      <span className="cap-heading-icon"><ShieldCheck size={23}/></span>
      <div>
       <Dialog.Title className="cap-title">{active?'Permissões de co-admin':'Conceder acesso de co-admin'}</Dialog.Title>
       <Dialog.Description id="cap-description" className="cap-subtitle">
        {member?.name||'Membro da casa'} · {member?.email||'Membro da corrente'}
       </Dialog.Description>
      </div>
     </div>
     <Dialog.Close asChild><button type="button" className="cap-close" disabled={busy} aria-label="Fechar permissões"><X size={20}/></button></Dialog.Close>
    </div>
    <div className="cap-body">
     <p className="cap-intro">Escolha as áreas que {member?.name?.split(' ')[0]||'este membro'} poderá acessar em <strong>Gestão da Casa</strong>.</p>
     <p className="cap-legend"><span><Eye size={16}/><strong>Visualizar</strong> permite consultar.</span><span><Check size={16}/><strong>Gerenciar</strong> permite fazer alterações.</span></p>
     <div className="cap-toolbar">
      <span>Área do sistema</span><span>Nível de acesso</span>
     </div>
     <div className="cap-modules">
      {COADMIN_MODULES.map(({key,label,description,icon:Icon})=>{
       const value=levels[key]||'none';
       return <div key={key} className={`cap-module ${value==='none'?'cap-disabled':'cap-enabled'}`}>
        <div className="cap-module-heading">
         <span className="cap-module-icon"><Icon size={19}/></span>
         <div className="cap-module-copy"><strong>{label}</strong><span>{description}</span></div>
        </div>
        <div className="cap-module-controls" role="group" aria-label={`Permissão de ${label}`}>
         <label className={value==='none'?'selected':''}><input type="radio" disabled={busy} name={`cap-${key}`} checked={value==='none'} onChange={()=>update(key,'none')}/>Sem acesso</label>
         <label className={value==='visualizar'?'selected':''}><input type="radio" disabled={busy} name={`cap-${key}`} checked={value==='visualizar'} onChange={()=>update(key,'visualizar')}/><Eye size={13}/>Visualizar</label>
         <label className={value==='gerenciar'?'selected':''}><input type="radio" disabled={busy} name={`cap-${key}`} checked={value==='gerenciar'} onChange={()=>update(key,'gerenciar')}/><Check size={13}/>Gerenciar</label>
        </div>
       </div>;
      })}
     </div>
     <div className="cap-security"><ShieldCheck size={18}/><p><strong>Proteção do titular</strong> — assinatura do AxéCloud, exclusão da casa, alteração de titularidade e delegação a outros responsáveis não são transferíveis.</p></div>
    </div>
    <div className="cap-footer">
     <div className="cap-count" role="status"><strong>{summarizeCoAdminPermissions(levels)}</strong><span>{manages} com gerenciamento</span></div>
     {error&&<p className="cap-error" role="alert">{error}</p>}
     <div className="cap-actions">
      {active&&(!confirmRevoke?
       <button type="button" className="cap-revoke" disabled={busy} onClick={()=>setConfirmRevoke(true)}>Revogar acesso</button>:
       <button type="button" className="cap-revoke cap-revoke-confirm" disabled={busy} onClick={()=>void submit(false)}>Confirmar revogação</button>)}
      <button type="button" className="cap-cancel" disabled={busy} onClick={onClose}>Cancelar</button>
      <button type="button" className="cap-save" disabled={busy||total===0} onClick={()=>void submit(true)}>{busy?'Salvando…':active?'Salvar alterações':'Conceder acesso'}<ArrowRight size={15}/></button>
     </div>
     {confirmRevoke&&<p className="cap-revoke-note">A revogação remove as permissões administrativas, mas preserva o espaço de Filho de Santo.</p>}
    </div>
   </Dialog.Content>
  </Dialog.Portal>
 </Dialog.Root>;
}
