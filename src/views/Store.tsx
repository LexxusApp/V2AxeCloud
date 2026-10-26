import DataLoadError from '../components/DataLoadError';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { resolveStoreTenantPk } from '../lib/resolveStoreTenantPk';
import { ShoppingBag, Plus, Minus, Trash2, X, AlertCircle, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Toast from '@radix-ui/react-toast';
import { AppPageShell } from '../components/app/AppTopNav';
import { AppDemoPanelHeader, AppDemoCard, AppPrimaryButton } from '../components/ui/appDemoUi';
import { AxePageHeader, AxeMetricRail, AxeMetricCard, AxeButton, AxeCard } from '../components/shared/AxePageScaffold';
import FilhoStoreExperience from '../components/filho/FilhoStoreExperience';
import { confirmAction } from '../lib/confirmAction';
import PixPaymentModal, { type PixConfig } from '../components/PixPaymentModal';
import { StoreOrdersPanel, type StoreOrderRow } from '../components/store/StoreOrdersPanel';

// Campos dos modais (portais fora do escopo .app-v5-identity): tokens de papel explícitos.
const paperModalInputClass =
  'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

const paperModalLabelClass =
  'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';

export interface Product {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  estoque_atual: number;
  estoque_minimo: number;
  categoria: string;
  imagem_url: string;
}

interface CartItem extends Product {
  quantidade: number;
}

interface StoreProps {
  userRole: string;
  tenantData: any;
  userId: string;
  isAdminGlobal?: boolean;
  setActiveTab: (tab: string) => void;
}

export default function Store({ userRole, tenantData, userId, isAdminGlobal, setActiveTab }: StoreProps) {
  // Não-filhos são sempre gestores do terreiro (plano determina quais funções de gestão estão disponíveis).
  const isAdmin = userRole !== 'filho';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    nome: '', descricao: '', preco: 0, estoque_atual: 0, estoque_minimo: 0, categoria: 'Velas'
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '', type: 'success' });
  const [filhoId, setFilhoId] = useState<string | null>(null);
  const [filhoNome, setFilhoNome] = useState('');
  /** Compra (mensalidade/PIX) vs reserva — só para filho de santo no fluxo do carrinho. */
  const [intencaoLojaFilho, setIntencaoLojaFilho] = useState<'compra' | 'reserva'>('compra');
  const [lojaPedidos, setLojaPedidos] = useState<StoreOrderRow[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [pixOrder, setPixOrder] = useState<{ order: {id:string;total:number}; pix: PixConfig & { payload:string;txid:string } } | null>(null);
  const checkoutAttempt = useRef<{signature:string;id:string} | null>(null);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState('');
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);

  useEffect(() => {
    fetchProducts();
    if (userRole === 'filho') {
      fetchFilhoId();
    }

    if (isAdmin) {
      let channel: ReturnType<typeof supabase.channel> | null = null;
      const subscribeTimer = window.setTimeout(() => {
        channel = supabase.channel('custom-all-channel')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'produtos', filter: `tenant_id=eq.${tenantData.tenant_id}` },
            (payload) => {
              const newStock = payload.new.estoque_atual;
              const minStock = payload.new.estoque_minimo;
              const oldStock = payload.old.estoque_atual;

              if (newStock <= minStock && oldStock > minStock) {
                showToast(
                  'Estoque Baixo!',
                  `O produto "${payload.new.nome}" atingiu o estoque mínimo (${newStock} unidades).`,
                  'warning'
                );
              }
            }
          )
          .subscribe();
      }, 0);

      return () => {
        window.clearTimeout(subscribeTimer);
        if (channel) supabase.removeChannel(channel);
      };
    }
  }, [userRole, userId, tenantData.tenant_id]);

  const fetchLojaPedidos = async (tenantPk?: string | null) => {
    setLoadingPedidos(true);
    setOrdersError(null);
    try {
      const pk =
        tenantPk != null && String(tenantPk).trim() !== '' ? String(tenantPk).trim() : await resolveStoreTenantPk(storeTenantParams());
      if (!pk) {
        setLojaPedidos([]);
        return;
      }
      const response = await authFetch('/api/v1/store/orders?tenantId=' + encodeURIComponent(pk));
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.orders)) throw new Error('Não foi possível carregar os pedidos.');
      setLojaPedidos(body.orders);
    } catch {
      setOrdersError('Não foi possível carregar os pedidos. Use Atualizar pedidos para tentar novamente.');
    } finally {
      setLoadingPedidos(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let pedidosChannel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const pk = await resolveStoreTenantPk(storeTenantParams());
      if (cancelled || !pk) return;
      await fetchLojaPedidos(pk);
      if (cancelled) return;
      pedidosChannel = supabase
        .channel(`loja-pedidos-${pk}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'loja_pedidos', filter: `tenant_id=eq.${pk}` },
          () => {
            fetchLojaPedidos(pk);
          }
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (pedidosChannel) supabase.removeChannel(pedidosChannel);
    };
  }, [isAdmin, tenantData?.tenant_id, userId]);

  const fetchFilhoId = async () => {
    try {
      const pk=await resolveStoreTenantPk(storeTenantParams());
      if(!pk) return;
      const response=await authFetch('/api/v1/store/me?tenantId='+encodeURIComponent(pk));
      const data=await response.json();
      if(!response.ok || !data.memberId) throw new Error('Vínculo do membro não encontrado.');
      setFilhoId(data.memberId);setFilhoNome(data.memberName || '');
    }catch { setFilhoId(null); showToast('Perfil não carregado','Não foi possível identificar seu vínculo. Recarregue a página para comprar.','error'); }
  };

  const storeTenantParams = () => ({
    tenantIdFromContext: tenantData?.tenant_id,
    fallbackUserId: userId,
  });

  const rowToProduct = (row: Record<string, unknown>): Product => ({
    id: String(row.id),
    nome: String(row.nome ?? ''),
    descricao: String(row.descricao ?? ''),
    preco: Number(row.preco) || 0,
    estoque_atual: Number(row.estoque_atual) || 0,
    estoque_minimo: Number(row.estoque_minimo) || 0,
    categoria: String(row.categoria ?? ''),
    imagem_url: row.imagem_url != null ? String(row.imagem_url) : '',
  });

  const fetchProducts = async (opts?: { silent?: boolean; tenantPk?: string | null }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const tenantPk = opts?.tenantPk != null && String(opts.tenantPk).trim() !== '' ? String(opts.tenantPk).trim() : await resolveStoreTenantPk(storeTenantParams());
      if (!tenantPk) {
        setProducts([]);
        return;
      }
      const res = await authFetch(`/api/v1/store/products?tenantId=${encodeURIComponent(tenantPk)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao carregar produtos');
      } else {
        if (!Array.isArray(json.data)) throw new Error('Resposta de produtos inválida');
        const rows = json.data;
        const loaded = rows.map((r) => rowToProduct(r as Record<string, unknown>));
        setProducts(loaded);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setLoadError('Não foi possível carregar os produtos da loja. Tente novamente.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const uploadStoreProductImage = async (tenantPk: string, file: File): Promise<string> => {
    const mime = String(file.type || '').toLowerCase();
    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
    if (!allowed.has(mime)) {
      throw new Error('Selecione uma imagem JPG, PNG, WEBP ou GIF.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Imagem muito grande (máx. 10 MB).');
    }

    const uploadUrlResponse = await authFetch('/api/v1/store/product-image/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: mime,
        tenantId: tenantPk,
      }),
    });
    const uploadUrlResult = await uploadUrlResponse.json().catch(() => ({}));
    if (!uploadUrlResponse.ok) {
      throw new Error(uploadUrlResult.error || 'Erro ao preparar upload da imagem');
    }

    const { error: uploadError } = await supabase.storage
      .from('loja_imagens')
      .uploadToSignedUrl(uploadUrlResult.path, uploadUrlResult.token, file, {
        contentType: mime,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    return String(uploadUrlResult.path || '');
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantidade >= product.estoque_atual) {
          showToast('Estoque insuficiente', 'Não há mais unidades disponíveis.', 'error');
          return prev;
        }
        return prev.map(item =>
          item.id === product.id ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      return [...prev, { ...product, quantidade: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantidade + delta;
        if (newQuantity > item.estoque_atual) {
          showToast('Estoque insuficiente', 'Não há mais unidades disponíveis.', 'error');
          return item;
        }
        return newQuantity > 0 ? { ...item, quantidade: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantidade > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  }, [cart]);

  const cartQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantidade, 0);
  }, [cart]);

  const showToast = (title: string, description: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage({ title, description, type });
    setToastOpen(true);
  };

  const closeAddProductDialog = () => {
    setIsAddProductOpen(false);
    setProductImageFile(null);
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImagePreview('');
  };

  const handleCheckout = async (method: 'mensalidade' | 'pix' | 'reserva' | 'dinheiro') => {
    if (!cart.length || isCheckoutLoading) return;
    if (userRole === 'filho' && !filhoId) { showToast('Erro','Perfil de filho não encontrado.','error'); return; }
    const tenantPk = await resolveStoreTenantPk(storeTenantParams());
    if (!tenantPk) { showToast('Erro','Terreiro não carregado. Tente novamente.','error'); return; }
    const requestItems = cart.map(item=>({produto_id:item.id,quantidade:item.quantidade})).sort((a,b)=>a.produto_id.localeCompare(b.produto_id));
    const signature = JSON.stringify({tenantPk,filhoId: userRole === 'filho' ? filhoId : null,method,items:requestItems});
    const attemptKey = 'axecloud_store_checkout_' + tenantPk + '_' + userId;
    if (checkoutAttempt.current?.signature !== signature) {
      let saved: {signature:string;id:string} | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(attemptKey) || 'null'); } catch {}
      checkoutAttempt.current = saved?.signature === signature ? saved : {signature,id:crypto.randomUUID()};
      try { sessionStorage.setItem(attemptKey,JSON.stringify(checkoutAttempt.current)); } catch {}
    }
    setIsCheckoutLoading(true);
    try {
      const res = await authFetch('/api/v1/store/checkout',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({tenantId:tenantPk,filhoId:userRole === 'filho' ? filhoId : null,method,items:requestItems,checkoutId:checkoutAttempt.current!.id}),
      });
      const result=await res.json();
      if (!res.ok || !result.success || !result.order?.id) throw new Error(result.error || 'O pedido não foi confirmado. Seu carrinho foi mantido.');
      checkoutAttempt.current=null;
      try { sessionStorage.removeItem(attemptKey); } catch {}
      setCart([]); setIntencaoLojaFilho('compra'); setIsCartOpen(false);
      if(result.order.status === 'cancelado') showToast('Pedido cancelado','Esta tentativa corresponde a um pedido cancelado. Confira seus pedidos antes de comprar novamente.','warning');
      else if(method === 'pix' && result.order.status === 'pendente') {
        if(result.pix) setPixOrder({order:result.order,pix:result.pix});
        showToast('Pedido aguardando Pix',result.pix ? 'Pague pelo QR Code. A baixa será confirmada pelo responsável.' : 'Abra seus pedidos para consultar o Pix após a chave ser configurada.','success');
      } else showToast('Pedido confirmado',method === 'reserva' ? 'Reserva registrada sem gerar débito.' : method === 'mensalidade' ? 'Compra anotada uma única vez na caderneta.' : 'Venda recebida e registrada no financeiro.','success');
      window.dispatchEvent(new Event('axecloud:finance-updated'));
      await Promise.all([fetchProducts({silent:true,tenantPk}),fetchLojaPedidos(tenantPk)]);
    } catch(error: any) {
      showToast('Não foi possível concluir',error.message || 'Sua comanda foi mantida. Tente novamente.','error');
    } finally { setIsCheckoutLoading(false); }
  };

  const showOrderPix = async (id:string) => {
    setOrderBusy(id);
    try {
      const tenant=await resolveStoreTenantPk(storeTenantParams());
      const response=await authFetch('/api/v1/store/orders/' + id + '/pix?tenantId=' + encodeURIComponent(tenant || ''));
      const body=await response.json();
      if(!response.ok || !body.pix) throw new Error(body.error || 'Pix indisponível.');
      setPixOrder(body);
    } catch(error:any) { showToast('Pix indisponível',error.message,'error'); }
    finally { setOrderBusy(null); }
  };

  const actOnOrder = async (id:string,action:string,total:number) => {
    const texts: Record<string,{title:string;description:string}> = {
      confirmar:{title:'Confirmar recebimento?',description:'Confirme somente após conferir o crédito na conta ou receber o dinheiro. Valor: R$ ' + total.toFixed(2).replace('.',',') + '.'},
      cancelar:{title:'Cancelar pedido?',description:'O estoque reservado será liberado e o débito ainda em aberto será cancelado.'},
      estornar:{title:'Estornar a baixa?',description:'O débito será reaberto na caderneta. Esta ação não devolve dinheiro pelo banco; confira a devolução antes de estornar.'},
      converter_pix:{title:'Vender a reserva por Pix?',description:'A reserva vira uma compra pendente. O responsável confirma a baixa após receber o Pix.'},
      converter_mensalidade:{title:'Anotar a reserva na caderneta?',description:'A compra ficará pendente para o membro, respeitando seu limite compartilhado com a Cantina.'},
      converter_dinheiro:{title:'Receber a reserva em dinheiro?',description:'Confirme apenas após receber o dinheiro. A compra entrará no caixa como paga.'},
    };
    if(!texts[action] || !await confirmAction({...texts[action],confirmLabel:'Confirmar',tone:action === 'cancelar' ? 'danger' : 'primary'})) return;
    setOrderBusy(id);
    try {
      const tenant=await resolveStoreTenantPk(storeTenantParams());
      const response=await authFetch('/api/v1/store/orders/' + id + '/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:tenant,action})});
      const body=await response.json();
      if(!response.ok || !body.success) throw new Error(body.error || 'A alteração não foi confirmada.');
      showToast('Pedido atualizado','O estoque e o financeiro foram atualizados juntos.','success');
      window.dispatchEvent(new Event('axecloud:finance-updated'));
      await Promise.all([fetchProducts({silent:true,tenantPk:tenant}),fetchLojaPedidos(tenant)]);
      if(action === 'converter_pix') await showOrderPix(id);
    } catch(error:any) { showToast('Pedido não alterado',error.message,'error'); }
    finally { setOrderBusy(null); }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProduct) return;
    setIsSavingProduct(true);
    setIsUploadingProductImage(false);
    try {

    const nomeDoEstado = (newProduct.nome || '').trim();
    const descricaoDoEstado = String(newProduct.descricao ?? '').trim();
    const precoDoEstado = Number(newProduct.preco) || 0;
    const categoriaDoEstado = newProduct.categoria || 'Velas';
    const estoqueAtual = Number(newProduct.estoque_atual) || 0;
    const estoqueMinimo = Number(newProduct.estoque_minimo) || 0;
    if (!Number.isFinite(precoDoEstado) || precoDoEstado < 0 || Math.abs(precoDoEstado*100-Math.round(precoDoEstado*100))>0.000001 || !Number.isInteger(estoqueAtual) || estoqueAtual<0 || !Number.isInteger(estoqueMinimo) || estoqueMinimo<0) {
      showToast('Dados inválidos','Confira o preço e informe quantidades inteiras não negativas.','error'); return;
    }

    if (!nomeDoEstado) {
      showToast('Erro', 'Nome do produto é obrigatório.', 'error');
      setIsSavingProduct(false);
      return;
    }

    const idDoTerreiroLogado = await resolveStoreTenantPk(storeTenantParams());

    if (idDoTerreiroLogado == null || idDoTerreiroLogado === undefined || String(idDoTerreiroLogado).trim() === '') {
      console.error('[Store / Novo Produto] tenant_id ausente ou undefined', { tenantData, userId });
      showToast('Erro', 'Não foi possível identificar o terreiro.', 'error');
      setIsSavingProduct(false);
      return;
    }

    let imagemUrl: string | null = null;
    try {
      if (productImageFile) {
        setIsUploadingProductImage(true);
        imagemUrl = await uploadStoreProductImage(String(idDoTerreiroLogado), productImageFile);
      } else {
        const imgRes = await authFetch(
          `/api/store/product-image-suggestion?q=${encodeURIComponent(nomeDoEstado)}`
        );
        if (imgRes.ok) {
          const j = (await imgRes.json()) as { url?: string | null };
          const u = typeof j.url === 'string' ? j.url.trim() : '';
          if (u) imagemUrl = u;
        }
      }
    } catch (e) {
      console.warn('[Store] imagem do produto:', e);
      showToast('Erro', e instanceof Error ? e.message : 'Falha ao preparar imagem do produto.', 'error');
      setIsSavingProduct(false);
      setIsUploadingProductImage(false);
      return;
    }
    setIsUploadingProductImage(false);

    const resSave = await authFetch('/api/v1/store/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: idDoTerreiroLogado,
        nome: nomeDoEstado,
        descricao: descricaoDoEstado,
        preco: precoDoEstado,
        categoria: categoriaDoEstado,
        estoque_atual: estoqueAtual,
        estoque_minimo: estoqueMinimo,
        imagem_url: imagemUrl || '',
      }),
    });
    const saveJson = await resSave.json().catch(() => ({}));
    if (!resSave.ok) {
      showToast('Erro', saveJson.error || 'Erro ao salvar produto', 'error');
      setIsSavingProduct(false);
      return;
    }

    const inserted = saveJson.data as Record<string, unknown> | undefined;
    if (!inserted?.id) throw new Error('O servidor não confirmou o cadastro. Confira os produtos antes de tentar novamente.');
    const novoProduto = inserted ? rowToProduct(inserted) : null;

    showToast('Sucesso', 'Produto salvo com sucesso!', 'success');
    closeAddProductDialog();
    setNewProduct({ nome: '', descricao: '', preco: 0, estoque_atual: 0, estoque_minimo: 0, categoria: 'Velas' });

    if (novoProduto) {
      setProducts((prev) => {
        const rest = prev.filter((p) => p.id !== novoProduto.id);
        const merged = [...rest, novoProduto];
        merged.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        return merged;
      });
    }

    await fetchProducts({ silent: true, tenantPk: idDoTerreiroLogado });
    setIsSavingProduct(false);
    } catch (error: any) { showToast('Produto não salvo',error.message || 'Não foi possível salvar. Seu formulário foi mantido.','error'); }
    finally { setIsSavingProduct(false); setIsUploadingProductImage(false); }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!isAdmin) return;
    if (!(await confirmAction({ title: `Excluir “${product.nome}”?`, description: 'O produto deixará de aparecer na Loja do Axé. Esta ação não pode ser desfeita.', confirmLabel: 'Excluir produto', tone: 'danger' }))) return;

    setDeletingProductId(product.id);
    try {
      const tenantPk = await resolveStoreTenantPk(storeTenantParams());
      if (!tenantPk) {
        showToast('Erro', 'Terreiro não identificado.', 'error');
        return;
      }

      const delRes = await authFetch(
        `/api/v1/store/products/${encodeURIComponent(product.id)}?tenantId=${encodeURIComponent(tenantPk)}`,
        { method: 'DELETE' }
      );
      const delJson = await delRes.json().catch(() => ({}));
      if (!delRes.ok) {
        showToast('Erro', delJson.error || 'Falha ao excluir produto', 'error');
        return;
      }

      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setCart((prev) => prev.filter((item) => item.id !== product.id));
      showToast('Sucesso', 'Produto excluído da loja.', 'success');
      await fetchProducts({ silent: true, tenantPk });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao excluir produto.';
      showToast('Erro', msg, 'error');
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <Toast.Provider swipeDirection="right">
      <AppPageShell>
        <DataLoadError message={loadError} onRetry={() => void fetchProducts()} />
        {!isAdmin ? (
          <FilhoStoreExperience
            products={products}
            loading={loading}
            cartQuantity={cartQuantity}
            cartTotal={cartTotal}
            memberName={filhoNome}
            onOpenCart={() => setIsCartOpen(true)}
            onBuy={(product) => {
              setIntencaoLojaFilho('compra');
              addToCart(product);
            }}
            onReserve={(product) => {
              setIntencaoLojaFilho('reserva');
              addToCart(product);
              setIsCartOpen(true);
            }}
          />
        ) : (
        <div className="store-v5-page">
        <AxePageHeader
          theme="gold"
          kicker="ARTIGOS RELIGIOSOS & PRODUTOS DO TERREIRO"
          title="Loja da Casa"
          description={
            userRole === 'filho'
              ? 'Compre artigos religiosos com pagamento na mensalidade ou via Pix, ou reserve itens com o zelador.'
              : 'Artigos religiosos e insumos sagrados com baixa automática no estoque e controle de pedidos.'
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <AxeButton
                  variant="primary"
                  onClick={() => setIsAddProductOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Novo Produto
                </AxeButton>
              ) : null}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/45 bg-black/40 backdrop-blur-md px-4 py-2.5 text-xs font-black text-amber-200 transition hover:bg-black/60 hover:text-white hover:border-[#D4AF37]"
              >
                <ShoppingBag className="h-4 w-4 text-amber-300" />
                Carrinho
                {cart.length > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-[#080A0D]">
                    {cartQuantity}
                  </span>
                ) : null}
              </button>
            </div>
          }
        />

        <AxeMetricRail className="my-6">
          <AxeMetricCard
            label="Itens na Vitrine"
            value={products.length}
            icon={ShoppingBag}
            tone="neutral"
            subtext="Produtos cadastrados"
          />
          <AxeMetricCard
            label="Estoque Normal"
            value={products.filter((p) => p.estoque_atual > p.estoque_minimo).length}
            icon={CheckCircle2}
            tone="emerald"
            subtext="Prontos para venda"
          />
          <AxeMetricCard
            label="Estoque em Alerta"
            value={products.filter((p) => p.estoque_atual <= p.estoque_minimo).length}
            icon={AlertCircle}
            tone="amber"
            subtext="Próximos do fim"
          />
          <AxeMetricCard
            label="Itens no Carrinho"
            value={cartQuantity}
            icon={ShoppingBag}
            tone="purple"
            subtext={`R$ ${cartTotal.toFixed(2)} acumulado`}
          />
        </AxeMetricRail>

        <div className="space-y-8">

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 xl:pl-4 2xl:pl-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="overflow-hidden rounded-lg border border-[#1E242B] bg-[#13171D] animate-pulse">
                <div className="aspect-square bg-[#1E242B]/40" />
                <div className="space-y-3 p-3 md:space-y-4 md:p-6">
                  <div className="h-4 w-3/4 rounded-lg bg-[#1E242B]/40" />
                  <div className="h-3 w-1/2 rounded-lg bg-[#1E242B]/40" />
                  <div className="h-9 w-full rounded-xl bg-[#1E242B]/40 md:h-10" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="col-span-full rounded-lg border border-[#E5DECF] bg-white p-12 text-center shadow-xs">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-amber-700" />
            <h3 className="text-base font-black text-[#171A16]">Nenhum produto cadastrado</h3>
            <p className="mt-2 text-xs font-semibold text-[#6B6355]">A lojinha do terreiro ainda está vazia.</p>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] px-5 py-2.5 text-xs font-black text-[#0A160F] shadow-sm hover:brightness-105 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Cadastrar Primeiro Produto
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 xl:pl-4 2xl:pl-6">
            {products.map(product => {
              const isLowStock = product.estoque_atual > 0 && product.estoque_atual <= product.estoque_minimo;
              const isOutOfStock = product.estoque_atual === 0;

              return (
                <div key={product.id} className="group relative flex flex-col overflow-hidden rounded-lg border border-[#E5DECF] bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-xl">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product)}
                      disabled={deletingProductId === product.id}
                      className="absolute right-2 top-2 z-20 flex items-center justify-center rounded-lg border border-rose-500/30 bg-white/90 p-2 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 md:right-3 md:top-3 md:p-2.5 shadow-sm"
                      title="Excluir produto"
                      aria-label={`Excluir ${product.nome}`}
                    >
                      {deletingProductId === product.id ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400 md:h-4 md:w-4" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      )}
                    </button>
                  )}
                  {/* Image Container */}
                  <div className="relative aspect-square overflow-hidden bg-[#FAF8F5]">
                    {product.imagem_url ? (
                      <img
                        src={product.imagem_url}
                        alt={product.nome}
                        className={cn(
                          "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                          isOutOfStock && "opacity-50 grayscale"
                        )}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#9B9184]">
                        <ImageIcon className="h-8 w-8 opacity-40 md:h-12 md:w-12" />
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1.5 md:top-4 md:left-4 md:gap-2">
                      {isOutOfStock ? (
                        <span className="rounded-md border border-slate-300 bg-white/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-700 shadow-sm md:rounded-lg md:px-3 md:py-1 md:text-xs">
                          Indisponível
                        </span>
                      ) : isLowStock ? (
                        <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-800 shadow-sm md:rounded-lg md:px-3 md:py-1 md:text-xs">
                          Últimas Peças
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-4 md:p-5">
                    <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-3">
                      <h3 className="line-clamp-2 text-sm font-black leading-tight text-[#171A16] group-hover:text-amber-800 transition-colors md:text-base">{product.nome}</h3>
                      <span className="whitespace-nowrap text-sm font-black text-emerald-800 md:ml-4 md:text-lg">
                        R$ {product.preco.toFixed(2)}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-2 flex-1 text-xs font-semibold text-[#6B6355] md:mb-5">{product.descricao}</p>

                    <button
                      onClick={() => {
                        if (userRole === 'filho') setIntencaoLojaFilho('compra');
                        addToCart(product);
                      }}
                      disabled={isOutOfStock}
                      className={cn(
                        "flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all md:gap-2 md:py-3 shadow-xs",
                        isOutOfStock
                          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                          : "bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] text-[#0A160F] hover:brightness-105 active:scale-95"
                      )}
                    >
                      <ShoppingBag className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      {isOutOfStock ? 'Sem estoque' : userRole === 'filho' ? 'Comprar' : 'Adicionar à Sacola'}
                    </button>

                    {userRole === 'filho' && !isOutOfStock && (
                      <button
                        type="button"
                        onClick={() => {
                          setIntencaoLojaFilho('reserva');
                          addToCart(product);
                          setIsCartOpen(true);
                        }}
                        className="mt-2 w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] py-2 text-[10px] font-black uppercase tracking-wide text-[#4A4235] transition hover:bg-[#F0EAE0]"
                      >
                        Reservar na Casa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </div>
        </div>
        )}
        <StoreOrdersPanel rows={lojaPedidos} loading={loadingPedidos} error={ordersError} manager={isAdmin} busy={orderBusy} refresh={()=>void fetchLojaPedidos()} onPix={id=>void showOrderPix(id)} onAction={(id,action,total)=>void actOnOrder(id,action,total)} />
      </AppPageShell>

      <PixPaymentModal open={Boolean(pixOrder)} onClose={()=>setPixOrder(null)} loading={false} pixConfig={pixOrder?.pix || null} valor={Number(pixOrder?.order.total || 0)} descricao="Compra na Loja" txid={pixOrder?.pix.txid || ''} payload={pixOrder?.pix.payload} notice="Este Pix vai para a conta do terreiro. O pedido permanece pendente até o responsável confirmar o recebimento." />

      {/* Cart Sheet */}
      <Dialog.Root open={isCartOpen} onOpenChange={setIsCartOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className={cn(
              'fixed z-[101] flex w-full max-w-md flex-col overflow-hidden bg-[#F9F6EE] p-6 text-[#171A16] shadow-2xl',
              userRole === 'filho' && 'filho-store-cart-sheet',
              'max-h-[min(92dvh,calc(100dvh-2rem))] rounded-lg border border-[#DED8CB]',
              'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[min(28rem,calc(100vw-2rem))]',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0 sm:bottom-0 sm:h-auto sm:max-h-none sm:max-w-md sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border sm:border-l sm:border-y-0 sm:border-r-0 sm:border-b-0 sm:border-[#DED8CB]',
              'sm:data-[state=closed]:slide-out-to-right-full sm:data-[state=open]:slide-in-from-right-full sm:data-[state=closed]:zoom-out-100 sm:data-[state=open]:zoom-in-100',
            )}
          >
            <div className="mb-8 flex items-center justify-between">
              <Dialog.Title className="flex items-center gap-3 text-xl font-bold text-[#171A16]">
                <ShoppingBag className="h-6 w-6 text-[#8F7724]" />
                Seu pedido
              </Dialog.Title>
              <Dialog.Close className="rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition hover:bg-white">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4 text-[#6F675C]">
                  <ShoppingBag className="h-12 w-12 opacity-30" />
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-4 rounded-xl border border-[#E3DCCE] bg-white p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F1ECE0]">
                      {item.imagem_url ? (
                        <img src={item.imagem_url} alt={item.nome} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[#6F675C]" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-[#171A16]">{item.nome}</h4>
                      <p className="text-sm font-bold text-[#8F7724]">R$ {item.preco.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-[#D8D2C4] bg-[#F1ECE0] p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-[#6F675C] hover:text-[#171A16]"><Minus className="h-4 w-4" /></button>
                      <span className="w-4 text-center text-sm font-bold">{item.quantidade}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-[#6F675C] hover:text-[#171A16]"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-6 space-y-6 border-t border-[#E3DCCE] pt-6">
                <div className="flex items-center justify-between text-lg">
                  <span className="font-bold text-[#6F675C]">Total</span>
                  <span className="text-2xl font-bold text-[#8F7724]">R$ {cartTotal.toFixed(2)}</span>
                </div>

                {userRole === 'filho' && (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#6F675C]">
                    {intencaoLojaFilho === 'reserva' ? 'Reserva (sem pagamento agora)' : 'Compra — escolha como pagar'}
                  </p>
                )}

                <div className="space-y-3">
                  {userRole === 'filho' && intencaoLojaFilho === 'compra' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCheckout('mensalidade')}
                        disabled={isCheckoutLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17251D] py-4 text-sm font-bold text-[#FFFAF0] transition hover:bg-[#20342A] disabled:opacity-50"
                      >
                        {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFFAF0]/30 border-t-[#FFFAF0]" /> : 'Pagamento na mensalidade'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCheckout('pix')}
                        disabled={isCheckoutLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8D2C4] bg-white py-4 text-sm font-bold text-[#4A463E] transition hover:bg-[#F5F0E5] disabled:opacity-50"
                      >
                        {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4A463E]/30 border-t-[#4A463E]" /> : 'Pagamento via PIX'}
                      </button>
                    </>
                  )}

                  {userRole === 'filho' && intencaoLojaFilho === 'reserva' && (
                    <button
                      type="button"
                      onClick={() => handleCheckout('reserva')}
                      disabled={isCheckoutLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8BE52]/60 bg-[#FFF7D6] py-4 text-sm font-bold text-[#8F7724] transition hover:bg-[#FFF2B8] disabled:opacity-50"
                    >
                      {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#8F7724]/30 border-t-[#8F7724]" /> : 'Confirmar reserva'}
                    </button>
                  )}

                  {userRole !== 'filho' && (
                    <>
                    <button type="button" onClick={()=>handleCheckout('dinheiro')} disabled={isCheckoutLoading} className="w-full rounded-xl bg-[#17251D] py-4 text-sm font-bold text-white disabled:opacity-50">Receber em dinheiro</button>
                    <button
                      type="button"
                      onClick={() => handleCheckout('pix')}
                      disabled={isCheckoutLoading}
                      className="w-full rounded-xl border border-[#D8D2C4] bg-white py-4 text-sm font-bold text-[#4A463E] transition hover:bg-[#F5F0E5] disabled:opacity-50"
                    >
                      {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4A463E]/30 border-t-[#4A463E]" /> : 'Pagamento via PIX'}
                    </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Add Product Dialog */}
      <Dialog.Root open={isAddProductOpen} onOpenChange={(open) => (open ? setIsAddProductOpen(true) : closeAddProductDialog())}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[101] flex max-h-[88dvh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border border-[#DED8CB] bg-[#F9F6EE] p-6 text-[#171A16] shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <Dialog.Title className="text-xl font-bold text-[#171A16]">Novo produto</Dialog.Title>
              <Dialog.Close className="rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition hover:bg-white">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSaveProduct} className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className={paperModalLabelClass}>Nome do produto</label>
                <input
                  type="text"
                  required
                  value={newProduct.nome}
                  onChange={e => setNewProduct({...newProduct, nome: e.target.value})}
                  className={paperModalInputClass}
                  placeholder="Ex: Vela de 7 dias"
                />
              </div>

              <div className="space-y-1.5">
                <label className={paperModalLabelClass}>Descrição</label>
                <textarea
                  value={newProduct.descricao}
                  onChange={e => setNewProduct({...newProduct, descricao: e.target.value})}
                  className={cn(paperModalInputClass, 'h-24 resize-none')}
                  placeholder="Detalhes do produto..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={paperModalLabelClass}>Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newProduct.preco}
                    onChange={e => setNewProduct({...newProduct, preco: parseFloat(e.target.value) || 0})}
                    className={paperModalInputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={paperModalLabelClass}>Categoria</label>
                  <select
                    value={newProduct.categoria}
                    onChange={e => setNewProduct({...newProduct, categoria: e.target.value})}
                    className={cn(paperModalInputClass, '[&>option]:bg-white')}
                  >
                    <option value="Velas">Velas</option>
                    <option value="Guias">Guias</option>
                    <option value="Roupas">Roupas</option>
                    <option value="Ervas">Ervas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={paperModalLabelClass}>Estoque atual</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProduct.estoque_atual}
                    onChange={e => setNewProduct({...newProduct, estoque_atual: parseInt(e.target.value) || 0})}
                    className={paperModalInputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={paperModalLabelClass}>Estoque mínimo</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProduct.estoque_minimo}
                    onChange={e => setNewProduct({...newProduct, estoque_minimo: parseInt(e.target.value) || 0})}
                    className={paperModalInputClass}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className={paperModalLabelClass}>Foto do produto</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className={cn(paperModalInputClass, 'cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-[#17251D] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#FFFAF0]')}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setProductImageFile(file);
                    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
                    setProductImagePreview(file ? URL.createObjectURL(file) : '');
                  }}
                />
                <p className="text-xs text-[#6F675C]">
                  Se nenhuma foto for enviada, o sistema tenta sugerir uma imagem automaticamente.
                </p>
                {productImagePreview ? (
                  <div className="overflow-hidden rounded-lg border border-[#D8D2C4] bg-white">
                    <img src={productImagePreview} alt="Prévia do produto" className="h-48 w-full object-cover" />
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#E3DCCE] pt-4">
                <Dialog.Close asChild>
                  <button type="button" className="rounded-xl border border-[#D8D2C4] bg-white px-6 py-3 font-bold text-[#4A463E] transition hover:bg-[#F5F0E5]">
                    Cancelar
                  </button>
                </Dialog.Close>
                <AppPrimaryButton
                  type="submit"
                  disabled={isSavingProduct || isUploadingProductImage}
                  className="flex items-center gap-2 bg-[#17251D] px-6 py-3 text-[#FFFAF0] hover:bg-[#20342A]"
                >
                  {isSavingProduct || isUploadingProductImage ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFFAF0]/30 border-t-[#FFFAF0]" />
                  ) : 'Salvar produto'}
                </AppPrimaryButton>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Toast Notifications */}
      <Toast.Root
        open={toastOpen}
        onOpenChange={setToastOpen}
        className={cn(
          "flex w-[350px] items-start gap-4 rounded-lg border bg-[#13171D] p-4 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out] data-[swipe=end]:animate-out",
          toastMessage.type === 'success' ? "border-green-500/30" :
          toastMessage.type === 'error' ? "border-red-500/30" : "border-primary/30"
        )}
      >
        <div className="mt-0.5 shrink-0">
          {toastMessage.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {toastMessage.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
          {toastMessage.type === 'warning' && <AlertCircle className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1">
          <Toast.Title className="mb-1 text-sm font-bold text-[#F1F5F9]">{toastMessage.title}</Toast.Title>
          <Toast.Description className="text-xs leading-relaxed text-[#94A3B8]">{toastMessage.description}</Toast.Description>
        </div>
        <Toast.Close className="text-[#64748B] transition hover:text-[#F1F5F9]">
          <X className="w-4 h-4" />
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-24 right-0 m-0 flex w-[390px] max-w-[100vw] list-none flex-col gap-2 p-4 outline-none z-[200] min-[880px]:bottom-0 min-[880px]:p-6" />
    </Toast.Provider>
  );
}
