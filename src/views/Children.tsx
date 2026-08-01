import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Info, Plus, Search, Trash2, Phone, Loader2, Lock, X, MessageCircle, MoreVertical, Send, UserCheck, Clock3, Users, Cake, AlertCircle, CalendarDays, ArrowUpRight } from 'lucide-react';
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
  childStatusClass,
} from '../components/ui/appDemoUi';
import Avatar from '../components/Avatar';
import { PLAN_LIMITS, PLAN_NAMES, canonicalPlanSlug } from '../constants/plans';
import ChildrenCurrentExperience from '../components/children/ChildrenCurrentExperience';
import BodyPortal from '../components/BodyPortal';

const paperLabelClass =
  'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6F675C]';
const paperInputClass =
  'min-h-11 w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm text-[#171A16] placeholder:text-[#9B9184] transition-colors focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15';

export interface Child {
  id: string;
  nome: string;
  foto_url: string;
  orixa_frente: string;
  cargo: string;
  data_nascimento: string;
  data_entrada: string;
  status: 'Ativo' | 'Pendente' | 'Inativo';
  quizilas: string[];
  whatsapp_phone?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  created_at?: string | null;
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
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'nome' | 'entrada' | 'aniversario'>('nome');
  const [previewChildId, setPreviewChildId] = useState<string | null>(null);

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
      
      const [response, paymentsResponse] = await Promise.all([
        authFetch(
          `/api/children?userId=${user.id}&tenantId=${tenantId || ''}`,
          { cache: 'no-store' },
        ),
        authFetch(
          `/api/transactions?tenantId=${encodeURIComponent(tenantId || '')}&userId=${encodeURIComponent(user.id)}&userRole=admin&limit=400`,
          { cache: 'no-store' },
        ),
      ]);
      const [result, paymentsResult] = await Promise.all([
        response.json(),
        paymentsResponse.json().catch(() => ({ data: [] })),
      ]);

      if (!response.ok) {
        throw new Error(result.error || "Erro ao buscar filhos");
      }

      setChildren(result.data || []);
      setPendingPayments(
        (paymentsResult.data || []).filter((transaction: any) => {
          const category = String(transaction?.categoria || '').toLowerCase();
          const status = String(transaction?.status || '').toLowerCase();
          return category === 'mensalidade' && (status === 'pendente' || status === 'atrasado');
        }),
      );
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
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return children.filter(child => {
      const matchesSearch = [child.nome, child.cargo, child.whatsapp_phone, child.telefone]
        .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      const matchesStatus = filterStatus === 'Todos' || child.status === filterStatus;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'entrada') {
        return String(b.data_entrada || '').localeCompare(String(a.data_entrada || ''));
      }
      if (sortBy === 'aniversario') {
        return String(a.data_nascimento || '').slice(5).localeCompare(String(b.data_nascimento || '').slice(5));
      }
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [children, searchTerm, filterStatus, sortBy]);

  const incompleteChildren = useMemo(
    () => children.filter((child) => !String(child.whatsapp_phone || child.telefone || '').trim() || !String(child.data_nascimento || '').trim()).length,
    [children],
  );
  const birthdaysThisMonth = useMemo(() => {
    const month = new Date().getMonth() + 1;
    return children.filter((child) => Number(String(child.data_nascimento || '').slice(5, 7)) === month).length;
  }, [children]);
  const pendingChildIds = useMemo(
    () => new Set(pendingPayments.map((payment) => String(payment?.filho_id || payment?.child_id || '')).filter(Boolean)),
    [pendingPayments],
  );
  const previewChild = children.find((child) => child.id === previewChildId) || null;
  
  const currentPlan = canonicalPlanSlug(tenantData?.plan);
  const childLimit = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.premium;
  const isLimitReached = children.length >= childLimit;

  if (loading && children.length === 0) {
    return <AppPanelLoading />;
  }

  const searchBar = (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={openAddModal}
        disabled={isLimitReached}
        className={cn(
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition-all',
          isLimitReached
            ? 'cursor-not-allowed border-[#1E242B] bg-[#12161A] text-zinc-600'
            : 'border-primary bg-primary text-[#17130D] shadow-sm hover:bg-[#FFD34E]',
        )}
      >
        {isLimitReached ? (
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        Cadastrar filho
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
      <div className="children-v5-page">
      <ChildrenCurrentExperience
        childrenData={children}
        filteredChildren={filteredChildren}
        pendingChildIds={pendingChildIds}
        incompleteChildren={incompleteChildren}
        birthdaysThisMonth={birthdaysThisMonth}
        searchTerm={searchTerm}
        filterStatus={filterStatus}
        sortBy={sortBy}
        isLimitReached={isLimitReached}
        childLimit={childLimit}
        planName={PLAN_NAMES[currentPlan] || currentPlan}
        resendingWelcome={resendingWelcome}
        openActionsId={openActionsId}
        deletingId={deletingId}
        sendingCredentialsId={sendingCredentialsId}
        onSearchChange={setSearchTerm}
        onStatusChange={setFilterStatus}
        onSortChange={setSortBy}
        onAdd={openAddModal}
        onResendAll={() => void handleResendDadosAcessoWhatsApp()}
        onPreview={setPreviewChildId}
        onActionsChange={setOpenActionsId}
        onSendCredentials={(id, name) => void handleSendCredentials(id, name)}
        onDelete={(id, name) => void handleDelete(id, name)}
      />

      <div className="hidden" aria-hidden="true">
      <AppDemoPanelHeader
        title="Filhos de Santo"
        description={`${children.length} ${children.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'} na corrente da casa.`}
        action={searchBar}
      />

      <div className="app-metric-rail mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: 'Filhos ativos',
            value: children.filter((child) => child.status === 'Ativo').length,
            icon: UserCheck,
            color: 'text-emerald-300',
            bg: 'border-emerald-400/20 bg-emerald-400/10',
          },
          {
            label: 'Cadastros incompletos',
            value: incompleteChildren,
            icon: AlertCircle,
            color: 'text-amber-300',
            bg: 'border-amber-400/20 bg-amber-400/10',
          },
          {
            label: 'Mensalidades pendentes',
            value: pendingPayments.length,
            icon: Clock3,
            color: 'text-rose-300',
            bg: 'border-rose-400/20 bg-rose-400/10',
          },
          {
            label: 'Aniversários no mês',
            value: birthdaysThisMonth,
            icon: Cake,
            color: 'text-violet-300',
            bg: 'border-violet-400/20 bg-violet-400/10',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#252C35] bg-[#151A21] p-4 shadow-[0_18px_44px_-34px_rgba(0,0,0,0.9)]"
            >
              <span className={cn('hidden h-10 w-10 shrink-0 place-items-center rounded-xl border sm:grid', item.bg)}>
                <Icon className={cn('h-5 w-5', item.color)} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.1em] text-[#8E9AAA]">
                  {item.label}
                </p>
                <p className="font-display text-xl font-black text-[#F8FAFC] sm:text-2xl">{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <section className="app-command-strip mb-4 rounded-2xl border border-[#252C35] bg-[#11151A] p-3 sm:p-4" aria-label="Busca e filtros">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#7F8B9C]" aria-hidden />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, telefone ou cargo"
              className={cn(appInputClass, 'min-h-11 pl-10 text-sm')}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-[#8E9AAA]">
            Ordenar por
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className={cn(appInputClass, 'min-h-11 w-auto py-2 text-sm')}
            >
              <option value="nome">Nome</option>
              <option value="entrada">Entrada na casa</option>
              <option value="aniversario">Aniversário</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
        {['Todos', 'Ativo', 'Pendente', 'Inativo'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(status)}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-bold transition-all',
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
      </section>

      <div className="space-y-3">
        <div className="grid gap-3 md:hidden">
          {filteredChildren.map((child) => {
            const phone = child.whatsapp_phone || child.telefone;
            const hasPendingPayment = pendingChildIds.has(child.id);
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => setPreviewChildId(child.id)}
                className="rounded-2xl border border-[#252C35] bg-[#151A21] p-4 text-left text-[#F8FAFC] transition hover:border-primary/30"
              >
                <div className="flex items-start gap-3">
                  <Avatar src={child.foto_url} name={child.nome} shape="circle" textSize="text-sm" className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{child.nome}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-[#8E9AAA]">{child.cargo || 'Função não informada'} · {child.orixa_frente || 'Orixá não informado'}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[#64748B]" aria-hidden />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={childStatusClass(child.status)}>{child.status}</span>
                  {hasPendingPayment ? <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-xs font-bold text-rose-300">Mensalidade pendente</span> : null}
                  {phone ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8E9AAA]"><Phone className="h-3 w-3" />{phone}</span> : null}
                </div>
              </button>
            );
          })}
          {filteredChildren.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#BFB5A6] bg-white/55 px-5 py-10 text-center text-[#17130D]">
              <Users className="mx-auto h-8 w-8 text-[#9A6A00]" />
              <p className="mt-3 text-sm font-black">{children.length === 0 ? 'Sua corrente começa aqui' : 'Nenhum resultado encontrado'}</p>
              <p className="mt-1 text-xs font-semibold text-[#665F55]">{children.length === 0 ? 'Cadastre o primeiro filho de santo.' : 'Ajuste a busca ou os filtros.'}</p>
            </div>
          ) : null}
        </div>

        <div className="hidden md:block">
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
                    Contato
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] md:table-cell">
                    Entrada na casa
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
                      setPreviewChildId(child.id);
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
                    <td className="hidden px-4 py-3.5 text-[#AAB4C2] md:table-cell">
                      {child.whatsapp_phone || child.telefone || 'Não informado'}
                    </td>
                    <td className="hidden px-4 py-3.5 text-[#94A3B8] md:table-cell">
                      {child.data_entrada ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${child.data_entrada.slice(0, 10)}T12:00:00`)) : '—'}
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
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10">
                        <Users className="h-6 w-6 text-primary" aria-hidden />
                      </div>
                      <p className="mt-3 text-sm font-extrabold text-[#E2E8F0]">
                        {children.length === 0 ? 'Sua corrente começa aqui' : 'Nenhum resultado encontrado'}
                      </p>
                      <p className="mx-auto mt-1 max-w-sm text-xs font-medium leading-relaxed text-[#64748B]">
                        {children.length === 0
                          ? 'Cadastre o primeiro filho de santo para organizar dados, acessos e mensalidades.'
                          : 'Tente outro nome ou ajuste o filtro de status.'}
                      </p>
                      {children.length === 0 && !isLimitReached ? (
                        <button
                          type="button"
                          onClick={openAddModal}
                          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-[#080A0D]"
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                          Cadastrar primeiro filho
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AppDemoTableShell>
        </div>
          <div className="flex items-start gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-3.5 text-[11px] text-[#94A3B8]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              Cada terreiro tem ambiente isolado (RLS). Clique na linha para abrir o perfil completo do filho.
              No celular, use os três pontos para enviar dados de acesso ou excluir. O botão verde reenvia acesso
              em massa para quem tem WhatsApp e CPF cadastrados.
            </span>
          </div>
        </div>
      </div>

      {/* Portal: fixed do dossiê ancora na viewport (evita drawer "gigante" no mobile). */}
      <BodyPortal>
      <AnimatePresence>
        {previewChild ? (
          <>
            <motion.button
              type="button"
              aria-label="Fechar resumo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewChildId(null)}
              className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={MODAL_TW}
              role="dialog"
              aria-modal="true"
              aria-labelledby="child-preview-title"
              className="current-person-dossier fixed inset-y-0 right-0 z-[81] flex h-[100dvh] max-h-[100dvh] w-full max-w-[27rem] flex-col overflow-hidden border-l border-[#2B333D] bg-[#0F1318] text-[#F8FAFC] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Resumo do cadastro</p>
                  <h2 id="child-preview-title" className="mt-0.5 text-base font-black">Filho de Santo</h2>
                </div>
                <button type="button" onClick={() => setPreviewChildId(null)} className="grid h-10 w-10 place-items-center rounded-xl text-[#94A3B8] hover:bg-white/5 hover:text-white" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={previewChild.foto_url} name={previewChild.nome} shape="circle" textSize="text-base" className="h-16 w-16 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black">{previewChild.nome}</h3>
                    <p className="mt-0.5 text-xs font-bold text-primary">{previewChild.cargo || 'Função não informada'}</p>
                    <div className="mt-1.5"><span className={childStatusClass(previewChild.status)}>{previewChild.status}</span></div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
                    <p className="text-[10px] font-bold text-[#7F8B9C]">Orixá de frente</p>
                    <p className="mt-0.5 text-xs font-black text-white">{previewChild.orixa_frente || 'Não informado'}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
                    <p className="text-[10px] font-bold text-[#7F8B9C]">Entrada na casa</p>
                    <p className="mt-0.5 text-xs font-black text-white">{previewChild.data_entrada ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${previewChild.data_entrada.slice(0, 10)}T12:00:00`)) : 'Não informada'}</p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
                    <p className="text-[10px] font-bold text-[#7F8B9C]">Contato</p>
                    <p className="mt-0.5 text-xs font-black text-white">{previewChild.whatsapp_phone || previewChild.telefone || 'Não informado'}</p>
                  </div>
                </div>

                <div className={cn(
                  'mt-3 flex items-center gap-3 rounded-xl border p-3',
                  pendingChildIds.has(previewChild.id)
                    ? 'border-rose-400/20 bg-rose-400/[0.07]'
                    : 'border-emerald-400/20 bg-emerald-400/[0.07]',
                )}>
                  {pendingChildIds.has(previewChild.id) ? <AlertCircle className="h-5 w-5 text-rose-300" /> : <UserCheck className="h-5 w-5 text-emerald-300" />}
                  <div>
                    <p className="text-xs font-black">{pendingChildIds.has(previewChild.id) ? 'Mensalidade pendente' : 'Sem mensalidade pendente'}</p>
                    <p className="text-[10px] font-semibold text-[#7F8B9C]">Situação financeira atual</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-sky-300" />
                    <p className="text-xs font-black">Nascimento</p>
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-[#8E9AAA]">{previewChild.data_nascimento ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${previewChild.data_nascimento.slice(0, 10)}T12:00:00`)) : 'Data não informada'}</p>
                </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-white/10 bg-[#0F1318] p-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChildId(previewChild.id);
                    setPreviewChildId(null);
                    setActiveTab('profile');
                  }}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-[#17130D] hover:bg-[#FFD34E]"
                >
                  Ver perfil completo
                  <ArrowUpRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendCredentials(previewChild.id, previewChild.nome)}
                  disabled={sendingCredentialsId === previewChild.id}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 text-sm font-bold text-emerald-300 hover:bg-emerald-400/[0.12]"
                >
                  {sendingCredentialsId === previewChild.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Enviar acesso pelo WhatsApp
                </button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
      </BodyPortal>

      <BodyPortal>
      <AnimatePresence>
        {addModalOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={MODAL_TW}
              onClick={closeAddModal}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
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
              className="relative z-[101] my-auto flex w-full max-h-[88dvh] max-w-3xl flex-col overflow-hidden rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#DED8CB] px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F1E8D2]">
                    <Plus className="h-5 w-5 text-[#8F7724]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 id="add-child-title" className="font-display text-base font-black text-[#171A16] sm:text-lg">
                      Adicionar filho de santo
                    </h3>
                    <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">
                      Cadastro litúrgico
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="shrink-0 rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition-colors hover:bg-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5 sm:p-6"
              >
                {submitError ? (
                  <p className="mb-4 rounded-lg border border-[#B04A32]/30 bg-[#B04A32]/10 px-3 py-2 text-xs text-[#B04A32]">
                    {submitError}
                  </p>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
                  <div>
                    <label className={paperLabelClass}>CPF</label>
                    <input
                      required
                      className={paperInputClass}
                      inputMode="numeric"
                      maxLength={11}
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '') })}
                      placeholder="Somente números"
                    />
                  </div>
                  <div>
                    <label className={paperLabelClass}>Nome</label>
                    <input
                      required
                      className={paperInputClass}
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Mariana de Iansã"
                    />
                  </div>
                  <div>
                    <label className={paperLabelClass}>Cargo</label>
                    <select
                      required
                      className={paperInputClass}
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
                    <label className={paperLabelClass}>Orixá de frente</label>
                    <input
                      required
                      className={paperInputClass}
                      value={formData.orixa_frente}
                      onChange={(e) => setFormData({ ...formData, orixa_frente: e.target.value })}
                      placeholder="Ex: Oxum"
                    />
                  </div>
                  <div>
                    <label className={paperLabelClass}>Status</label>
                    <select
                      className={paperInputClass}
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Child['status'] })}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className={paperLabelClass}>WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6F675C]" />
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10,13}"
                        title="Informe DDD + número, somente dígitos (ex: 11999999999)"
                        maxLength={13}
                        className={cn(paperInputClass, 'pl-9')}
                        value={formData.whatsapp_phone}
                        onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value.replace(/\D/g, '') })}
                        placeholder="11999999999"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={paperLabelClass}>Nascimento</label>
                    <input
                      required
                      type="date"
                      className={paperInputClass}
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={paperLabelClass}>Entrada</label>
                    <input
                      required
                      type="date"
                      className={paperInputClass}
                      value={formData.data_entrada}
                      onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                    />
                  </div>
                </div>

                <AppPrimaryButton
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-5 inline-flex w-full items-center justify-center bg-[#17251D] text-[#FFFAF0] hover:bg-[#20342A] sm:mt-6"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar filho'}
                </AppPrimaryButton>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      </BodyPortal>
      </div>
    </AppPageShell>
  );
}
