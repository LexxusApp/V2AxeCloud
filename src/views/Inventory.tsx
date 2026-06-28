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
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';
import BodyPortal from '../components/BodyPortal';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import { AppDemoCard, AppDemoPanelHeader } from '../components/ui/appDemoUi';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
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
      
      setIsAddItemModalOpen(false);
      setFormData({
        item: '',
        categoria: 'Limpeza',
        quantidade_atual: 0,
        quantidade_minima: 5
      });
      fetchInventory();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Erro ao adicionar item ao almoxarifado.');
    } finally {
      setIsSubmitting(false);
    }
  }

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
    return matchesCat && matchesSearch;
  }), [products, activeCategory, searchTerm]);

  const lowStockItems = useMemo(() => products.filter(p => p.quantidade_atual <= p.quantidade_minima), [products]);
  const outOfStockItems = useMemo(() => products.filter(p => p.quantidade_atual <= 0), [products]);

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
      <AppDemoPanelHeader
        title="Almoxarifado"
        description="Gestão de estoque e insumos de axé."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-[#080A0D] transition hover:bg-[#fde047]"
              >
                <Plus className="h-4 w-4" />
                Novo item
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsShoppingListOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2 text-xs font-bold text-[#F1F5F9] transition hover:border-[#2F3643]"
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

      <div className="space-y-8">
        
        {/* Superior Dashboard Bento Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          
          {/* Main Info Box */}
          <AppDemoCard className="relative flex min-h-[180px] flex-col justify-between overflow-hidden md:col-span-6 lg:col-span-5">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20 group-hover:bg-primary/20 transition-all duration-700" />
             <div className="relative z-10 flex items-start justify-between">
                <div>
                  <h3 className="mb-1 text-xs font-black uppercase tracking-widest text-gray-400">Total em Estoque</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black tracking-tighter text-white">{products.length}</span>
                    <span className="text-lg font-bold text-primary">itens</span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md">
                   <Package className="h-6 w-6 text-primary" />
                </div>
             </div>
             
             <div className="relative z-10 mt-5 flex items-center gap-3">
               <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                 <div className="h-full bg-primary w-full" />
               </div>
               <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Geral</span>
             </div>
          </AppDemoCard>

          {/* Alerts Box */}
          <div className="grid grid-cols-1 gap-4 md:col-span-6 lg:col-span-7 sm:grid-cols-2">
            <AppDemoCard className="relative flex min-h-[180px] flex-col justify-between overflow-hidden border-primary/25 bg-primary/5 hover:border-primary/40">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-10 -mt-10" />
               <div className="relative z-10 mb-3 flex items-center gap-3">
                 <div className="rounded-lg bg-primary/20 p-2.5">
                   <AlertTriangle className="h-5 w-5 text-primary" />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-primary">Atenção</span>
               </div>
               <div className="relative z-10">
                 <div className="mb-1 text-3xl font-black tracking-tighter text-white">{lowStockItems.length}</div>
                 <p className="text-xs font-bold leading-snug text-gray-400">Itens se aproximando do limite mínimo de estoque.</p>
               </div>
            </AppDemoCard>

            <AppDemoCard className="relative flex min-h-[180px] flex-col justify-between overflow-hidden border-red-500/25 bg-red-500/5 hover:border-red-500/40">
               <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 rounded-full blur-[50px] -mr-10 -mt-10" />
               <div className="relative z-10 mb-3 flex items-center gap-3">
                 <div className="rounded-lg bg-red-500/20 p-2.5">
                   <XCircle className="h-5 w-5 text-red-500" />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-red-500">Crítico</span>
               </div>
               <div className="relative z-10">
                 <div className="mb-1 text-3xl font-black tracking-tighter text-white">{outOfStockItems.length}</div>
                 <p className="text-xs font-bold leading-snug text-gray-400">Itens que acabaram e precisam de reposição urgente.</p>
               </div>
            </AppDemoCard>
          </div>

        </div>

        {/* Filters & Search - Glass style */}
        <div className="flex min-w-0 max-w-full flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-h-[44px] min-w-0 w-full max-w-full flex-nowrap gap-1 overflow-x-auto overscroll-x-contain p-1 touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:max-w-[55%] xl:max-w-none">
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'shrink-0 rounded-xl px-3 py-2 text-xs font-black transition-all whitespace-nowrap sm:px-5 sm:py-2.5 sm:text-sm',
                  activeCategory === cat 
                    ? "bg-primary text-black shadow-lg shadow-primary/20 scale-100" 
                    : "text-gray-400 hover:text-white hover:bg-white/5 scale-95 hover:scale-100"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="relative w-full min-w-0 max-w-full p-1 lg:max-w-md xl:w-96 xl:max-w-none">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar insumos, ferramentas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-all font-medium placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.length > 0 ? filteredProducts.map((product, idx) => {
          const status = getStatus(product);
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] p-1 transition-colors hover:border-[#2F3643] group flex flex-col"
            >
              {/* Product Background Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none opacity-50" />
              
              <div className="p-5 flex-1 flex flex-col gap-5 relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 mt-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">{product.categoria}</span>
                    <h4 className="text-xl font-black text-white group-hover:text-primary transition-colors leading-tight line-clamp-2">
                      {product.item}
                    </h4>
                  </div>
                  <div className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0", status.color, status.bg, status.border)}>
                    {status.label}
                  </div>
                </div>

                <div className="flex-1" />

                {/* Stock Controls - Minimalist Look */}
                <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-2">
                  <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">MIN: {product.quantidade_minima}</span>
                     <div className="flex items-baseline gap-1.5">
                       <span className="text-3xl font-black text-white leading-none tracking-tighter">{product.quantidade_atual}</span>
                       <span className="text-[10px] font-bold text-gray-500 uppercase">UN</span>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => adjustStock(product.id, -1)}
                      className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:bg-black hover:border-white/10 transition-all shadow-sm active:scale-95"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => adjustStock(product.id, 1)}
                      className="w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5 active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => deleteItem(product.id)}
                        className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 ml-2"
                        title="Excluir item"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        }) : (
          <div className="col-span-full py-20 text-center space-y-6 glass-panel rounded-3xl border border-dashed border-white/10">
            <div className="w-20 h-20 bg-primary/5 border border-primary/20 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-primary/5">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">Nenhum item encontrado</h3>
              <p className="text-gray-500 max-w-xs mx-auto font-medium">Seu almoxarifado ainda não possui itens cadastrados para esta categoria.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Novo Item */}
      <AnimatePresence>
        {isAddItemModalOpen && (
          <BodyPortal>
          <div className="fixed inset-0 z-[100] flex min-h-0 items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddItemModalOpen(false)}
              className="absolute inset-0 bg-black/[0.92] backdrop-blur-none"
            />
            <motion.div 
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[92dvh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1F1F1F] shadow-2xl sm:max-w-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h3 className="text-base font-black text-white sm:text-xl">Novo Item</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">Almoxarifado</p>
                </div>
                <button onClick={() => setIsAddItemModalOpen(false)} className="shrink-0 rounded-full p-2 text-gray-500 transition-colors hover:bg-white/5">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Nome do Item</label>
                  <input required type="text" value={formData.item}
                    onChange={e => setFormData({ ...formData, item: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all focus:border-primary"
                    placeholder="Ex: Vela de 7 Dias Branca" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Categoria</label>
                    <select value={formData.categoria}
                      onChange={e => setFormData({ ...formData, categoria: e.target.value as any })}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all focus:border-primary [&>option]:bg-[#1B1C1C]">
                      <option value="Limpeza">Limpeza</option>
                      <option value="Rituais">Rituais</option>
                      <option value="Cozinha de Santo">Cozinha</option>
                      <option value="Vestuário">Vestuário</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Qtd. Atual</label>
                    <input required type="number" value={formData.quantidade_atual}
                      onChange={e => setFormData({ ...formData, quantidade_atual: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all focus:border-primary" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Qtd. Mínima (Alerta)</label>
                  <input required type="number" value={formData.quantidade_minima}
                    onChange={e => setFormData({ ...formData, quantidade_minima: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white outline-none transition-all focus:border-primary" />
                </div>

                <button disabled={isSubmitting} type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-black text-background shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Cadastrar Item'}
                </button>
              </form>
            </motion.div>
          </div>
          </BodyPortal>
        )}
      </AnimatePresence>

      {/* Shopping List Modal */}
      <AnimatePresence>
        {isShoppingListOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsShoppingListOpen(false)}
              className="absolute inset-0 bg-background/[0.94] backdrop-blur-none"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1F1F1F] shadow-2xl sm:max-w-lg"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white sm:text-xl">Lista de Compras</h3>
                    <p className="text-xs text-gray-500 font-medium">Itens para reposição imediata.</p>
                  </div>
                </div>
                <button onClick={() => setIsShoppingListOpen(false)} className="shrink-0 rounded-xl p-2 text-gray-500 transition-colors hover:bg-white/5">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="rounded-2xl border border-white/5 bg-background/50 p-4 font-mono text-sm leading-relaxed text-gray-300 whitespace-pre-wrap sm:p-6">
                  {generateShoppingListText()}
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-white/5 bg-background/30 px-5 py-4 sm:px-6">
                <button onClick={copyToClipboard}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 py-3 font-black text-white transition-all hover:bg-white/10">
                  {copied ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                  <span className="text-sm">{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(generateShoppingListText())}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-black text-background shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-sm">WhatsApp</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </AppPageShell>
  );
}
