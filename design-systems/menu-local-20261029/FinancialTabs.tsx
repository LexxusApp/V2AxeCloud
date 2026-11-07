import type {LucideIcon} from 'lucide-react';
export default function FinancialTabs({items,selected,onSelect}:{items:{id:string;label:string;icon:LucideIcon}[];selected:string;onSelect:(id:string)=>void}){
 return <nav className="page-tabs financial-tabs" aria-label="Áreas do financeiro">{items.map(({id,label,icon:Icon})=><button key={id} type="button" aria-current={selected===id?'page':undefined} className={`financial-tab ${selected===id?'selected':''}`} onClick={()=>onSelect(id)}><Icon size={17} aria-hidden="true"/><span>{label}</span></button>)}</nav>;
}
