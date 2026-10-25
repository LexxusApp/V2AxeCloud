import DataLoadError from '../DataLoadError';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Coffee,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Sliders,
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
  User,
  ShoppingBag,
  X,
  Loader2,
  Trash2,
  Sparkles,
  QrCode,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Layers,
  Flame,
  Leaf,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '../../lib/authenticatedFetch';
import { showHouseToast } from '../../lib/houseToast';
import { confirmAction } from '../../lib/confirmAction';
import { cn } from '../../lib/utils';
import { buildCantinaWhatsAppMessage, buildWhatsAppLink } from '../../lib/cantinaFeature';
import { AxeMetricRail, AxeMetricCard } from '../shared/AxePageScaffold';
import BodyPortal from '../BodyPortal';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';

export interface CantinaFilho {
  id: string;
  nome: string;
  foto_url: string | null;
  cargo: string | null;
  whatsapp_phone: string | null;
  limite_lojinha: number;
  bloquear_fiado_loja: boolean;
  saldo_pendente: number;
  saldo_disponivel: number;
  total_pago_mes: number;
  bloqueado: boolean;
  historico?: CantinaTransaction[];
  historico_total?: number;
  pedidos_pendentes: Array<{
    id: string;
    data: string;
    descricao: string;
    valor: number;
    status: string;
  }>;
}

export interface CantinaStats {
  total_pendente: number;
  total_recebido_mes: number;
  total_vendas_mes: number;
  filhos_com_pendencia: number;
  total_filhos: number;
}

export interface CantinaTransaction {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  status: string;
  categoria: string;
  tipo: string;
  filho_id: string | null;
  created_at?: string;
  cantina_itens?: Array<{ nome: string; quantidade: number; preco: number }> | null;
}

interface CantinaViewProps {
  tenantId: string;
  userId: string;
  terreiroNome?: string;
  chavePix?: string;
}

export interface CantinaMenuItem {
  id: string;
  nome: string;
  preco: number;
  icon: string;
  cat: 'bebidas' | 'comidas' | 'liturgia' | string;
  badge: string | null;
}

const LEGACY_MENU_ITEMS: CantinaMenuItem[] = [
  { id: '1', nome: 'Café de Terreiro', preco: 3.5, icon: '☕', cat: 'bebidas', badge: 'Quente' },
  { id: '2', nome: 'Salgado Assado', preco: 7.5, icon: '🥟', cat: 'comidas', badge: 'Fresco' },
  { id: '3', nome: 'Água Mineral 500ml', preco: 3.5, icon: '💧', cat: 'bebidas', badge: 'Gelada' },
  { id: '4', nome: 'Refrigerante Lata', preco: 5.0, icon: '🥤', cat: 'bebidas', badge: null },
  { id: '5', nome: 'Suco Natural', preco: 6.0, icon: '🧃', cat: 'bebidas', badge: null },
  { id: '6', nome: 'Vela de 7 Dias Branca', preco: 12.0, icon: '🕯️', cat: 'liturgia', badge: 'Sagrado' },
  { id: '7', nome: 'Banho de Ervas Frescas', preco: 15.0, icon: '🌿', cat: 'liturgia', badge: 'Erveiro' },
  { id: '8', nome: 'Defumador em Tablete', preco: 8.0, icon: '💨', cat: 'liturgia', badge: null },
  { id: '9', nome: 'Bolo Caseiro (Fatia)', preco: 4.5, icon: '🍰', cat: 'comidas', badge: 'Caseiro' },
  { id: '10', nome: 'Doce de Cosme', preco: 3.0, icon: '🍬', cat: 'doces', badge: 'Cosme' },
  { id: '11', nome: 'Mel Puro de Terreiro', preco: 18.0, icon: '🍯', cat: 'liturgia', badge: 'Puro' },
  { id: '12', nome: 'Biscoito de Polvilho', preco: 5.0, icon: '🍪', cat: 'comidas', badge: null },
];

export default function CantinaView({
  tenantId,
  userId,
  terreiroNome = 'Terreiro Sagrado',
  chavePix,
}: CantinaViewProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pdv' | 'caderneta' | 'extrato'>('pdv');
  const [filhos, setFilhos] = useState<CantinaFilho[]>([]);
  const [stats, setStats] = useState<CantinaStats>({
    total_pendente: 0,
    total_recebido_mes: 0,
    total_vendas_mes: 0,
    filhos_com_pendencia: 0,
    total_filhos: 0,
  });
  const [transactions, setTransactions] = useState<CantinaTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'todos' | 'pendentes' | 'bloqueados'>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  // Gerenciamento dinâmico de itens fixos do cardápio
  const storageKey = `axecloud_cantina_menu_${tenantId || 'default'}`;
  const readMenuItems = (): CantinaMenuItem[] => {
    if (!tenantId) return [];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(saved)) return [];
      // Remove apenas os itens padrão intactos; preserva cadastros e edições da casa.
      return saved.filter((item) => !LEGACY_MENU_ITEMS.some((legacy) =>
        Object.keys(legacy).every((key) => item[key] === legacy[key as keyof CantinaMenuItem])
      ));
    } catch {
      return [];
    }
  };
  const [menuItems, setMenuItems] = useState<CantinaMenuItem[]>(readMenuItems);
  useEffect(() => {
    setMenuItems(readMenuItems());
  }, [tenantId]);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CantinaMenuItem | null>(null);
  const [itemForm, setItemForm] = useState<{
    nome: string;
    preco: string;
    icon: string;
    cat: string;
    badge: string;
  }>({
    nome: '',
    preco: '',
    icon: '☕',
    cat: 'comidas',
    badge: '',
  });

  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      nome: '',
      preco: '',
      icon: '🥟',
      cat: 'comidas',
      badge: '',
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: CantinaMenuItem) => {
    setEditingItem(item);
    setItemForm({
      nome: item.nome,
      preco: item.preco.toString().replace('.', ','),
      icon: item.icon || '☕',
      cat: item.cat || 'comidas',
      badge: item.badge || '',
    });
    setIsItemModalOpen(true);
  };

  const handleSaveMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.nome.trim()) {
      showHouseToast('Nome obrigatório. Digite o nome do produto.', 'error');
      return;
    }
    const cleanPrice = parseFloat(itemForm.preco.replace(',', '.'));
    if (isNaN(cleanPrice) || cleanPrice < 0) {
      showHouseToast('Preço inválido. Digite um valor numérico válido (ex: 7,50).', 'error');
      return;
    }

    let updated: CantinaMenuItem[];
    if (editingItem) {
      updated = menuItems.map((m) =>
        m.id === editingItem.id
          ? {
              ...m,
              nome: itemForm.nome.trim(),
              preco: cleanPrice,
              icon: itemForm.icon || '☕',
              cat: itemForm.cat,
              badge: itemForm.badge.trim() || null,
            }
          : m
      );
      showHouseToast(`Item atualizado! "${itemForm.nome}" foi atualizado no cardápio fixo.`, 'success');
    } else {
      const newItem: CantinaMenuItem = {
        id: `item-${Date.now()}`,
        nome: itemForm.nome.trim(),
        preco: cleanPrice,
        icon: itemForm.icon || '☕',
        cat: itemForm.cat,
        badge: itemForm.badge.trim() || null,
      };
      updated = [...menuItems, newItem];
      showHouseToast(`Item adicionado! "${itemForm.nome}" foi cadastrado com sucesso.`, 'success');
    }

    setMenuItems(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    setIsItemModalOpen(false);
  };

  const handleDeleteMenuItem = async (id: string) => {
    const confirmed = await confirmAction({
      title: 'Remover item do cardápio?',
      description: 'Deseja realmente remover este item fixo do cardápio?',
      confirmLabel: 'Remover item',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;
    const updated = menuItems.filter((m) => m.id !== id);
    setMenuItems(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    showHouseToast('Item removido do cardápio fixo.', 'info');
    setIsItemModalOpen(false);
  };

  const handleClearMenu = async () => {
    const confirmed = await confirmAction({
      title: 'Limpar cardápio?',
      description: 'Deseja remover os itens deste cardápio local?',
      confirmLabel: 'Limpar cardápio',
      cancelLabel: 'Cancelar',
      tone: 'warning',
    });
    if (!confirmed) return;
    setMenuItems([]);
    try {
      localStorage.setItem(storageKey, '[]');
    } catch {}
    showHouseToast('Cardápio limpo. Cadastre os produtos e preços da sua casa.', 'success');
  };

  // Comanda do Balcão (PDV em tempo real)
  const [selectedFilhoId, setSelectedFilhoId] = useState<string>('avulso');
  const [cartItems, setCartItems] = useState<Array<{ nome: string; quantidade: number; preco: number }>>([]);
  const [customItemNome, setCustomItemNome] = useState('');
  const [customItemPreco, setCustomItemPreco] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'fiado' | 'pago'>('pago');
  const [isSubmittingConsumo, setIsSubmittingConsumo] = useState(false);

  // Modal Ajuste de Limite
  const [editingFilho, setEditingFilho] = useState<CantinaFilho | null>(null);
  const [novoLimite, setNovoLimite] = useState(100);
  const [bloquearFiado, setBloquearFiado] = useState(false);
  const [isSavingLimite, setIsSavingLimite] = useState(false);

  // Modal Extrato do Filho
  const [viewingFilhoExtrato, setViewingFilhoExtrato] = useState<CantinaFilho | null>(null);
  const comandaAttempt = useRef<{ signature: string; id: string } | null>(null);

  const fetchCantinaData = async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      if (!tenantId) {
        setFilhos([]);
        setTransactions([]);
        setStats({ total_pendente: 0, total_recebido_mes: 0, total_vendas_mes: 0, filhos_com_pendencia: 0, total_filhos: 0 });
        return;
      }
      const res = await authFetch(`/api/v1/cantina/data?tenantId=${encodeURIComponent(tenantId)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Falha ao carregar a cantina');
      if (!Array.isArray(payload.filhos) || !Array.isArray(payload.transactions) || !payload.stats) {
        throw new Error('Resposta da cantina inválida');
      }
      setFilhos(payload.filhos);
      setStats(payload.stats);
      setTransactions(payload.transactions);
    } catch (error) {
      console.error('Error fetching cantina:', error);
      setFilhos([]);
      setTransactions([]);
      setStats({ total_pendente: 0, total_recebido_mes: 0, total_vendas_mes: 0, filhos_com_pendencia: 0, total_filhos: 0 });
      setLoadError('Não foi possível carregar os saldos e lançamentos da cantina. Tente novamente.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCantinaData();
  }, [tenantId]);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const filteredFilhos = useMemo(() => {
    return filhos.filter((f) => {
      const matchesSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filterMode === 'pendentes') return f.saldo_pendente > 0;
      if (filterMode === 'bloqueados') return f.bloqueado;
      return true;
    });
  }, [filhos, searchTerm, filterMode]);

  const selectedFilho = useMemo(
    () => filhos.find((f) => f.id === selectedFilhoId) || null,
    [filhos, selectedFilhoId]
  );

  const totalNovoConsumo = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.preco * item.quantidade, 0),
    [cartItems]
  );

  const handleAddQuickItem = (item: { nome: string; preco: number }) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.nome === item.nome);
      if (existing) {
        return prev.map((i) =>
          i.nome === item.nome ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [...prev, { nome: item.nome, quantidade: 1, preco: item.preco }];
    });
  };

  const handleAddCustomItem = () => {
    const nome = customItemNome.trim();
    const preco = Number(customItemPreco.replace(',', '.'));
    if (!nome) {
      showHouseToast('Informe o nome do item', 'info');
      return;
    }
    if (!Number.isFinite(preco) || preco <= 0) {
      showHouseToast('Informe um valor válido', 'info');
      return;
    }
    handleAddQuickItem({ nome, preco });
    setCustomItemNome('');
    setCustomItemPreco('');
  };

  const handleRemoveCartItem = (nome: string) => {
    setCartItems((prev) => prev.filter((i) => i.nome !== nome));
  };

  const handleUpdateCartItemQty = (nome: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((i) => {
          if (i.nome === nome) {
            const novaQtd = i.quantidade + delta;
            return novaQtd > 0 ? { ...i, quantidade: novaQtd } : null;
          }
          return i;
        })
        .filter(Boolean) as Array<{ nome: string; quantidade: number; preco: number }>
    );
  };

  const handleFinalizarComanda = async (tipo: 'pago' | 'fiado') => {
    if (cartItems.length === 0) {
      showHouseToast('Adicione itens à comanda antes de finalizar.', 'info');
      return;
    }

    if (tipo === 'fiado' && selectedFilhoId === 'avulso') {
      showHouseToast('Para lançar na caderneta (fiado), selecione o médium / filho de santo.', 'info');
      return;
    }

    if (tipo === 'fiado' && selectedFilho) {
      if (selectedFilho.bloquear_fiado_loja) {
        showHouseToast('Este médium está com o fiado bloqueado!', 'error');
        return;
      }
      if (selectedFilho.saldo_pendente + totalNovoConsumo > selectedFilho.limite_lojinha) {
        showHouseToast(
          `Limite excedido! Disponível: ${formatBRL(selectedFilho.saldo_disponivel)}, Tentando lançar: ${formatBRL(totalNovoConsumo)}`,
          'error'
        );
        return;
      }
    }

    setIsSubmittingConsumo(true);
    try {
      const descricao = cartItems.map((i) => `${i.quantidade}x ${i.nome}`).join(', ');
      const signature = JSON.stringify({ tenantId, selectedFilhoId, tipo, cartItems });
      if (comandaAttempt.current?.signature !== signature) {
        comandaAttempt.current = { signature, id: crypto.randomUUID() };
      }

      const res = await authFetch('/api/v1/cantina/consumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          filhoId: selectedFilhoId === 'avulso' ? null : selectedFilhoId,
          descricao,
          valor: totalNovoConsumo,
          formaPagamento: tipo,
          itens: cartItems,
          comandaId: comandaAttempt.current.id,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Não foi possível registrar a venda.');
      if (!result.success || !result.transaction?.id) {
        throw new Error('O registro da comanda não foi confirmado. Sua comanda foi mantida.');
      }
      showHouseToast(
        tipo === 'fiado'
          ? `Lançado na caderneta de ${selectedFilho?.nome || 'Médium'} com sucesso!`
          : `Venda de ${formatBRL(totalNovoConsumo)} recebida com sucesso!`,
        'success'
      );

      setCartItems([]);
      comandaAttempt.current = null;
      setSelectedFilhoId('avulso');
      await fetchCantinaData(true);
    } catch (e: any) {
      showHouseToast(e.message || 'Não foi possível registrar a venda. Sua comanda foi mantida.', 'error');
    } finally {
      setIsSubmittingConsumo(false);
    }
  };

  const handleLiquidarFilho = async (filho: CantinaFilho) => {
    if (filho.saldo_pendente <= 0) {
      showHouseToast('Este médium não possui débitos pendentes na cantina.', 'info');
      return;
    }

    const confirmed = await confirmAction({
      title: `Quitar caderneta de ${filho.nome}?`,
      description: `Será dado baixa no valor total de ${formatBRL(filho.saldo_pendente)}. O médium ficará com saldo zerado.`,
      confirmLabel: 'Confirmar Quitação',
      tone: 'primary',
    });
    if (!confirmed) return;

    try {
      const res = await authFetch('/api/v1/cantina/liquidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, filhoId: filho.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Não foi possível quitar a caderneta.');
      showHouseToast(`Conta de ${filho.nome} quitada com sucesso!`, 'success');
      setFilhos((prev) =>
        prev.map((f) => (f.id === filho.id ? { ...f, saldo_pendente: 0, saldo_disponivel: f.limite_lojinha } : f))
      );
      await fetchCantinaData(true);
    } catch (e: any) {
      showHouseToast(e.message || 'Não foi possível quitar a caderneta.', 'error');
    }
  };

  const handleSalvarLimite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFilho) return;

    setIsSavingLimite(true);
    try {
      const res = await authFetch('/api/v1/cantina/limite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          filhoId: editingFilho.id,
          limite_lojinha: novoLimite,
          bloquear_fiado_loja: bloquearFiado,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Não foi possível atualizar o limite.');
      showHouseToast('Limite e permissões atualizados!', 'success');
      setFilhos((prev) =>
        prev.map((f) =>
          f.id === editingFilho.id
            ? { ...f, limite_lojinha: novoLimite, bloquear_fiado_loja: bloquearFiado, saldo_disponivel: novoLimite - f.saldo_pendente }
            : f
        )
      );
      setEditingFilho(null);
    } catch (e: any) {
      showHouseToast(e.message || 'Não foi possível atualizar o limite.', 'error');
    } finally {
      setIsSavingLimite(false);
    }
  };

  const handleOpenWhatsApp = (filho: CantinaFilho) => {
    const msg = buildCantinaWhatsAppMessage(filho, terreiroNome, chavePix);
    const link = buildWhatsAppLink(filho.whatsapp_phone, msg);
    window.open(link, '_blank');
  };

  const filteredMenuItems = useMemo(() => {
    if (selectedCategory === 'todos') return menuItems;
    return menuItems.filter((i) => i.cat === selectedCategory);
  }, [selectedCategory, menuItems]);

  return (
    <div className="cantina-view space-y-6">
      <DataLoadError message={loadError} onRetry={() => void fetchCantinaData()} />
      {/* 1. Indicadores Litúrgicos da Cantina */}
      <AxeMetricRail>
        <AxeMetricCard
          label="A Receber na Caderneta"
          value={formatBRL(stats.total_pendente)}
          icon={Clock}
          tone="amber"
          subtext={`${stats.filhos_com_pendencia} médium(ns) em aberto`}
        />
        <AxeMetricCard
          label="Recebido no Mês"
          value={formatBRL(stats.total_recebido_mes)}
          icon={CheckCircle2}
          tone="emerald"
          subtext="Vendas quitadas no caixa"
        />
        <AxeMetricCard
          label="Movimentação Geral"
          value={formatBRL(stats.total_vendas_mes)}
          icon={TrendingUp}
          tone="neutral"
          subtext="Volume total da cantina"
        />
        <AxeMetricCard
          label="Itens na Comanda Atual"
          value={cartItems.reduce((acc, curr) => acc + curr.quantidade, 0)}
          icon={Coffee}
          tone="purple"
          subtext={formatBRL(totalNovoConsumo)}
        />
      </AxeMetricRail>

      {/* 2. Seletor de Visão (Balcão PDV vs Caderneta dos Médiuns) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-lg border border-[#E5DECF] bg-white p-2 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FAF8F5] border border-[#EBE4D8]">
          <button
            type="button"
            onClick={() => setActiveTab('pdv')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition-all",
              activeTab === 'pdv'
                ? "bg-[#142A20] text-amber-300 shadow-md"
                : "text-[#6B6355] hover:text-[#171A16]"
            )}
          >
            <Coffee className="h-4 w-4" />
            <span>Balcão Rápido (PDV)</span>
            {cartItems.length > 0 && (
              <span className="rounded-full bg-amber-400 text-[#09140E] text-[10px] font-black px-1.5 py-0.2">
                {cartItems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('caderneta')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition-all",
              activeTab === 'caderneta'
                ? "bg-[#142A20] text-amber-300 shadow-md"
                : "text-[#6B6355] hover:text-[#171A16]"
            )}
          >
            <User className="h-4 w-4" />
            <span>Caderneta dos Médiuns</span>
            <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5">
              {filhos.length}
            </span>
          </button>
        </div>

        {activeTab === 'caderneta' && (
          <div className="flex items-center gap-2 px-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9B9184]" />
              <input
                type="text"
                placeholder="Buscar médium…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] pl-9 pr-3 py-2 text-xs font-bold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] p-1">
              <button
                type="button"
                onClick={() => setFilterMode('todos')}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[10px] font-black transition",
                  filterMode === 'todos' ? "bg-amber-400 text-[#09140E]" : "text-[#7A7265]"
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('pendentes')}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[10px] font-black transition",
                  filterMode === 'pendentes' ? "bg-amber-500 text-white" : "text-[#7A7265]"
                )}
              >
                Com Débito
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. CONTEÚDO PRINCIPAL: ABA 1 - BALCÃO RÁPIDO & PDV */}
      {activeTab === 'pdv' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lado Esquerdo: Catálogo de Itens Touch (7 Colunas) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Categorias do Cardápio e Ação de Adicionar Item */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1 min-w-0">
                {[
                  { id: 'todos', label: 'Tudo', icon: null },
                  { id: 'bebidas', label: 'Bebidas & Café', icon: '☕' },
                  { id: 'comidas', label: 'Salgados & Doces', icon: '🥟' },
                  { id: 'liturgia', label: 'Itens Litúrgicos', icon: '🌿' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer",
                      selectedCategory === c.id
                        ? "bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] text-[#0A160F] shadow-sm"
                        : "bg-white border border-[#E5DECF] text-[#4A4235] hover:bg-[#FAF8F5]"
                    )}
                  >
                    {c.icon && <span>{c.icon}</span>}
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreateItem}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0f1411] px-3.5 py-2 text-xs font-black text-[#f6c94c] hover:bg-[#1a261c] border border-amber-500/40 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Cadastrar novo item fixo no cardápio"
                >
                  <Plus className="h-3.5 w-3.5 text-[#f6c94c]" />
                  <span>+ Novo Item Fixo</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearMenu}
                  className="text-[10px] text-[#7A7265] hover:text-[#171A16] underline decoration-dotted px-1 cursor-pointer"
                  title="Limpar cardápio local"
                >
                  Limpar cardápio
                </button>
              </div>
            </div>

            {/* Grid dos Produtos da Cantina */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredMenuItems.length === 0 && (
                <p className="col-span-full rounded-lg border border-dashed border-[#E5DECF] p-6 text-center text-sm text-[#6B6355]">
                  Nenhum item neste cardápio. Cadastre os produtos e preços da sua casa.
                </p>
              )}
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddQuickItem(item)}
                  className="group relative flex flex-col justify-between rounded-lg border border-[#E5DECF] bg-white p-4 text-left transition-all hover:border-[#D4AF37] hover:shadow-md active:scale-95 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-800 border border-amber-200">
                          {item.badge}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditItem(item);
                        }}
                        className="p-1 rounded-md text-stone-400 hover:text-amber-800 hover:bg-amber-100/70 transition-all cursor-pointer"
                        title="Editar nome, preço, ícone ou selo deste item"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <h4 className="text-xs font-bold text-[#171A16] line-clamp-1 group-hover:text-amber-800 transition-colors">
                      {item.nome}
                    </h4>
                    <p className="mt-1 text-sm font-black text-emerald-800">
                      {formatBRL(item.preco)}
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-[#F2ECE1] pt-2 text-[10px] font-bold text-[#7A7265] group-hover:text-[#171A16]">
                    <span>Toque p/ somar</span>
                    <Plus className="h-3.5 w-3.5 text-amber-600 group-hover:scale-125 transition-transform" />
                  </div>
                </button>
              ))}
            </div>

            {/* Item Avulso Rápido */}
            <div className="rounded-lg border border-[#E5DECF] bg-[#FAF8F5] p-4">
              <h5 className="text-xs font-black uppercase tracking-wider text-[#4A4235] mb-2 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-amber-600" />
                Lançar Item Avulso / Não Listado
              </h5>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome do produto (ex: Guaraná 2L)"
                  value={customItemNome}
                  onChange={(e) => setCustomItemNome(e.target.value)}
                  className="w-full rounded-xl border border-[#D8D2C4] bg-white px-3.5 py-2.5 text-xs font-bold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#D4AF37] focus:outline-none"
                />
                <div className="relative w-full sm:w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A7265]">R$</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={customItemPreco}
                    onChange={(e) => setCustomItemPreco(e.target.value)}
                    className="w-full rounded-xl border border-[#D8D2C4] bg-white pl-8 pr-3 py-2.5 text-xs font-bold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="w-full sm:w-auto shrink-0 rounded-xl bg-[#142A20] px-4 py-2.5 text-xs font-black text-amber-300 hover:brightness-110 active:scale-95 transition-all"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* Lado Direito: Comanda Ativa & Finalização (5 Colunas) */}
          <div className="lg:col-span-5 rounded-lg border border-[#D4AF37]/40 bg-white p-5 shadow-lg relative overflow-hidden">
            {/* Header da Comanda */}
            <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-800">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#171A16]">Comanda do Terreiro</h3>
                  <p className="text-[10px] text-[#7A7265]">Balcão de Atendimento</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCartItems([])}
                disabled={cartItems.length === 0}
                className="text-[10px] font-bold text-rose-600 hover:underline disabled:opacity-40"
              >
                Limpar Comanda
              </button>
            </div>

            {/* Seletor do Cliente / Médium */}
            <div className="my-4 space-y-1.5">
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4A4235]">
                Destinatário do Consumo
              </label>
              <select
                value={selectedFilhoId}
                onChange={(e) => setSelectedFilhoId(e.target.value)}
                className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2.5 text-xs font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
              >
                <option value="avulso">Consulente / Venda Avulsa (À Vista)</option>
                <optgroup label="Médiuns da Corrente">
                  {filhos.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} {f.saldo_pendente > 0 ? `(Débito: ${formatBRL(f.saldo_pendente)})` : '(Zerado)'}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Alerta de Crédito se filho selecionado */}
            {selectedFilho && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#4A4235]">Limite da Caderneta:</span>
                  <span className="font-black text-[#171A16]">{formatBRL(selectedFilho.limite_lojinha)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[#6B6355]">Disponível para Fiado:</span>
                  <span className={cn("font-black", selectedFilho.saldo_disponivel <= 20 ? "text-rose-600" : "text-emerald-700")}>
                    {formatBRL(selectedFilho.saldo_disponivel)}
                  </span>
                </div>
              </div>
            )}

            {/* Lista dos Itens na Comanda */}
            <div className="min-h-[160px] max-h-[260px] overflow-y-auto divide-y divide-[#F2ECE1] pr-1">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-[#9B9184]">
                  <Coffee className="h-8 w-8 mb-2 opacity-40 text-amber-800" />
                  <p className="text-xs font-bold text-[#4A4235]">Comanda vazia</p>
                  <p className="text-[10px] text-[#7A7265] mt-0.5">Toque nos itens do cardápio ao lado para somar.</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.nome} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-[#171A16] truncate">{item.nome}</p>
                      <p className="text-[10px] text-[#7A7265]">
                        {formatBRL(item.preco)} un. • Subtotal: {formatBRL(item.preco * item.quantidade)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateCartItemQty(item.nome, -1)}
                        className="grid h-6 w-6 place-items-center rounded-lg bg-[#FAF8F5] border border-[#D8D2C4] text-[#171A16] hover:bg-[#F0EAE0]"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-black text-[#171A16]">
                        {item.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateCartItemQty(item.nome, 1)}
                        className="grid h-6 w-6 place-items-center rounded-lg bg-[#FAF8F5] border border-[#D8D2C4] text-[#171A16] hover:bg-[#F0EAE0]"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(item.nome)}
                        className="ml-1 text-[#9B9184] hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total e Botões de Fechamento */}
            <div className="mt-4 pt-4 border-t border-[#F0EAE0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6B6355]">Total da Comanda:</span>
                <span className="text-xl font-black text-emerald-800">
                  {formatBRL(totalNovoConsumo)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={cartItems.length === 0 || isSubmittingConsumo}
                  onClick={() => handleFinalizarComanda('pago')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-3 text-xs font-black text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-40"
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Pago no Pix/Dinheiro</span>
                </button>

                <button
                  type="button"
                  disabled={cartItems.length === 0 || isSubmittingConsumo}
                  onClick={() => handleFinalizarComanda('fiado')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] px-3 py-3 text-xs font-black text-[#0A160F] hover:brightness-105 active:scale-95 transition-all shadow-sm disabled:opacity-40"
                >
                  <Receipt className="h-4 w-4" />
                  <span>Anotar na Caderneta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONTEÚDO PRINCIPAL: ABA 2 - CADERNETA DOS MÉDIUNS */}
      {activeTab === 'caderneta' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFilhos.map((filho) => {
            const perc = filho.limite_lojinha > 0
              ? Math.min(100, Math.round((filho.saldo_pendente / filho.limite_lojinha) * 100))
              : 0;
            const isExceeded = filho.saldo_pendente >= filho.limite_lojinha && filho.limite_lojinha > 0;

            return (
              <div
                key={filho.id}
                className={cn(
                  "rounded-lg border p-5 transition-all bg-white shadow-xs flex flex-col justify-between",
                  isExceeded
                    ? "border-rose-300 ring-2 ring-rose-200"
                    : filho.saldo_pendente > 0
                    ? "border-amber-300"
                    : "border-[#E5DECF]"
                )}
              >
                <div>
                  {/* Topo do Card com Avatar e Cargo */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-800 font-black text-sm border border-amber-200">
                        {filho.nome.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-[#171A16] line-clamp-1">{filho.nome}</h4>
                        <p className="text-[10px] font-bold text-[#7A7265]">{filho.cargo || 'Médium de Santo'}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-black uppercase border",
                      filho.saldo_pendente > 0
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    )}>
                      {filho.saldo_pendente > 0 ? 'Em Aberto' : 'Em Dia'}
                    </span>
                  </div>

                  {/* Saldo e Barra de Limite */}
                  <div className="my-4 p-3 rounded-xl bg-[#FAF8F5] border border-[#EBE4D8] space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-[#6B6355]">Débito Acumulado:</span>
                      <span className={cn(
                        "text-base font-black",
                        filho.saldo_pendente > 0 ? "text-amber-800" : "text-emerald-700"
                      )}>
                        {formatBRL(filho.saldo_pendente)}
                      </span>
                    </div>

                    {/* Progress Bar do Limite */}
                    <div>
                      <div className="flex justify-between text-[10px] text-[#7A7265] mb-1 font-semibold">
                        <span>Limite: {formatBRL(filho.limite_lojinha)}</span>
                        <span>{perc}% utilizado</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#E5DECF] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            perc > 80 ? "bg-rose-500" : perc > 50 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${perc}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumo dos últimos consumos do filho */}
                  {filho.pedidos_pendentes && filho.pedidos_pendentes.length > 0 && (
                    <div className="space-y-1 mb-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#7A7265]">Últimos Lançamentos:</p>
                      {filho.pedidos_pendentes.slice(0, 2).map((p) => (
                        <div key={p.id} className="flex justify-between text-[11px] text-[#4A4235] truncate">
                          <span className="truncate max-w-[170px]">{p.descricao}</span>
                          <span className="font-bold text-[#171A16]">{formatBRL(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingFilhoExtrato(filho)}
                    className="mb-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D8D2C4] px-3 py-2 text-xs font-bold text-[#1C4031] hover:bg-[#FAF8F5]"
                  >
                    <Receipt className="h-4 w-4" />
                    Ver extrato de consumo
                  </button>
                </div>

                {/* Ações: Quitar e Cobrar WhatsApp */}
                <div className="pt-3 border-t border-[#F0EAE0] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLiquidarFilho(filho)}
                    disabled={filho.saldo_pendente <= 0}
                    title={filho.saldo_pendente <= 0 ? 'Sem débitos pendentes para dar baixa' : 'Registrar o recebimento da caderneta'}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Dar Baixa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenWhatsApp(filho)}
                    disabled={filho.saldo_pendente <= 0}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-white px-3 py-2 text-xs font-black hover:bg-[#20bd5a] active:scale-95 transition-all disabled:opacity-40"
                    title={filho.saldo_pendente <= 0 ? 'Sem débitos pendentes para avisar' : 'Preparar aviso no WhatsApp'}
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Avisar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingFilho(filho);
                      setNovoLimite(filho.limite_lojinha);
                      setBloquearFiado(filho.bloquear_fiado_loja);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-xl border border-[#D8D2C4] text-[#6B6355] hover:bg-[#FAF8F5]"
                    title="Ajustar Limite"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BodyPortal>
        {viewingFilhoExtrato && (() => {
          const member = filhos.find(f => f.id === viewingFilhoExtrato.id) || viewingFilhoExtrato;
          const history = member.historico || [];
          return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setViewingFilhoExtrato(null)} />
              <section role="dialog" aria-modal="true" aria-labelledby="cantina-extrato-title" className="relative max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E5DECF] bg-white p-5 shadow-2xl sm:p-6">
                <header className="mb-5 flex items-start justify-between gap-3 border-b border-[#F0EAE0] pb-4">
                  <div className="min-w-0">
                    <h3 id="cantina-extrato-title" className="text-lg font-black text-[#171A16]">Extrato de consumo</h3>
                    <p className="break-words text-sm text-[#6B6355]">{member.nome}</p>
                    <p className="mt-2 text-sm font-bold text-amber-800">Em aberto: {formatBRL(member.saldo_pendente)}</p>
                  </div>
                  <button type="button" aria-label="Fechar extrato" onClick={() => setViewingFilhoExtrato(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-[#FAF8F5]"><X className="h-5 w-5" /></button>
                </header>
                {history.length === 0 ? <p className="py-8 text-center text-sm text-[#6B6355]">Nenhum consumo registrado para este membro.</p> : (
                  <div className="space-y-4">
                    {history.map(tx => (
                      <article key={tx.id} className="rounded-xl border border-[#E5DECF] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6355]">
                          <time>{new Date(tx.created_at || `${tx.data}T12:00:00`).toLocaleString('pt-BR')}</time>
                          <span className={cn('rounded-full px-2 py-1 font-bold', tx.status === 'pago' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>{tx.status === 'pago' ? 'Pago' : 'Em aberto'}</span>
                        </div>
                        {tx.cantina_itens?.length ? <ul className="space-y-3">
                          {tx.cantina_itens.map((item, index) => <li key={index} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0"><p className="break-words font-bold text-[#171A16]">{item.quantidade}× {item.nome}</p><p className="text-xs text-[#6B6355]">{formatBRL(item.preco)} por unidade</p></div>
                            <strong className="shrink-0 text-[#1C4031]">{formatBRL(item.quantidade * item.preco)}</strong>
                          </li>)}
                        </ul> : <p className="break-words text-sm text-[#4A4235]">{tx.descricao}</p>}
                        <div className="mt-3 flex justify-between gap-3 border-t border-[#F0EAE0] pt-3 text-sm font-black"><span>Total da comanda</span><span>{formatBRL(tx.valor)}</span></div>
                      </article>
                    ))}
                    {(member.historico_total || 0) > history.length && <p className="text-xs text-[#6B6355]">Exibindo os {history.length} consumos mais recentes.</p>}
                  </div>
                )}
              </section>
            </div>
          );
        })()}
      </BodyPortal>

      {/* Modal Cadastrar / Editar Item Fixo da Cantina */}
      <BodyPortal>
        <AnimatePresence>
          {isItemModalOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
              <motion.div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsItemModalOpen(false)}
              />
              <motion.div
                className="relative z-10 w-full max-w-md bg-white border border-[#E5DECF] p-6 rounded-lg shadow-2xl"
                initial={MODAL_PANEL_IN}
                animate={MODAL_PANEL_DONE}
                exit={MODAL_PANEL_OUT}
                transition={MODAL_TW}
              >
                  <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{itemForm.icon || '☕'}</span>
                      <h3 className="text-base font-black text-[#171A16]">
                        {editingItem ? 'Editar Item do Cardápio' : 'Novo Item Fixo da Cantina'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsItemModalOpen(false)}
                      className="text-[#9B9184] hover:text-[#171A16] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveMenuItem} className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1">
                        Nome do Produto *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Pastel de Queijo, Chá de Ervas..."
                        value={itemForm.nome}
                        onChange={(e) => setItemForm({ ...itemForm, nome: e.target.value })}
                        className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2.5 text-sm font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1">
                          Preço de Venda (R$) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 7,50"
                          value={itemForm.preco}
                          onChange={(e) => setItemForm({ ...itemForm, preco: e.target.value })}
                          className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2.5 text-sm font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1">
                          Categoria
                        </label>
                        <select
                          value={itemForm.cat}
                          onChange={(e) => setItemForm({ ...itemForm, cat: e.target.value })}
                          className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3 py-2.5 text-xs font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                        >
                          <option value="bebidas">☕ Bebidas & Café</option>
                          <option value="comidas">🥟 Salgados & Doces</option>
                          <option value="liturgia">🌿 Itens Litúrgicos</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1.5">
                        Ícone / Emoji
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={itemForm.icon}
                          onChange={(e) => setItemForm({ ...itemForm, icon: e.target.value })}
                          className="w-14 text-center rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] py-2 text-xl font-bold focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                          maxLength={4}
                        />
                        <span className="text-[11px] text-[#7A7265]">
                          Toque em um ícone abaixo ou digite qualquer emoji
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-[#FAF8F5] border border-[#E5DECF] max-h-24 overflow-y-auto">
                        {[
                          '☕', '🥟', '💧', '🥤', '🧃', '🕯️', '🌿', '💨', '🍰', '🍬',
                          '🍯', '🍪', '🥪', '🍞', '🫔', '🥥', '🍵', '🍛', '🍎', '🍫',
                          '📿', '✨', '⚡', '🥧', '🧇', '🥞', '🥐', '🍶', '📦'
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setItemForm({ ...itemForm, icon: emoji })}
                            className={cn(
                              "h-8 w-8 text-base rounded-lg flex items-center justify-center transition-all cursor-pointer",
                              itemForm.icon === emoji
                                ? "bg-[#D4AF37] text-white shadow-xs scale-110"
                                : "hover:bg-white bg-transparent"
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1.5">
                        Selo / Badge (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Quente, Fresco, Sagrado, Caseiro, Gelada..."
                        value={itemForm.badge}
                        onChange={(e) => setItemForm({ ...itemForm, badge: e.target.value })}
                        className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2 text-xs font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {['Quente', 'Fresco', 'Gelada', 'Sagrado', 'Caseiro', 'Cosme', 'Puro', 'Erveiro'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setItemForm({ ...itemForm, badge: itemForm.badge === b ? '' : b })}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-md font-bold transition-all border cursor-pointer",
                              itemForm.badge === b
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                            )}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#F0EAE0]">
                      {editingItem ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteMenuItem(editingItem.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Excluir</span>
                        </button>
                      ) : <div />}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsItemModalOpen(false)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B6355] hover:bg-[#FAF8F5] cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] text-[#0A160F] text-xs font-black hover:brightness-105 shadow-sm cursor-pointer active:scale-95"
                        >
                          {editingItem ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
            </div>
          )}
        </AnimatePresence>
      </BodyPortal>

      {/* Modal Ajuste de Limite */}
      <BodyPortal>
        <AnimatePresence>
          {editingFilho && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
              <motion.div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingFilho(null)}
              />
              <motion.div
                className="relative z-10 w-full max-w-md bg-white border border-[#E5DECF] p-6 rounded-lg shadow-2xl"
                initial={MODAL_PANEL_IN}
                animate={MODAL_PANEL_DONE}
                exit={MODAL_PANEL_OUT}
                transition={MODAL_TW}
              >
                  <div className="flex items-center justify-between border-b border-[#F0EAE0] pb-3 mb-4">
                    <h3 className="text-base font-black text-[#171A16]">Ajustar Limite da Caderneta</h3>
                    <button onClick={() => setEditingFilho(null)} className="text-[#9B9184] hover:text-[#171A16]">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSalvarLimite} className="space-y-4">
                    <p className="text-xs text-[#6B6355]">
                      Defina o limite máximo de fiado permitido para <strong>{editingFilho.nome}</strong>.
                    </p>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#4A4235] mb-1">
                        Limite de Crédito (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={novoLimite}
                        onChange={(e) => setNovoLimite(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#D8D2C4] bg-[#FAF8F5] px-3.5 py-2.5 text-sm font-bold text-[#171A16] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-[#4A4235] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bloquearFiado}
                        onChange={(e) => setBloquearFiado(e.target.checked)}
                        className="rounded border-[#D8D2C4] text-amber-600 focus:ring-amber-500"
                      />
                      <span>Bloquear novas compras na caderneta para este médium</span>
                    </label>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F0EAE0]">
                      <button
                        type="button"
                        onClick={() => setEditingFilho(null)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B6355] hover:bg-[#FAF8F5]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingLimite}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5BE42] text-[#0A160F] text-xs font-black hover:brightness-105"
                      >
                        {isSavingLimite ? 'Salvando…' : 'Salvar Limite'}
                      </button>
                    </div>
                  </form>
                </motion.div>
            </div>
          )}
        </AnimatePresence>
      </BodyPortal>
    </div>
  );
}
