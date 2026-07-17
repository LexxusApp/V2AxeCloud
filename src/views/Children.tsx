import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Info, Plus, Search, Trash2, Phone, Loader2, Lock, X, MessageCircle, MoreVertical, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { authFetch } from '../lib/authenticatedFetch';
import { whatsappApiUrl, whatsappRailwayHeaders } from '../lib/whatsappApiUrl';
import { supabase } from '../lib/supabase';
import { MODAL_TW } from '../lib/modalMotion';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoPanelHeader,
  AppDemoTableShell,
  AppPrimaryButton,
  appInputClass,
  appLabelClass,
  childStatusClass,
} from '../components/ui/appDemoUi';
import Avatar from '../components/Avatar';
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

type ChildForm = {
  nome: string;
  orixa_frente: string;
  cargo: string;
  cpf: string;
  data_nascimento: string;
  data_entrada: string;
  status: Child['status'];
  foto_url: string;
  whatsapp_phone: string;
};

const EMPTY_CHILD_FORM: ChildForm = {
  nome: '',
  orixa_frente: '',
  cargo: '',
  cpf: '',
  data_nascimento: '',
  data_entrada: new Date().toISOString().split('T')[0],
  status: 'Ativo',
  foto_url: '',
  whatsapp_phone: '',
};

export default function Children({ setActiveTab, user, tenantData, setSelectedChildId }: ChildrenProps) {
  const tenantId = tenantData?.tenant_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [resendingWelcome, setResendingWelcome] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [sendingCredentialsId, setSendingCredentialsId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({ ...EMPTY_CHILD_FORM, data_entrada: new Date().toISOString().split('T')[0] });

  const closeAddModal = useCallback(() => {
    setAddModalOpen(false);
    setSubmitError(null);
  }, []);

  const openAddModal = useCallback(() => {
    setSubmitError(null);
    setAddModalOpen(true);
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [tenantId]);

  useEffect(() => {
    if (!openActionsId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-child-actions-root]')) return;
      setOpenActionsId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenActionsId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openActionsId]);

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
      
      const response = await authFetch(
        `/api/children?userId=${user.id}&tenantId=${tenantId || ''}`,
        { cache: 'no-store' },
      );
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

      setFormData({
        ...EMPTY_CHILD_FORM,
        data_entrada: new Date().toISOString().split('T')[0],
      });
      setAddModalOpen(false);
      fetchChildren();
    } catch (error: any) {
      console.error('[Children] Error adding child:', error);
      setSubmitError(error.message || 'Erro ao cadastrar filho de santo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendDadosAcessoWhatsApp() {
    if (!user?.id) return;
    const ok = confirm(
      'Enviar dados de acesso (registro, senha e link de login) para todos os filhos com WhatsApp e CPF cadastrados?\n\nOs envios entram na fila anti-spam e podem levar alguns minutos.',
    );
    if (!ok) return;

    setResendingWelcome(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch(whatsappApiUrl('/whatsapp/resend-dados-acesso'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, user.id),
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível enfileirar o envio.');
      }

      const parts = [
        `${result.sent ?? 0} enviada(s)`,
        result.failed ? `${result.failed} falha(s)` : null,
        result.skippedNoPhone ? `${result.skippedNoPhone} sem WhatsApp` : null,
        result.skippedNoCpf ? `${result.skippedNoCpf} sem CPF` : null,
      ].filter(Boolean);

      alert(`Dados de acesso enfileirados.\n\n${parts.join(' · ')}`);
    } catch (error) {
      console.error('[Children] resend dados acesso WA:', error);
      alert(error instanceof Error ? error.message : 'Erro ao enviar dados de acesso via WhatsApp.');
    } finally {
      setResendingWelcome(false);
    }
  }

  async function handleSendCredentials(childId: string, childName: string) {
    if (!user?.id) return;
    const ok = confirm(
      `Enviar dados de acesso (login, senha e link) via WhatsApp para ${childName}?\n\nA senha enviada são os 6 primeiros dígitos do CPF cadastrado.`,
    );
    if (!ok) return;

    setOpenActionsId(null);
    setSendingCredentialsId(childId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch(whatsappApiUrl('/whatsapp/send'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, user.id),
        body: JSON.stringify({
          tipo: 'dados_acesso',
          filhoId: childId,
          variables: {
            nome_filho: childName,
            nome_terreiro: tenantData?.nome || 'AxéCloud',
            nome_sistema: 'AxéCloud',
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível enviar os dados de acesso.');
      }
      alert('Dados de acesso enviados via WhatsApp.');
    } catch (error) {
      console.error('[Children] send credentials WA:', error);
      alert(error instanceof Error ? error.message : 'Erro ao enviar dados via WhatsApp.');
    } finally {
      setSendingCredentialsId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    setOpenActionsId(null);
    if (!confirm(`Deseja realmente excluir o perfil de ${name}? Esta ação é irreversível.`)) return;

    const snapshot = children;
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(id);

    try {
      const qs = new URLSearchParams({
        userId: user.id,
        ...(tenantId ? { tenantId } : {}),
      });
      const response = await authFetch(`/api/children/${encodeURIComponent(id)}?${qs}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir filho de santo');
      }
    } catch (error) {
      console.error('Error deleting child:', error);
      setChildren(snapshot);
      alert(error instanceof Error ? error.message : 'Erro ao excluir filho de santo.');
    } finally {
      setDeletingId(null);
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
    return <AppPanelLoading />;
  }

  const searchBar = (
    <div className="flex w-full flex-col gap-2 sm:w-64">
      <div className="relative w-full">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" aria-hidden />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome..."
          className={cn(appInputClass, 'pl-9')}
        />
      </div>
      <button
        type="button"
        onClick={openAddModal}
        disabled={isLimitReached}
        className={cn(
          'inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all',
          isLimitReached
            ? 'cursor-not-allowed border-[#1E242B] bg-[#12161A] text-zinc-600'
            : 'border-primary/35 bg-[#12161A] text-primary hover:border-primary/50 hover:bg-primary/10',
        )}
      >
        {isLimitReached ? (
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        Adicionar
      </button>
      {isLimitReached ? (
        <p className="text-[10px] leading-snug text-[#94A3B8]">
          Limite de {childLimit} filhos no plano {PLAN_NAMES[currentPlan] || currentPlan}.
        </p>
      ) : null}
    </div>
  );

  return (
    <AppPageShell>
      <AppDemoPanelHeader
        title="Filhos de Santo"
        description="Cadastro litúrgico com cargo, orixá de frente e status — ambiente real do seu terreiro."
        action={searchBar}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['Todos', 'Ativo', 'Pendente', 'Inativo'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(status)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
              filterStatus === status
                ? 'border-primary/35 bg-primary/10 text-primary'
                : 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:text-[#F1F5F9]',
            )}
          >
            {status}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void handleResendDadosAcessoWhatsApp()}
          disabled={resendingWelcome || children.length === 0}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
            resendingWelcome || children.length === 0
              ? 'cursor-not-allowed border-[#1E242B] bg-[#12161A] text-zinc-600'
              : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/15',
          )}
        >
          {resendingWelcome ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          )}
          Enviar acesso via WhatsApp
        </button>
      </div>

      <div className="space-y-3">
        <AppDemoTableShell>
            <table className="min-w-full divide-y divide-[#1E242B] text-xs">
              <thead className="bg-[#12161A]">
                <tr>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] md:px-4">
                    Filho
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] md:px-4">
                    Cargo
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] md:table-cell">
                    Orixá
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] md:table-cell">
                    Guia
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] md:px-4">
                    Status
                  </th>
                  <th className="w-10 px-2 py-3 md:px-4" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E242B]">
                {filteredChildren.map((child) => {
                  const isMenuOpen = openActionsId === child.id;
                  const isRowBusy = deletingId === child.id || sendingCredentialsId === child.id;

                  return (
                  <tr
                    key={child.id}
                    className="cursor-pointer transition-colors hover:bg-[#1E242B]/40"
                    onClick={() => {
                      setOpenActionsId(null);
                      setSelectedChildId(child.id);
                      setActiveTab('profile');
                    }}
                  >
                    <td className="whitespace-nowrap px-3 py-3.5 font-medium text-[#F1F5F9] md:px-4">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={child.foto_url}
                          name={child.nome}
                          shape="circle"
                          textSize="text-[10px]"
                          className="h-7 w-7 shrink-0"
                        />
                        <span className="max-w-[9.5rem] truncate sm:max-w-none">{child.nome}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-[#94A3B8] md:px-4">{child.cargo || '—'}</td>
                    <td className="hidden px-4 py-3.5 font-semibold text-primary md:table-cell">
                      {child.orixa_frente || '—'}
                    </td>
                    <td className="hidden px-4 py-3.5 italic text-[#94A3B8] md:table-cell">
                      {child.quizilas?.[0] || '—'}
                    </td>
                    <td className="px-3 py-3.5 md:px-4">
                      <span className={childStatusClass(child.status)}>{child.status}</span>
                    </td>
                    <td className="relative px-2 py-3.5 text-right md:px-4">
                      <div className="relative inline-block text-left" data-child-actions-root>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionsId((prev) => (prev === child.id ? null : child.id));
                          }}
                          disabled={isRowBusy}
                          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#F1F5F9] disabled:opacity-50"
                          aria-label={`Ações para ${child.nome}`}
                          aria-expanded={isMenuOpen}
                          aria-haspopup="menu"
                        >
                          {isRowBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <MoreVertical className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                        {isMenuOpen ? (
                          <div
                            role="menu"
                            className="absolute right-0 z-20 mt-1 min-w-[11.5rem] overflow-hidden rounded-xl border border-[#1E242B] bg-[#13171D] py-1 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleSendCredentials(child.id, child.nome);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-emerald-400 transition-colors hover:bg-white/5"
                            >
                              <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Enviar dados
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(child.id, child.nome);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-rose-400 transition-colors hover:bg-white/5"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Excluir
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filteredChildren.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[#94A3B8]">
                      Nenhum filho encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AppDemoTableShell>
          <div className="flex items-start gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-3.5 text-[11px] text-[#94A3B8]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              Cada terreiro tem ambiente isolado (RLS). Clique na linha para abrir o perfil completo do filho.
              No celular, use os três pontos para enviar dados de acesso ou excluir. O botão verde reenvia acesso
              em massa para quem tem WhatsApp e CPF cadastrados.
            </span>
          </div>
        </div>

      <AnimatePresence>
        {addModalOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4 pt-20 sm:p-8 sm:pt-24">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={MODAL_TW}
              onClick={closeAddModal}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={MODAL_TW}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-child-title"
              onClick={(e) => e.stopPropagation()}
              className="relative z-[101] my-auto flex w-full max-h-[min(80dvh,calc(100dvh-7rem))] max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 id="add-child-title" className="text-base font-black text-white sm:text-lg">
                      Adicionar filho de santo
                    </h3>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
                      Cadastro litúrgico
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="shrink-0 rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="overflow-y-auto overscroll-y-contain p-5 sm:p-6"
              >
                {submitError ? (
                  <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                    {submitError}
                  </p>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
                  <div>
                    <label className={appLabelClass}>CPF</label>
                    <input
                      required
                      className={appInputClass}
                      inputMode="numeric"
                      maxLength={11}
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '') })}
                      placeholder="Somente números"
                    />
                  </div>
                  <div>
                    <label className={appLabelClass}>Nome</label>
                    <input
                      required
                      className={appInputClass}
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Mariana de Iansã"
                    />
                  </div>
                  <div>
                    <label className={appLabelClass}>Cargo</label>
                    <select
                      required
                      className={appInputClass}
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      <option value="Abiã">Abiã</option>
                      <option value="Iyawó">Iyawó</option>
                      <option value="Ekeji">Ekeji</option>
                      <option value="Ogã">Ogã</option>
                      <option value="Babalaô">Babalaô</option>
                      <option value="Médium de Desenvolvimento">Médium de Desenvolvimento</option>
                      <option value="Filho de Santo">Filho de Santo</option>
                    </select>
                  </div>
                  <div>
                    <label className={appLabelClass}>Orixá de frente</label>
                    <input
                      required
                      className={appInputClass}
                      value={formData.orixa_frente}
                      onChange={(e) => setFormData({ ...formData, orixa_frente: e.target.value })}
                      placeholder="Ex: Oxum"
                    />
                  </div>
                  <div>
                    <label className={appLabelClass}>Status</label>
                    <select
                      className={appInputClass}
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Child['status'] })}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className={appLabelClass}>WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
                      <input
                        type="tel"
                        className={cn(appInputClass, 'pl-9')}
                        value={formData.whatsapp_phone}
                        onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value })}
                        placeholder="11999999999"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={appLabelClass}>Nascimento</label>
                    <input
                      required
                      type="date"
                      className={appInputClass}
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={appLabelClass}>Entrada</label>
                    <input
                      required
                      type="date"
                      className={appInputClass}
                      value={formData.data_entrada}
                      onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                    />
                  </div>
                </div>

                <AppPrimaryButton
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-5 inline-flex w-full items-center justify-center sm:mt-6"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar filho'}
                </AppPrimaryButton>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </AppPageShell>
  );
}
