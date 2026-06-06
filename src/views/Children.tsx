import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Plus, User, Calendar, Phone, Loader2, X, CheckCircle2, Lock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { authFetch, getAccessToken } from '../lib/authenticatedFetch';
import { supabase } from '../lib/supabase';
import { whatsappApiUrl, whatsappRailwayHeaders } from '../lib/whatsappApiUrl';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';
import LuxuryLoading from '../components/LuxuryLoading';
import PageHeader from '../components/PageHeader';
import Avatar from '../components/Avatar';
import { ChildMemberSacredWatermark } from '../components/ChildMemberSacredWatermark';
import { PLAN_LIMITS, PLAN_NAMES, canonicalPlanSlug } from '../constants/plans';

interface Child {
  id: string;
  nome: string;
  foto_url: string;
  orixa_frente: string;
  cargo: string;
  data_nascimento: string;
  data_entrada: string;
  status: 'Ativo' | 'Pendente' | 'Inativo';
  quizilas: string[];
}

interface ChildrenProps {
  setActiveTab: (tab: string) => void;
  user: any;
  tenantData?: any;
  setSelectedChildId: (id: string | null) => void;
}

export default function Children({ setActiveTab, user, tenantData, setSelectedChildId }: ChildrenProps) {
  const tenantId = tenantData?.tenant_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    orixa_frente: '',
    cargo: '',
    cpf: '',
    data_nascimento: '',
    data_entrada: new Date().toISOString().split('T')[0],
    status: 'Ativo' as const,
    foto_url: '',
    whatsapp_phone: ''
  });

  useEffect(() => {
    fetchChildren();
  }, [tenantId]);

  async function fetchChildren() {
    setLoading(true);
    let finished = false;
    const timeoutId = setTimeout(() => {
      if (finished) return;
      console.warn(
        '[DEBUG] fetchChildren safety timeout (12s) — liberando spinner; fetch pode ainda concluir em background.'
      );
      setLoading(false);
    }, 12000);

    try {
      if (!user) throw new Error("Usuário não autenticado");
      
      const response = await authFetch(`/api/children?userId=${user.id}&tenantId=${tenantId || ''}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao buscar filhos");
      }

      setChildren(result.data || []);
    } catch (error) {
      console.error('Error fetching children:', error);
    } finally {
      finished = true;
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const response = await authFetch('/api/children', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          tenantId: tenantId,
          childData: formData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao adicionar filho");
      }
      
      // Trigger WhatsApp Welcome Message
      if (formData.whatsapp_phone) {
        try {
          const token = await getAccessToken();
          const uid = user.id;
          if (!token || !uid) return;
          await fetch(whatsappApiUrl('/whatsapp/send'), {
            method: 'POST',
            headers: whatsappRailwayHeaders(token, uid),
            body: JSON.stringify({
              tipo: 'boas_vindas',
              filhoId: result.data.id,
              variables: {
                nome_filho: formData.nome,
                nome_terreiro: tenantData?.nome || 'Nosso Terreiro'
              }
            })
          });
        } catch (waErr) {
          console.error('Error sending welcome WhatsApp:', waErr);
        }
      }

      setIsModalOpen(false);
      setFormData({
        nome: '',
        orixa_frente: '',
        cargo: '',
        cpf: '',
        data_nascimento: '',
        data_entrada: new Date().toISOString().split('T')[0],
        status: 'Ativo',
        foto_url: '',
        whatsapp_phone: ''
      });
      fetchChildren();
    } catch (error: any) {
      console.error('[Children] Error adding child:', error);
      setSubmitError(error.message || 'Erro ao cadastrar filho de santo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deseja realmente excluir o perfil de ${name}? Esta ação é irreversível.`)) return;
    
    try {
      const { error } = await supabase
        .from('filhos_de_santo')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchChildren();
    } catch (error) {
      console.error('Error deleting child:', error);
      alert('Erro ao excluir filho de santo.');
    }
  }

  const filteredChildren = useMemo(() => {
    return children.filter(child => {
      const matchesSearch = child.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'Todos' || child.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [children, searchTerm, filterStatus]);
  
  const currentPlan = canonicalPlanSlug(tenantData?.plan);
  const childLimit = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.premium;
  const isLimitReached = children.length >= childLimit;

  if (loading && children.length === 0) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <LuxuryLoading />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <PageHeader
        title={<>Gestão de <span className="text-primary">Filhos</span></>}
        subtitle="Administre a comunidade do seu terreiro."
        tenantData={tenantData}
        setActiveTab={setActiveTab}
        actions={
          <button 
            onClick={() => {
              if (isLimitReached) {
                alert(`O limite de ${childLimit} filhos foi atingido para o plano ${PLAN_NAMES[currentPlan] || currentPlan.toUpperCase()}. Faça um upgrade para adicionar mais.`);
                return;
              }
              setIsModalOpen(true);
            }}
            className={cn('app-page-action', isLimitReached && 'app-page-action--disabled')}
            title={isLimitReached ? "Limite de filhos atingido no seu plano atual" : "Adicionar novo filho de santo"}
          >
            {isLimitReached ? <Lock className="w-5 h-5 text-[#FBBC00]" /> : <Plus className="w-5 h-5" />}
            Novo Filho
          </button>
        }
      />

      <div className="app-page-gutter relative z-[1] mx-auto w-full max-w-[1440px] flex-1 space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-700">
        {/* Filters Bar */}
        <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative min-w-0 flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
          />
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-2">
          {['Todos', 'Ativo', 'Pendente'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "shrink-0 px-4 py-3 rounded-2xl font-bold transition-all border text-sm md:px-5 md:py-3.5 md:text-base",
                filterStatus === status 
                  ? "bg-primary/10 border-primary/30 text-primary" 
                  : "bg-card border-border text-gray-400 hover:border-white/20 hover:text-white"
              )}
            >
              {status}
            </button>
          ))}
          <button className="bg-card border border-border p-3 md:p-3.5 rounded-2xl text-gray-400 hover:text-white transition-all">
            <Filter className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredChildren.length > 0 ? filteredChildren.map((child, idx) => (
          <motion.div
            key={child.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="child-member-card group"
          >
            <div className="child-member-card__inner">
              <div className="child-member-card__content">
                {/* Marca d'água sagrada — centralizada atrás do avatar, como na referência */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center overflow-hidden"
                  aria-hidden
                >
                  <div className="child-member-card__watermark">
                    <ChildMemberSacredWatermark className="h-full w-full opacity-[0.13]" />
                  </div>
                </div>

            <div
              className={cn(
                'absolute right-4 top-4 h-2.5 w-2.5 rounded-full border-2 border-[#141414]',
                child.status === 'Ativo' ? 'bg-emerald-500' : 'bg-amber-500'
              )}
              title={child.status}
            />

            <button
              type="button"
              onClick={() => handleDelete(child.id, child.nome)}
              className="absolute left-3 top-3 rounded-lg p-1.5 text-gray-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
              title="Excluir Perfil"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="relative z-[1] flex flex-col items-center px-5 pb-4 pt-8 text-center">
              <div className="child-member-avatar-ring">
                <Avatar
                  src={child.foto_url}
                  name={child.nome}
                  shape="circle"
                  textSize="text-xl"
                  className="h-20 w-20 border-2 border-[#141414]/80 bg-[#141414] shadow-inner transition-all duration-300 group-hover:border-primary/30"
                />
              </div>
              <h3 className="mt-4 line-clamp-2 text-lg font-black tracking-tight text-white transition-colors group-hover:text-primary">
                {child.nome}
              </h3>
              <span className="mt-1 line-clamp-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
                {child.cargo || 'Filho de Santo'}
              </span>
            </div>

            <div className="mx-5 border-t border-white/10" />

            <div className="flex flex-1 flex-col justify-center space-y-4 px-5 py-5">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Iniciação</p>
                  <p className="truncate text-sm font-bold text-white">
                    {child.data_entrada
                      ? new Date(child.data_entrada).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Ancestral</p>
                  <p className="truncate text-sm font-bold text-white">{child.orixa_frente || '—'}</p>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  setSelectedChildId(child.id);
                  setActiveTab('profile');
                }}
                className="flex w-full items-center justify-between rounded-xl border border-primary/35 bg-transparent px-4 py-3 text-sm font-black text-primary transition-all hover:border-primary/55 hover:bg-primary/[0.04]"
              >
                Ver Perfil
                <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              </button>
            </div>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
              <User className="w-10 h-10 text-gray-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Nenhum filho encontrado</h3>
              <p className="text-gray-500 max-w-xs mx-auto">Comece cadastrando os filhos de santo do seu terreiro clicando no botão "Novo Filho".</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Child Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/[0.94] backdrop-blur-none"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[92dvh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl sm:max-h-[90dvh] sm:max-w-lg"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white sm:text-lg">Novo Filho de Santo</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cadastro</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="shrink-0 rounded-xl p-2 text-gray-500 transition-colors hover:bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {submitError && (
                    <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-500">
                      {submitError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">CPF (Apenas números)</label>
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        maxLength={11}
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '') })}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-primary"
                        placeholder="00000000000"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Nome Completo</label>
                      <input
                        required
                        type="text"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-primary"
                        placeholder="Ex: Ana Souza"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5 sm:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Orixá de Frente</label>
                      <input
                        required
                        type="text"
                        value={formData.orixa_frente}
                        onChange={(e) => setFormData({ ...formData, orixa_frente: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-primary"
                        placeholder="Ex: Oxum"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5 sm:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Cargo/Função</label>
                      <select
                        required
                        value={formData.cargo}
                        onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-primary [&>option]:bg-[#1B1C1C]"
                      >
                        <option value="">Selecione...</option>
                        <option value="Abiã">Abiã</option>
                        <option value="Iyawó">Iyawó</option>
                        <option value="Ekeji">Ekeji</option>
                        <option value="Ogã">Ogã</option>
                        <option value="Babalaô">Babalaô</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Status</label>
                      <select
                        required
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-primary [&>option]:bg-[#1B1C1C]"
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Dt. Nascimento</label>
                      <input
                        required
                        type="date"
                        value={formData.data_nascimento}
                        onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">Dt. Entrada</label>
                      <input
                        required
                        type="date"
                        value={formData.data_entrada}
                        onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-0.5">WhatsApp (DDD)</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                          type="tel"
                          inputMode="tel"
                          value={formData.whatsapp_phone}
                          onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all focus:border-primary"
                          placeholder="11999999999"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex shrink-0 gap-3 border-t border-white/5 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 rounded-2xl border border-white/5 bg-white/5 py-3 text-sm font-black text-white transition-all hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-black text-background shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Cadastrar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
