import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { resolveStoreTenantPk } from '../lib/resolveStoreTenantPk';
import { ShoppingBag, Plus, Minus, Trash2, X, AlertCircle, CheckCircle2, Image as ImageIcon, ClipboardList } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Toast from '@radix-ui/react-toast';
import { AppPageShell } from '../components/app/AppTopNav';
import { AppDemoPanelHeader, AppDemoCard, AppDemoTableShell, AppPrimaryButton, appInputClass, appLabelClass } from '../components/ui/appDemoUi';

interface Product {
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

interface LojaPedidoRow {
  id: string;
  created_at: string;
  filho_nome: string | null;
  tipo: string;
  metodo_pagamento: string;
  resumo_itens: string;
  valor_total: number;
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
  const [lojaPedidos, setLojaPedidos] = useState<LojaPedidoRow[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

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
    if (!isAdmin) return;
    setLoadingPedidos(true);
    try {
      const pk =
        tenantPk != null && String(tenantPk).trim() !== '' ? String(tenantPk).trim() : await resolveStoreTenantPk(storeTenantParams());
      if (!pk) {
        setLojaPedidos([]);
        return;
      }
      const { data, error } = await supabase
        .from('loja_pedidos')
        .select('id, created_at, filho_nome, tipo, metodo_pagamento, resumo_itens, valor_total')
        .eq('tenant_id', pk)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      setLojaPedidos((data || []) as LojaPedidoRow[]);
    } catch {
      setLojaPedidos([]);
    } finally {
      setLoadingPedidos(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
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
    const { data } = await supabase
      .from('filhos_de_santo')
      .select('id, nome')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      setFilhoId(data.id);
      setFilhoNome(typeof data.nome === 'string' ? data.nome : '');
    }
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
    const tenantPk = opts?.tenantPk != null && String(opts.tenantPk).trim() !== '' ? String(opts.tenantPk).trim() : await resolveStoreTenantPk(storeTenantParams());
    if (!tenantPk) {
      setProducts([]);
      if (!opts?.silent) setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('tenant_id', tenantPk)
      .is('deleted_at', null)
      .order('nome');
    if (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } else {
      setProducts((data || []).map((r) => rowToProduct(r as Record<string, unknown>)));
    }
    if (!opts?.silent) setLoading(false);
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

  const handleCheckout = async (method: 'mensalidade' | 'pix' | 'reserva') => {
    if (cart.length === 0) return;
    if (userRole === 'filho' && !filhoId) {
      showToast('Erro', 'Perfil de filho não encontrado.', 'error');
      return;
    }

    const tenantPk = await resolveStoreTenantPk(storeTenantParams());
    if (!tenantPk) {
      showToast('Erro', 'Informações do terreiro não carregadas. Tente recarregar a página.', 'error');
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const res = await authFetch('/api/v1/store/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantPk,
          filhoId: userRole === 'filho' ? filhoId : null,
          method,
          items: cart.map((item) => ({
            produto_id: item.id,
            id: item.id,
            quantidade: item.quantidade,
            nome: item.nome,
            preco: item.preco,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro no checkout');

      showToast('Sucesso!', 'Pedido realizado com sucesso.', 'success');
      setCart([]);
      setIntencaoLojaFilho('compra');
      setIsCartOpen(false);
      await fetchProducts({ silent: true, tenantPk });
      if (isAdmin) await fetchLojaPedidos(tenantPk);
    } catch (error: any) {
      console.error('Checkout error:', error);
      showToast('Erro no Checkout', error.message || 'Ocorreu um erro ao processar o pedido.', 'error');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProduct(true);

    const nomeDoEstado = (newProduct.nome || '').trim();
    const descricaoDoEstado = String(newProduct.descricao ?? '').trim();
    const precoDoEstado = Number(newProduct.preco) || 0;
    const categoriaDoEstado = newProduct.categoria || 'Velas';
    const estoqueAtual = Number(newProduct.estoque_atual) || 0;
    const estoqueMinimo = Number(newProduct.estoque_minimo) || 0;

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
      const imgRes = await authFetch(
        `/api/store/product-image-suggestion?q=${encodeURIComponent(nomeDoEstado)}`
      );
      if (imgRes.ok) {
        const j = (await imgRes.json()) as { url?: string | null };
        const u = typeof j.url === 'string' ? j.url.trim() : '';
        if (u) imagemUrl = u;
      }
    } catch (e) {
      console.warn('[Store] sugestão de imagem (Pexels):', e);
    }

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
    const novoProduto = inserted ? rowToProduct(inserted) : null;

    showToast('Sucesso', 'Produto salvo com sucesso!', 'success');
    setIsAddProductOpen(false);
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
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!isAdmin) return;
    if (!confirm(`Excluir o produto "${product.nome}"? Ele deixa de aparecer na loja.`)) return;

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
        <AppDemoPanelHeader
          title="Loja do Axé"
          description={
            userRole === 'filho'
              ? 'Compre com pagamento na mensalidade ou via PIX, ou reserve itens com o zelador.'
              : 'Artigos religiosos com baixa automática no estoque e pedidos dos filhos de santo.'
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-[#080A0D] transition hover:bg-[#fde047]"
                >
                  <Plus className="h-4 w-4" />
                  Novo produto
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative inline-flex items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2 text-xs font-bold text-[#F1F5F9] transition hover:border-[#2F3643]"
              >
                <ShoppingBag className="h-4 w-4 text-primary" />
                Carrinho
                {cart.length > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-[#080A0D]">
                    {cartQuantity}
                  </span>
                ) : null}
              </button>
            </div>
          }
        />

        <div className="space-y-8">

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 xl:pl-4 2xl:pl-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] animate-pulse">
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
          <AppDemoCard className="py-16 text-center">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-primary/40" />
            <h3 className="text-lg font-bold text-[#F1F5F9]">Nenhum produto cadastrado</h3>
            <p className="mt-2 text-sm text-[#94A3B8]">A loja do terreiro ainda está vazia.</p>
          </AppDemoCard>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 xl:pl-4 2xl:pl-6">
            {products.map(product => {
              const isLowStock = product.estoque_atual > 0 && product.estoque_atual <= product.estoque_minimo;
              const isOutOfStock = product.estoque_atual === 0;

              return (
                <div key={product.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-500/20 hover:shadow-lg">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product)}
                      disabled={deletingProductId === product.id}
                      className="absolute right-2 top-2 z-20 flex items-center justify-center rounded-lg border border-rose-500/30 bg-[#13171D]/90 p-2 text-rose-300 transition hover:bg-rose-950/60 disabled:opacity-50 md:right-3 md:top-3 md:p-2.5"
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
                  <div className="relative aspect-square overflow-hidden bg-[#12161A]">
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
                      <div className="flex h-full w-full items-center justify-center text-[#64748B]">
                        <ImageIcon className="h-8 w-8 opacity-30 md:h-12 md:w-12" />
                      </div>
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1.5 md:top-4 md:left-4 md:gap-2">
                      {isOutOfStock ? (
                        <span className="rounded-md border border-[#1E242B] bg-[#13171D]/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#94A3B8] backdrop-blur-sm md:rounded-lg md:px-3 md:py-1 md:text-xs">
                          Indisponível
                        </span>
                      ) : isLowStock ? (
                        <span className="rounded-md border border-rose-500/30 bg-rose-950/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-200 backdrop-blur-sm md:rounded-lg md:px-3 md:py-1 md:text-xs">
                          Últimas
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-3 md:p-6">
                    <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-3">
                      <h3 className="line-clamp-2 text-sm font-bold leading-tight text-[#F1F5F9] md:text-lg">{product.nome}</h3>
                      <span className="whitespace-nowrap text-sm font-bold text-primary md:ml-4 md:text-lg">
                        R$ {product.preco.toFixed(2)}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-2 flex-1 text-xs text-[#94A3B8] md:mb-6 md:text-sm">{product.descricao}</p>
                    
                    <button 
                      onClick={() => {
                        if (userRole === 'filho') setIntencaoLojaFilho('compra');
                        addToCart(product);
                      }}
                      disabled={isOutOfStock}
                      className={cn(
                        "flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold transition-all md:gap-2 md:py-3 md:text-sm",
                        isOutOfStock 
                          ? "cursor-not-allowed border border-[#1E242B] bg-[#12161A] text-[#64748B]" 
                          : "bg-primary text-[#080A0D] hover:bg-[#fde047] shadow-sm"
                      )}
                    >
                      <ShoppingBag className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      {isOutOfStock ? 'Sem estoque' : userRole === 'filho' ? 'Comprar' : 'Adicionar'}
                    </button>

                    {userRole === 'filho' && !isOutOfStock && (
                      <button 
                        type="button"
                        onClick={() => {
                          setIntencaoLojaFilho('reserva');
                          addToCart(product);
                          setIsCartOpen(true);
                        }}
                        className="mt-2 w-full rounded-xl border border-[#1E242B] bg-[#12161A] py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#F1F5F9] transition hover:border-[#2F3643] md:py-3 md:text-xs"
                      >
                        Reservar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isAdmin && (
          <AppDemoCard className="space-y-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="text-lg font-bold text-[#F1F5F9]">Pedidos dos filhos na loja</h3>
                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  Compras e reservas feitas pelos filhos de santo aparecem aqui e no histórico do dashboard.
                </p>
              </div>
            </div>
            {loadingPedidos ? (
              <p className="text-sm text-[#94A3B8]">Carregando pedidos…</p>
            ) : lojaPedidos.length === 0 ? (
              <p className="text-sm italic text-[#64748B]">Nenhum pedido registrado ainda.</p>
            ) : (
              <AppDemoTableShell>
                <ul className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto p-3 no-scrollbar sm:p-4">
                  {lojaPedidos.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col gap-1 rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-primary">{p.filho_nome || 'Filho de santo'}</span>
                        <span className="text-xs font-bold text-[#64748B]">
                          {new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8]">
                        <span className="font-bold text-[#F1F5F9]">{p.tipo === 'reserva' ? 'Reserva' : 'Compra'}</span>
                        {' · '}
                        <span className="uppercase tracking-wide text-[#64748B]">
                          {p.metodo_pagamento === 'mensalidade'
                            ? 'Mensalidade'
                            : p.metodo_pagamento === 'pix'
                              ? 'PIX'
                              : p.metodo_pagamento === 'reserva'
                                ? 'Somente reserva'
                                : p.metodo_pagamento}
                        </span>
                      </p>
                      <p className="line-clamp-2 text-xs text-[#94A3B8]">{p.resumo_itens}</p>
                      <p className="text-sm font-bold text-[#F1F5F9]">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.valor_total) || 0)}
                      </p>
                    </li>
                  ))}
                </ul>
              </AppDemoTableShell>
            )}
          </AppDemoCard>
        )}
        </div>
      </AppPageShell>

      {/* Cart Sheet */}
      <Dialog.Root open={isCartOpen} onOpenChange={setIsCartOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className={cn(
              'fixed z-[101] flex w-full max-w-md flex-col overflow-hidden bg-[#13171D] p-6 shadow-2xl',
              'max-h-[min(92dvh,calc(100dvh-2rem))] rounded-2xl border border-[#1E242B]',
              'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[min(28rem,calc(100vw-2rem))]',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0 sm:bottom-0 sm:h-auto sm:max-h-none sm:max-w-md sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border sm:border-l sm:border-y-0 sm:border-r-0 sm:border-b-0 sm:border-[#1E242B]',
              'sm:data-[state=closed]:slide-out-to-right-full sm:data-[state=open]:slide-in-from-right-full sm:data-[state=closed]:zoom-out-100 sm:data-[state=open]:zoom-in-100',
            )}
          >
            <div className="mb-8 flex items-center justify-between">
              <Dialog.Title className="flex items-center gap-3 text-xl font-bold text-[#F1F5F9]">
                <ShoppingBag className="h-6 w-6 text-primary" />
                Seu pedido
              </Dialog.Title>
              <Dialog.Close className="rounded-lg p-2 text-[#94A3B8] transition hover:bg-[#12161A] hover:text-[#F1F5F9]">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4 text-[#64748B]">
                  <ShoppingBag className="h-12 w-12 opacity-30" />
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-4 rounded-xl border border-[#1E242B] bg-[#12161A] p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#13171D]">
                      {item.imagem_url ? (
                        <img src={item.imagem_url} alt={item.nome} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[#64748B]" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-[#F1F5F9]">{item.nome}</h4>
                      <p className="text-sm font-bold text-primary">R$ {item.preco.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-[#1E242B] bg-[#13171D] p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-[#94A3B8] hover:text-[#F1F5F9]"><Minus className="h-4 w-4" /></button>
                      <span className="w-4 text-center text-sm font-bold">{item.quantidade}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-[#94A3B8] hover:text-[#F1F5F9]"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-6 space-y-6 border-t border-[#1E242B] pt-6">
                <div className="flex items-center justify-between text-lg">
                  <span className="font-bold text-[#94A3B8]">Total</span>
                  <span className="text-2xl font-bold text-primary">R$ {cartTotal.toFixed(2)}</span>
                </div>

                {userRole === 'filho' && (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-[#080A0D] transition hover:bg-[#fde047] disabled:opacity-50"
                      >
                        {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#080A0D]/30 border-t-[#080A0D]" /> : 'Pagamento na mensalidade'}
                      </button>

                      <button 
                        type="button"
                        onClick={() => handleCheckout('pix')}
                        disabled={isCheckoutLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] py-4 text-sm font-bold text-[#F1F5F9] transition hover:border-[#2F3643] disabled:opacity-50"
                      >
                        {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#94A3B8]/30 border-t-[#F1F5F9]" /> : 'Pagamento via PIX'}
                      </button>
                    </>
                  )}

                  {userRole === 'filho' && intencaoLojaFilho === 'reserva' && (
                    <button 
                      type="button"
                      onClick={() => handleCheckout('reserva')}
                      disabled={isCheckoutLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-4 text-sm font-bold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" /> : 'Confirmar reserva'}
                    </button>
                  )}

                  {userRole !== 'filho' && (
                    <button 
                      type="button"
                      onClick={() => handleCheckout('pix')}
                      disabled={isCheckoutLoading}
                      className="w-full rounded-xl border border-[#1E242B] bg-[#12161A] py-4 text-sm font-bold text-[#F1F5F9] transition hover:border-[#2F3643] disabled:opacity-50"
                    >
                      {isCheckoutLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#94A3B8]/30 border-t-[#F1F5F9]" /> : 'Pagamento via PIX'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Add Product Dialog */}
      <Dialog.Root open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[101] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-[#1E242B] bg-[#13171D] p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <Dialog.Title className="text-xl font-bold text-[#F1F5F9]">Novo produto</Dialog.Title>
              <Dialog.Close className="rounded-lg p-2 text-[#94A3B8] transition hover:bg-[#12161A] hover:text-[#F1F5F9]">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="space-y-1.5">
                <label className={appLabelClass}>Nome do produto</label>
                <input 
                  type="text" 
                  required
                  value={newProduct.nome}
                  onChange={e => setNewProduct({...newProduct, nome: e.target.value})}
                  className={appInputClass}
                  placeholder="Ex: Vela de 7 dias"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className={appLabelClass}>Descrição</label>
                <textarea 
                  value={newProduct.descricao}
                  onChange={e => setNewProduct({...newProduct, descricao: e.target.value})}
                  className={cn(appInputClass, 'h-24 resize-none')}
                  placeholder="Detalhes do produto..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={appLabelClass}>Preço (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={newProduct.preco}
                    onChange={e => setNewProduct({...newProduct, preco: parseFloat(e.target.value) || 0})}
                    className={appInputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={appLabelClass}>Categoria</label>
                  <select 
                    value={newProduct.categoria}
                    onChange={e => setNewProduct({...newProduct, categoria: e.target.value})}
                    className={cn(appInputClass, '[&>option]:bg-[#13171D]')}
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
                  <label className={appLabelClass}>Estoque atual</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={newProduct.estoque_atual}
                    onChange={e => setNewProduct({...newProduct, estoque_atual: parseInt(e.target.value) || 0})}
                    className={appInputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={appLabelClass}>Estoque mínimo</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={newProduct.estoque_minimo}
                    onChange={e => setNewProduct({...newProduct, estoque_minimo: parseInt(e.target.value) || 0})}
                    className={appInputClass}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#1E242B] pt-4">
                <Dialog.Close asChild>
                  <button type="button" className="rounded-xl px-6 py-3 font-bold text-[#94A3B8] transition hover:bg-[#12161A] hover:text-[#F1F5F9]">
                    Cancelar
                  </button>
                </Dialog.Close>
                <AppPrimaryButton 
                  type="submit" 
                  disabled={isSavingProduct}
                  className="flex items-center gap-2 px-6 py-3"
                >
                  {isSavingProduct ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#080A0D]/30 border-t-[#080A0D]" /> : 'Salvar produto'}
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
          "flex w-[350px] items-start gap-4 rounded-2xl border bg-[#13171D] p-4 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out] data-[swipe=end]:animate-out",
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
      <Toast.Viewport className="fixed bottom-0 right-0 p-6 flex flex-col gap-2 w-[390px] max-w-[100vw] m-0 list-none z-[200] outline-none" />
    </Toast.Provider>
  );
}
