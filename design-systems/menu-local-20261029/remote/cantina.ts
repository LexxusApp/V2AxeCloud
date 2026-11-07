import {sendAutomaticCantinaNotice} from './reminders';
import type { CantinaState, MenuProduct } from '../cantina';
import { registerLoader, registerWriter, ensureResource, refreshResource, readValue, publishValue } from './runtime';
import { previewSession, request, scoped } from './session';
import {supabase} from '../../../src/lib/supabase';
import {checked} from './helpers';
const icons:Record<string,MenuProduct['icon']>={'☕':'coffee','🥟':'snack','💧':'water','🍰':'cake','🕯':'ritual','🌿':'herb'};
const emoji:Record<MenuProduct['icon'],string>={coffee:'☕',snack:'🥟',water:'💧',cake:'🍰',ritual:'🕯',herb:'🌿'};
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
const pendingIds=new Map<string,string>();
registerLoader('cantina',async()=>{
  await ensureResource('finance');
  const [data,menu]=await Promise.all([request(scoped('/api/v1/cantina/data')),request(scoped('/api/v1/cantina/cardapio'))]);
  if(!Array.isArray(data.filhos)||!Array.isArray(menu.items))throw new Error('Resposta da cantina inválida.');
  publishValue('cantinaMenuRows',menu.items);
  const previous=readValue<CantinaState>('cantina');
  const names=new Map(data.filhos.map((row:any)=>[row.id,row.nome]));
  const sales=(readValue<any[]>('financeRows')||[]).filter(row=>row.categoria==='Cantina'&&['pendente','pago'].includes(row.status)).map(row=>{
    const items=Array.isArray(row.cantina_itens)?row.cantina_itens:[];
    const lines=items.length?items.map((item:any,i:number)=>({id:`${row.id}-${i}`,name:item.nome,cents:Math.round(Number(item.preco)*100),quantity:Number(item.quantidade)})):[{id:row.id,name:row.descricao||'Consumo registrado',cents:Math.round(Number(row.valor)*100),quantity:1}];
    const settled=row.status==='pago',createdAt=Date.parse(row.created_at||`${String(row.data_venda||row.data).slice(0,10)}T12:00:00-03:00`);
    return{id:row.id,code:row.id,memberId:row.filho_id||'',memberName:String(names.get(row.filho_id)||'Venda avulsa'),origin:row.filho_id?'book' as const:'counter' as const,lines,settled,createdAt,...(settled?{settledAt:Date.parse(`${String(row.data_pagamento||row.data).slice(0,10)}T12:00:00-03:00`),receiptId:row.id}:{})};
  });
  const state:CantinaState={products:[...menu.items.map((row:any)=>({id:row.id,name:row.nome,cents:Math.round(Number(row.preco)*100),icon:icons[row.icon]||'snack',category:row.cat,badge:row.badge||''})),...(previous?.products.filter(row=>row.transient)||[])],cart:previous?.cart||{},memberId:previous?.memberId||'',sales,receipts:sales.filter(row=>row.settled).map(row=>({id:row.id,code:row.id,saleIds:[row.id],memberId:row.memberId,memberName:row.memberName,cents:row.lines.reduce((sum,item)=>sum+item.cents*item.quantity,0),receivedAt:row.settledAt!,origin:row.origin})),preferences:Object.fromEntries(data.filhos.map((row:any)=>[row.id,{limitCents:Math.round(Number(row.limite_lojinha)*100),blocked:!!row.bloquear_fiado_loja}]))};
  publishValue('cantina',state);
});
registerWriter('cantina',async(next:CantinaState,before:CantinaState)=>{
  const tenantId=previewSession().tenantId;let automaticNoticeId='';
  const added=next.sales.filter(row=>!before.sales.some(old=>old.id===row.id));
  const settlements=next.sales.filter(row=>row.settled&&!before.sales.find(old=>old.id===row.id)?.settled&&!added.includes(row));
  const fixed=(state:CantinaState)=>state.products.filter(row=>!row.transient);
  const changedProducts=fixed(next).filter(row=>!same(row,fixed(before).find(old=>old.id===row.id)));
  const removed=fixed(before).filter(row=>!fixed(next).some(old=>old.id===row.id));
  const prefs=Object.entries(next.preferences||{}).filter(([id,pref])=>!same(pref,before.preferences?.[id]));
  if(added.length){
    if(added.length!==1)throw new Error('Registre uma comanda por vez.');
    const sale=added[0];if(!pendingIds.has(sale.id))pendingIds.set(sale.id,crypto.randomUUID());
    const result=await request('/api/v1/cantina/consumo','POST',{tenantId,filhoId:sale.memberId||null,formaPagamento:sale.settled?'pago':'fiado',comandaId:pendingIds.get(sale.id),itens:sale.lines.map(row=>({nome:row.name,quantidade:row.quantity,preco:row.cents/100}))});
    if(result.success!==true||!result.transaction?.id)throw new Error('O servidor não confirmou a comanda.');if(!sale.settled&&sale.memberId)automaticNoticeId=String(result.transaction.id);
  }else if(settlements.length){
    const members=new Set(settlements.map(row=>row.memberId));if(members.size!==1)throw new Error('Faça o acerto de um membro por vez.');
    const receipt=next.receipts.filter(row=>!before.receipts.some(old=>old.id===row.id));
    if(receipt.length!==1||!/^receipt-[0-9a-f-]{36}$/i.test(receipt[0].id))throw Error('Não foi possível identificar este recebimento.');
    const expected=settlements.map(row=>({id:row.id,valor:row.lines.reduce((sum,item)=>sum+item.cents*item.quantity,0)/100})),ids=expected.map(row=>row.id).sort(),totalCents=expected.reduce((sum,row)=>sum+Math.round(row.valor*100),0);
    if(!same([...receipt[0].saleIds].sort(),ids)||receipt[0].cents!==totalCents)throw Error('Confira as comandas e o total do recebimento.');
    const result:any=await checked(supabase.rpc('piloto_liquidar_cantina',{p_tenant:tenantId,p_filho:settlements[0].memberId,p_request:receipt[0].id.slice(8),p_transacoes:expected}));
    if(result.memberId!==settlements[0].memberId||result.status!=='pago'||result.count!==ids.length||Number(result.totalCents)!==totalCents||!Array.isArray(result.ids)||!same([...result.ids].sort(),ids))throw Error('O servidor não confirmou as comandas e o valor exato do acerto. Atualize antes de repetir.');
  }else if(changedProducts.length||removed.length){
    if(changedProducts.length+removed.length!==1)throw new Error('Salve um item por vez.');
    if(removed.length)await request(scoped(`/api/v1/cantina/cardapio/${encodeURIComponent(removed[0].id)}`),'DELETE');
    else{const row=changedProducts[0],old=before.products.find(item=>item.id===row.id),version=(readValue<any[]>('cantinaMenuRows')||[]).find(item=>item.id===row.id)?.updated_at;await request(`/api/v1/cantina/cardapio${old?`/${encodeURIComponent(row.id)}`:''}`,old?'PATCH':'POST',{tenantId,nome:row.name,preco:row.cents/100,icon:emoji[row.icon],cat:row.category,badge:row.badge,...(old?{expectedUpdatedAt:version}:{})});}
  }else if(prefs.length){if(prefs.length!==1)throw new Error('Salve um limite por vez.');const [filhoId,pref]=prefs[0];const result=await request('/api/v1/cantina/limite','PATCH',{tenantId,filhoId,limite_lojinha:pref.limitCents/100,bloquear_fiado_loja:pref.blocked});if(result.success!==true||result.filho?.id!==filhoId||Math.round(Number(result.filho.limite_lojinha)*100)!==pref.limitCents||result.filho.bloquear_fiado_loja!==pref.blocked)throw Error('O servidor não confirmou o limite e o bloqueio informados.');}
  else{publishValue('cantina',next);return;} // Only the unsent cart is client state.
  publishValue('cantina',{...before,cart:next.cart,memberId:next.memberId,products:[...before.products.filter(row=>!row.transient),...next.products.filter(row=>row.transient)]});
  if(added.length||settlements.length)await refreshResource('finance');await refreshResource('cantina');if(automaticNoticeId)void sendAutomaticCantinaNotice(automaticNoticeId);
});
