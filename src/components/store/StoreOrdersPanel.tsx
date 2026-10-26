import React from 'react';
import { AppDemoCard } from '../ui/appDemoUi';

export type StoreOrderRow = {
  id: string; pedido_id?: string | null; created_at: string; filho_nome: string | null;
  tipo: string; metodo_pagamento: string; resumo_itens: string; valor_total: number;
  pedido?: { id: string; status: string; metodo_pagamento: string; total: number; checkout_id: string | null; financeiro_id: string | null } | null;
};
export function StoreOrdersPanel({ rows, loading, error, manager, busy, refresh, onPix, onAction }: {
  rows: StoreOrderRow[]; loading: boolean; error: string | null; manager: boolean; busy: string | null;
  refresh: () => void; onPix: (id: string) => void; onAction: (id: string, action: string, total: number) => void;
}) {
  const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  const labels: Record<string,string>={reservado:'Reservado · sem débito',pendente:'Aguardando pagamento',pago:'Pago',entregue:'Entregue',cancelado:'Cancelado'};
  return <AppDemoCard className="mt-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold text-[#1D211B]">{manager ? 'Pedidos da loja' : 'Meus pedidos'}</h3><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={refresh} disabled={loading}>Atualizar pedidos</button></div>
    <p className="text-xs text-[#6F6A60]">Reservas não geram débito. Pix e compras na caderneta ficam pendentes até a confirmação do responsável.</p>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {loading ? <p role="status">Carregando pedidos…</p> : !rows.length ? <p className="text-sm text-[#6F6A60]">Nenhum pedido registrado ainda.</p> : <ul className="max-h-[500px] space-y-3 overflow-y-auto">
      {rows.map(row=>{
        const order=row.pedido, modern=Boolean(order?.id), total=Number(order?.total ?? row.valor_total);
        return <li key={row.id} className="rounded-lg border border-[#E5DECF] bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2"><strong>{row.filho_nome || 'Venda avulsa'}</strong><time className="text-xs text-[#6F6A60]">{new Date(row.created_at).toLocaleString('pt-BR')}</time></div>
          <p className="my-2 break-words text-sm">{row.resumo_itens}</p>
          <div className="flex flex-wrap justify-between gap-2"><strong>{money(total)}</strong><span className="text-sm">{modern ? labels[order!.status] || order!.status : 'Pedido anterior · revisar no financeiro'}</span></div>
          {modern && order?.status === 'pendente' && order.metodo_pagamento === 'pix' ? <button disabled={Boolean(busy)} onClick={()=>onPix(order.id)} className="mt-3 min-h-11 rounded-lg border px-3 text-sm font-bold">Ver QR Code Pix</button> : null}
          {manager && modern && order ? <div className="mt-3 flex flex-wrap gap-2">
            {order.status === 'pendente' ? <button disabled={Boolean(busy)} onClick={()=>onAction(order.id,'confirmar',total)} className="min-h-11 rounded-lg bg-[#153D2D] px-3 text-sm font-bold text-white">Confirmar recebimento</button> : null}
            {order.status === 'reservado' ? <>
              <button disabled={Boolean(busy)} onClick={()=>onAction(order.id,'converter_pix',total)} className="min-h-11 rounded-lg border px-3 text-sm">Vender por Pix</button>
              <button disabled={Boolean(busy)} onClick={()=>onAction(order.id,'converter_mensalidade',total)} className="min-h-11 rounded-lg border px-3 text-sm">Anotar na caderneta</button>
              <button disabled={Boolean(busy)} onClick={()=>onAction(order.id,'converter_dinheiro',total)} className="min-h-11 rounded-lg border px-3 text-sm">Receber em dinheiro</button>
            </> : null}
            {(['pendente','reservado'].includes(order.status) || (total===0 && order.status==='pago')) ? <button disabled={Boolean(busy)} onClick={()=>onAction(order.id,'cancelar',total)} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm text-red-700">Cancelar pedido</button> : null}
            {['pago','entregue'].includes(order.status) && order.financeiro_id ? <button disabled={Boolean(busy)} onClick={()=>onAction(order.id,'estornar',total)} className="min-h-11 rounded-lg border px-3 text-sm">Estornar baixa</button> : null}
          </div> : null}
        </li>;
      })}
    </ul>}
  </AppDemoCard>;
}
