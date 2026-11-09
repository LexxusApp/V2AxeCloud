import { uploadSignedFile } from './uploads';
import { supabase } from '../../../src/lib/supabase';
import { previewSession,request,scoped } from './session';
import { publishValue,readValue,registerLoader,registerWriter,ensureResource,refreshResource } from './runtime';
import { equal,singleChange,tableRows,checked } from './helpers';
import type { LocalShop,ShopMethod } from '../shopLogic';
import { storeImagePath } from '../../../lib/storeImageReference';
const uploadedProductImages=new WeakMap<File,{tenantId:string;path:string}>();
registerLoader('shop',async()=>{
  await ensureResource('members');
  const credit=await checked(supabase.rpc('piloto_credito_loja',{p_tenant:previewSession().tenantId}));
  if(!credit||typeof credit!=='object'||Array.isArray(credit))throw Error('Os limites de compra não foram confirmados.');
  publishValue('storeCredits',credit);
  let [products,orders,rawProducts,deliveries]=await Promise.all([request(scoped('/api/v1/store/products')),tableRows('pedidos','*,itens_pedido(*,produtos(nome))'),tableRows('produtos'),tableRows('piloto_entregas_pedidos','*','pedido_id')]);
  if(!Array.isArray(products.data))throw new Error('Resposta do catálogo inválida.');
  // Repair only the authorized pilot's invalid public references. The existing API
  // signs private reads using its service account; browser storage access stays closed.
  const repairs=products.data.filter((row:any)=>storeImagePath(row.imagem_url)&&String(row.imagem_url).includes('/object/public/loja_imagens/'));
  if(repairs.length&&previewSession().tenantId==='fad75b91-d2eb-4805-b5a3-c19e8a073bed'&&(!previewSession().profile.is_co_admin||previewSession().profile.permissoes?.store==='gerenciar')){
    for(const row of repairs)await request(`/api/v1/store/products/${encodeURIComponent(row.id)}`,'PATCH',{tenantId:previewSession().tenantId,imagem_url:storeImagePath(row.imagem_url)});
    products=await request(scoped('/api/v1/store/products'));
  }
  const previous=readValue<LocalShop>('shop'),members=readValue<any[]>('members')||[];
  const known=new Set(products.data.map((row:any)=>row.id));
  for(const raw of rawProducts.filter(row=>!known.has(row.id))){let image=raw.imagem_url||'',path=storeImagePath(image);if(path){const signed=await supabase.storage.from('loja_imagens').createSignedUrl(path,3600);image=signed.error?'':signed.data.signedUrl;}products.data.push({...raw,imagem_url:image});}
  const rawById=new Map(rawProducts.map(row=>[row.id,row]));
  publishValue('shop',{cart:previous?.cart||{},cartId:previous?.cartId||crypto.randomUUID(),products:products.data.map((row:any)=>({id:row.id,name:row.nome,description:row.descricao||'',category:row.categoria||'Outros',cents:Math.round(Number(row.preco)*100),stock:Number(row.estoque_atual)||0,minimum:Number(row.estoque_minimo)||0,photo:row.imagem_url?{source:row.imagem_url,kind:'local'}:null,archived:!!rawById.get(row.id)?.deleted_at})),orders:orders.map(row=>({id:row.id,code:row.id,checkoutId:row.checkout_id||row.id,memberId:row.filho_id||null,memberName:members.find(member=>member.id===row.filho_id)?.name||'Venda avulsa',lines:(row.itens_pedido||[]).map((item:any)=>({productId:item.produto_id,name:item.produtos?.nome||'Produto registrado',cents:Math.round(Number(item.preco_unitario)*100),quantity:Number(item.quantidade)})),method:({dinheiro:'cash',pix:'pix',mensalidade:'book',reserva:'reserve'}as Record<string,ShopMethod>)[row.metodo_pagamento]||'pix',status:row.status==='pago'?'paid':row.status==='cancelado'?'cancelled':row.metodo_pagamento==='reserva'?'reserved':'pending',delivered:row.status!=='cancelado'&&(deliveries.find(item=>item.pedido_id===row.id)?.entregue??row.status==='entregue'),created:row.created_at,...(row.pago_em?{received:row.pago_em}:{})}))});
});
registerWriter('shop',async(next:LocalShop,before:LocalShop,operation)=>{
  const tenantId=previewSession().tenantId;
  if(!equal(next.orders,before.orders)){
    const {row,old,removed}=singleChange(next.orders,before.orders);if(removed)throw new Error('Use o cancelamento para manter o histórico do pedido.');
    if(!old){const result=await request('/api/v1/store/checkout','POST',{tenantId,userRole:'admin',checkoutId:row.checkoutId,filhoId:row.memberId,method:({cash:'dinheiro',pix:'pix',book:'mensalidade',reserve:'reserva'}as const)[row.method],items:row.lines.map(item=>({produto_id:item.productId,quantidade:item.quantity}))});if(result.success!==true||!result.order?.id)throw Error('O servidor não confirmou o pedido.');row.id=result.order.id;}
    else{
      if(row.delivered!==old.delivered){
        if(row.status!==old.status||row.method!==old.method)throw Error('Confirme a entrega separadamente do pagamento.');
        const result:any=await checked(supabase.rpc('piloto_marcar_entrega',{p_tenant:tenantId,p_pedido:row.id,p_entregue:row.delivered,p_antes:old.delivered}));
        if(result.id!==row.id||result.delivered!==row.delivered)throw Error('O servidor não confirmou a entrega.');await refreshResource('shop');return;
      }
      const action=row.status==='cancelled'?'cancelar':old.status==='paid'&&row.status==='pending'?'estornar':old.status==='reserved'&&row.method!==old.method?({cash:'converter_dinheiro',pix:'converter_pix',book:'converter_mensalidade',reserve:''}as const)[row.method]:row.status==='paid'?'confirmar':'';
      if(!action)throw new Error('Esta mudança não é aceita pelo serviço de pedidos.');
      const result=await request(`/api/v1/store/orders/${encodeURIComponent(row.id)}/action`,'POST',{tenantId,userRole:'admin',action});if(result.success!==true||result.order?.id!==row.id)throw Error('O servidor não confirmou a atualização do pedido.');
    }
    publishValue('shop',{...before,cart:next.cart,cartId:next.cartId});await refreshResource('finance');
  }else if(!equal(next.products,before.products)){
    const {row,old,removed}=singleChange(next.products,before.products);
    if(removed)throw Error('Arquive o produto para preservar os pedidos existentes.');
    if(old&&row.archived!==Boolean(old.archived)){const result:any=await checked(supabase.rpc('piloto_arquivar_produto',{p_tenant:tenantId,p_produto:row.id,p_arquivado:row.archived,p_antes:!!old.archived}));if(result.id!==row.id||result.archived!==row.archived)throw Error('O servidor não confirmou o arquivo do produto.');await refreshResource('shop');return;}
    let image=typeof row.photo?.source==='string'?(storeImagePath(row.photo.source)||row.photo.source):'';
    if(row.photo?.kind==='generated')throw new Error('Escolha uma foto real do produto para publicar.');
    if(row.photo?.source instanceof File){
      const file=row.photo.source;operation?.files([{id:row.id,name:file.name,bytes:file.size}]);operation?.file(row.id,{phase:'preparing'});
      const cached=uploadedProductImages.get(file);
      if(cached?.tenantId===tenantId){image=cached.path;operation?.file(row.id,{phase:'confirming',progress:1});}
      else{const upload=await request('/api/v1/store/product-image/upload-url','POST',{tenantId,fileName:file.name,contentType:file.type});await uploadSignedFile('loja_imagens',upload.path,upload.token,file,operation,row.id);image=upload.path;uploadedProductImages.set(file,{tenantId,path:image});}
      operation?.phase('Foto transmitida. Confirmando os dados do produto…');
    }
    const saved=await request(`/api/v1/store/products${old?`/${encodeURIComponent(row.id)}`:''}`,old?'PATCH':'POST',{tenantId,nome:row.name,descricao:row.description,categoria:row.category,preco:row.cents/100,estoque_atual:row.stock,estoque_minimo:row.minimum,imagem_url:image});if(saved.success!==true||!saved.data?.id||old&&saved.data.id!==row.id)throw Error('O servidor não confirmou o produto. Confira o catálogo antes de repetir.');row.id=String(saved.data.id);if(row.photo?.source instanceof File)operation?.file(row.id,{phase:'done',progress:1});
  }else{publishValue('shop',next);return;}
  await refreshResource('shop');
});
