import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  AlertTriangle, 
  XCircle, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Search, 
  X, 
  Copy, 
  CheckCircle2,
  MessageSquare,
  Loader2,
  Boxes,
  Pencil,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';
import BodyPortal from '../components/BodyPortal';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoCard,
  AppDemoPanelHeader,
  AppDemoTableShell,
  AppPrimaryButton,
  appInputClass,
} from '../components/ui/appDemoUi';

interface Product {
  id: string;
  item: string;
  categoria: 'Rituais' | 'Cozinha de Santo' | 'Vestuário' | 'Limpeza' | 'Camarinha';
  quantidade_atual: number;
  quantidade_minima: number;
  status: string;
}

const categories = ['Todos', 'Camarinha', 'Rituais', 'Cozinha de Santo', 'Vestuário', 'Limpeza'] as const;

interface InventoryProps {
  tenantData?: any;
  userRole?: string;
  isAdminGlobal?: boolean;
  setActiveTab: (tab: string) => void;
}

export default function Inventory({
  tenantData,
  userRole,
  isAdminGlobal,
  setActiveTab,
}: InventoryProps) {
  // Não-filhos são sempre gestores do terreiro (plano determina quais funções de gestão estão disponíveis).
  const isAdmin = userRole !== 'filho';
  const tenantId = tenantData?.tenant_id;
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'em_dia' | 'baixo' | 'esgotado'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    item: '',
    categoria: 'Limpeza' as any,
    quantidade_atual: 0,
    quantidade_minima: 5
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, [tenantId]);

  async function fetchInventory() {
    setLoading(true);
    try {
      const response = await authFetch(`/api/inventory?tenantId=${tenantId || ''}`);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const { data } = await response.json();
      setProducts((data || []).map((p: any) => ({
        ...p,
        quantidade_atual: Number(p.quantidade_atual) || 0,
        quantidade_minima: Number(p.quantidade_minima) || 0
      })));
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      if (editingProduct) {
        const { error } = await supabase
          .from('almoxarifado')
          .update({
            item: formData.item,
            categoria: formData.categoria,
            quantidade_atual: Number(formData.quantidade_atual) || 0,
            quantidade_minima: Number(formData.quantidade_minima) || 0,
          })
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const response = await authFetch('/api/inventory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            item: formData.item,
            categoria: formData.categoria,
            quantidade_atual: Number(formData.quantidade_atual) || 0,
            quantidade_minima: Number(formData.quantidade_minima) || 5,
            autorId: session.user.id,
            tenantId: tenantId
          })
        });

        if (!response.ok) {
          const text = await response.text();
          let errDesc = 'Falha ao adicionar item';
          try {
            const errData = text ? JSON.parse(text) : {};
            errDesc = errData.error || errDesc;
          } catch (e) {
            console.error('[INVENTORY] Error parsing error response:', text);
          }
          throw new Error(errDesc);
        }
      }

      setIsAddItemModalOpen(false);
      setEditingProduct(null);
      setFormData({
        item: '',
        categoria: 'Limpeza',
        quantidade_atual: 0,
        quantidade_minima: 5
      });
      fetchInventory();
    } catch (error) {
      console.error('Error adding item:', error);
      alert(editingProduct ? 'Erro ao atualizar item.' : 'Erro ao adicionar item ao almoxarifado.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const openNewItemModal = () => {
    setEditingProduct(null);
    setFormData({
      item: '',
      categoria: 'Limpeza',
      quantidade_atual: 0,
      quantidade_minima: 5,
    });
    setIsAddItemModalOpen(true);
  };

  const openEditItemModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      item: product.item,
      categoria: product.categoria,
      quantidade_atual: product.quantidade_atual,
      quantidade_minima: product.quantidade_minima,
    });
    setIsAddItemModalOpen(true);
  };

  const closeItemModal = () => {
    if (isSubmitting) return;
    setIsAddItemModalOpen(false);
    setEditingProduct(null);
  };

  async function deleteItem(id: string) {
    if (!confirm('Deseja realmente excluir este item?')) return;
    
    try {
      const { error } = await supabase
        .from('almoxarifado')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchInventory();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Erro ao excluir item.');
    }
  }

  const adjustStock = async (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const newQty = Math.max(0, product.quantidade_atual + delta);
    
    try {
      const { error } = await supabase
        .from('almoxarifado')
        .update({ quantidade_atual: newQty })
        .eq('id', id);

      if (error) throw error;
      
      setProducts(prev => prev.map(p => 
        p.id === id ? { ...p, quantidade_atual: newQty } : p
      ));
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const getStatus = (p: Product) => {
    if (p.quantidade_atual <= 0) return { label: 'Esgotado', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    if (p.quantidade_atual <= p.quantidade_minima) return { label: 'Baixo Estoque', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
    return { label: 'Em Dia', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  };

  const visibleCategories = categories;

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchesCat = activeCategory === 'Todos' || p.categoria === activeCategory;
    const matchesSearch = p.item.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'esgotado' && p.quantidade_atual <= 0) ||
      (statusFilter === 'baixo' && p.quantidade_atual > 0 && p.quantidade_atual <= p.quantidade_minima) ||
      (statusFilter === 'em_dia' && p.quantidade_atual > p.quantidade_minima);
    return matchesCat && matchesSearch && matchesStatus;
  }), [products, activeCategory, searchTerm, statusFilter]);

  const lowStockItems = useMemo(() => products.filter(p => p.quantidade_atual <= p.quantidade_minima), [products]);
  const outOfStockItems = useMemo(() => products.filter(p => p.quantidade_atual <= 0), [products]);
  const totalUnits = useMemo(
    () => products.reduce((total, product) => total + product.quantidade_atual, 0),
    [products],
  );
  const healthyStockItems = useMemo(
    () => products.filter((product) => product.quantidade_atual > product.quantidade_minima),
    [products],
  );

  const generateShoppingListText = () => {
    const list = lowStockItems.map(p => `• ${p.item}: Repor ${p.quantidade_minima * 2} un.`).join('\n');
    return `*LISTA DE COMPRAS - AxéCloud*\n\nOlá, gostaria de solicitar os seguintes itens para reposição:\n\n${list}\n\nAguardo retorno com orçamento.`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateShoppingListText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && products.length === 0) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="inventory-v5-page">
      <AppDemoPanelHeader
        title="Almoxarifado"
        description="Gestão de estoque e insumos de axé."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={openNewItemModal}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-[#080A0D] transition hover:bg-[#fde047]"
              >
                <Plus className="h-4 w-4" />
                Novo item
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsShoppingListOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D8D1C4] bg-white px-3 py-2 text-xs font-bold text-[#11151A] transition hover:border-[#11151A]"
            >
              <ShoppingCart className="h-4 w-4" />
              Lista de compras
              {lowStockItems.length > 0 ? (
                <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-[#080A0D]">
                  {lowStockItems.length}
                </span>
              ) : null}
            </button>
          </div>
        }
      />

      <div className="space-y-5">

        <div className="inventory-pulse-board grid grid-cols-2 gap-3 xl:grid-cols-4">
          <AppDemoCard className="flex min-h-[108px] items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Itens cadastrados</span>
              <p className="mt-2 text-2xl font-black text-[#F1F5F9]">{products.length}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">{totalUnits} unidades no total</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
          </AppDemoCard>
          <AppDemoCard className="flex min-h-[108px] items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Estoque em dia</span>
              <p className="mt-2 text-2xl font-black text-emerald-400">{healthyStockItems.length}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">acima do mínimo</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-950/40 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </AppDemoCard>
          <AppDemoCard className="flex min-h-[108px] items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Estoque baixo</span>
              <p className="mt-2 text-2xl font-black text-amber-300">
                {Math.max(0, lowStockItems.length - outOfStockItems.length)}
              </p>
              <p className="mt-1 text-[10px] text-[#64748B]">pedem reposição</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/20 bg-amber-950/40 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </AppDemoCard>
          <AppDemoCard className="flex min-h-[108px] items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Esgotados</span>
              <p className="mt-2 text-2xl font-black text-rose-400">{outOfStockItems.length}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">reposição urgente</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-rose-500/20 bg-rose-950/40 text-rose-400">
              <XCircle className="h-5 w-5" />
            </div>
          </AppDemoCard>
        </div>

        <AppDemoCard className="inventory-command-deck space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-black text-[#F1F5F9]">Controle de itens</h3>
              <p className="mt-1 text-xs text-[#64748B]">
                {filteredProducts.length} de {products.length} item{products.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="search"
                  placeholder="Buscar item"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(appInputClass, 'pl-9')}
                />
              </div>
              <div className="relative sm:w-44">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'todos' | 'em_dia' | 'baixo' | 'esgotado')
                  }
                  className={cn(appInputClass, 'pl-9')}
                  aria-label="Filtrar por situação do estoque"
                >
                  <option value="todos">Todos os status</option>
                  <option value="em_dia">Em dia</option>
                  <option value="baixo">Estoque baixo</option>
                  <option value="esgotado">Esgotados</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex min-h-[44px] min-w-0 w-full max-w-full flex-nowrap gap-2 overflow-x-auto overscroll-x-contain border-t border-[#252B33] pt-4 touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black transition-all whitespace-nowrap sm:px-4',
                  activeCategory === cat
                    ? "border-primary bg-primary text-[#080A0D]"
                    : "border-[#303844] bg-[#12161A] text-[#94A3B8] hover:border-[#4B5563] hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </AppDemoCard>

        {filteredProducts.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {filteredProducts.map((product, idx) => {
                const status = getStatus(product);
                return (
                  <motion.article
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="rounded-2xl border border-[#252C35] bg-[#13171D] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">{product.categoria}</p>
                        <h4 className="mt-1 break-words text-base font-black text-[#F1F5F9]">{product.item}</h4>
                      </div>
                      <span className={cn("shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase", status.color, status.bg, status.border)}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-4 flex items-end justify-between border-t border-[#252B33] pt-4">
                      <div>
                        <span className="text-[9px] font-black uppercase text-[#64748B]">Quantidade</span>
                        <p className="mt-1 text-2xl font-black text-white">
                          {product.quantidade_atual}
                          <span className="ml-1 text-[10px] text-[#64748B]">un.</span>
                        </p>
                        <p className="text-[10px] text-[#64748B]">Mínimo: {product.quantidade_minima}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void adjustStock(product.id, -1)}
                          className="grid h-10 w-10 place-items-center rounded-xl border border-[#303844] bg-[#171C22] text-[#94A3B8]"
                          aria-label={`Retirar uma unidade de ${product.item}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void adjustStock(product.id, 1)}
                          className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-[#080A0D]"
                          aria-label={`Adicionar uma unidade de ${product.item}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => openEditItemModal(product)}
                            className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-950/30 text-cyan-300"
                            aria-label={`Editar ${product.item}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>

            <div className="hidden md:block">
              <AppDemoTableShell>
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-[#12161A]">
                    <tr className="border-b border-[#252B33]">
                      {['Item', 'Categoria', 'Quantidade', 'Mínimo', 'Situação', 'Ações'].map((heading) => (
                        <th
                          key={heading}
                          className={cn(
                            'px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]',
                            heading === 'Ações' && 'text-right',
                          )}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252B33]">
                    {filteredProducts.map((product) => {
                      const status = getStatus(product);
                      return (
                        <tr key={product.id} className="inventory-stock-row transition hover:bg-[#1A2027]">
                          <td className="px-4 py-3.5 font-black text-[#F1F5F9]">{product.item}</td>
                          <td className="px-4 py-3.5 text-[#94A3B8]">{product.categoria}</td>
                          <td className="px-4 py-3.5">
                            <span className="text-base font-black text-white">{product.quantidade_atual}</span>
                            <span className="ml-1 text-[9px] font-bold text-[#64748B]">UN.</span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-[#94A3B8]">{product.quantidade_minima}</td>
                          <td className="px-4 py-3.5">
                            <span className={cn("rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase", status.color, status.bg, status.border)}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => void adjustStock(product.id, -1)}
                                className="grid h-9 w-9 place-items-center rounded-xl border border-[#303844] bg-[#171C22] text-[#94A3B8] transition hover:text-white"
                                aria-label={`Retirar uma unidade de ${product.item}`}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void adjustStock(product.id, 1)}
                                className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-[#080A0D]"
                                aria-label={`Adicionar uma unidade de ${product.item}`}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              {isAdmin ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditItemModal(product)}
                                    className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-950/30 text-cyan-300 transition hover:bg-cyan-950/50"
                                    aria-label={`Editar ${product.item}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteItem(product.id)}
                                    className="grid h-9 w-9 place-items-center rounded-xl border border-rose-500/20 bg-rose-950/30 text-rose-300 transition hover:bg-rose-950/50"
                                    aria-label={`Excluir ${product.item}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </AppDemoTableShell>
            </div>
          </>
        ) : (
          <div
            className="app-demo-empty-preview rounded-2xl border border-dashed border-[#303844] bg-[#11151A] px-6 py-14 text-center"
            data-preview="Exemplo de item · Velas brancas · 24 unidades em estoque"
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Package className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-black text-white">Nenhum item encontrado</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-[#64748B]">
              Ajuste a busca ou os filtros. Se o almoxarifado estiver vazio, cadastre o primeiro item.
            </p>
            {isAdmin && products.length === 0 ? (
              <AppPrimaryButton type="button" onClick={openNewItemModal} className="mt-4 inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Cadastrar primeiro item
              </AppPrimaryButton>
            ) : null}
          </div>
        )}

      {/* Modal: Novo Item */}
      <AnimatePresence>
        {isAddItemModalOpen && (
          <BodyPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeItemModal}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl sm:max-w-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#DED8CB] px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-black text-[#171A16] sm:text-xl">
                    {editingProduct ? 'Editar item' : 'Cadastrar item'}
                  </h3>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6F675C]">
                    {editingProduct ? 'Atualize os dados e limites de estoque' : 'Adicione um novo insumo ao estoque'}
                  </p>
                </div>
                <button type="button" onClick={closeItemModal} className="shrink-0 rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition-colors hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-1.5">
                  <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">Nome do item</label>
                  <input required type="text" value={formData.item}
                    onChange={e => setFormData({ ...formData, item: e.target.value })}
                    className="min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15"
                    placeholder="Ex.: Vela branca de 7 dias" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">Categoria</label>
                    <select value={formData.categoria}
                      onChange={e => setFormData({ ...formData, categoria: e.target.value as any })}
                      className="min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15 [&>option]:bg-white">
                      <option value="Camarinha">Camarinha</option>
                      <option value="Limpeza">Limpeza</option>
                      <option value="Rituais">Rituais</option>
                      <option value="Cozinha de Santo">Cozinha</option>
                      <option value="Vestuário">Vestuário</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">Quantidade atual</label>
                    <input required type="number" value={formData.quantidade_atual}
                      onChange={e => setFormData({ ...formData, quantidade_atual: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]">Estoque mínimo para alerta</label>
                  <input required type="number" value={formData.quantidade_minima}
                    onChange={e => setFormData({ ...formData, quantidade_minima: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15" />
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-[#E3DCCE] pt-4 sm:flex-row sm:justify-between">
                  {editingProduct ? (
                    <button
                      type="button"
                      onClick={() => {
                        const id = editingProduct.id;
                        closeItemModal();
                        void deleteItem(id);
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B04A32] px-4 text-xs font-black text-white transition hover:bg-[#9C3F2A]"
                    >
                      Excluir item
                    </button>
                  ) : <span />}
                  <AppPrimaryButton
                    disabled={isSubmitting}
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 bg-[#17251D] text-[#FFFAF0] hover:bg-[#20342A]"
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    {isSubmitting
                      ? 'Salvando…'
                      : editingProduct
                        ? 'Salvar alterações'
                        : 'Cadastrar item'}
                  </AppPrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
          </BodyPortal>
        )}
      </AnimatePresence>

      {/* Shopping List Modal */}
      <BodyPortal>
      <AnimatePresence>
        {isShoppingListOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsShoppingListOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl sm:max-w-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#DED8CB] px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F1E8D2]">
                    <ShoppingCart className="h-5 w-5 text-[#8F7724]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-black text-[#171A16] sm:text-xl">Lista de Compras</h3>
                    <p className="text-xs text-[#6F675C] font-medium">Itens para reposição imediata.</p>
                  </div>
                </div>
                <button onClick={() => setIsShoppingListOpen(false)} className="shrink-0 rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition-colors hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="rounded-2xl border border-[#E3DCCE] bg-white p-4 font-mono text-sm leading-relaxed text-[#4A463E] whitespace-pre-wrap sm:p-6">
                  {generateShoppingListText()}
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-[#DED8CB] bg-white/70 px-5 py-4 sm:px-6">
                <button onClick={copyToClipboard}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D8D2C4] bg-white py-3 font-black text-[#4A463E] transition-all hover:bg-[#F5F0E5]">
                  {copied ? <CheckCircle2 className="h-5 w-5 text-[#3F7258]" /> : <Copy className="h-5 w-5" />}
                  <span className="text-sm">{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(generateShoppingListText())}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#17251D] py-3 font-black text-[#FFFAF0] shadow-lg transition-all hover:scale-[1.02] hover:bg-[#20342A]">
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-sm">WhatsApp</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </BodyPortal>
      </div>
      </div>
    </AppPageShell>
  );
}
