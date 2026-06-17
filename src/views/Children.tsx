import React, { useState, useEffect, useMemo } from 'react';
import { Info, Plus, Search, Trash2, Phone, Loader2, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { authFetch } from '../lib/authenticatedFetch';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoCard,
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

export default function Children({ setActiveTab, user, tenantData, setSelectedChildId }: ChildrenProps) {
  const tenantId = tenantData?.tenant_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" aria-hidden />
      <input
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Buscar por nome..."
        className={cn(appInputClass, 'pl-9')}
      />
    </div>
  );

  return (
    <AppPageShell>
      <AppDemoPanelHeader
        title="Filhos de Santo"
        description="Cadastro litúrgico com cargo, orixá de frente e status — ambiente real do seu terreiro."
        action={searchBar}
      />

      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AppDemoCard>
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-[#F1F5F9]">
            <Plus className="h-4 w-4 text-primary" aria-hidden />
            Adicionar filho de santo
            {isLimitReached ? <Lock className="ml-1 h-3.5 w-3.5 text-primary" title="Limite do plano" /> : null}
          </h4>
          {isLimitReached ? (
            <p className="text-xs text-[#94A3B8]">
              Limite de {childLimit} filhos no plano {PLAN_NAMES[currentPlan] || currentPlan}. Atualize em Configurações.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {submitError ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                  {submitError}
                </p>
              ) : null}
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
              <div className="grid grid-cols-2 gap-2">
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
              <AppPrimaryButton
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full"
              >
                {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Salvar filho'}
              </AppPrimaryButton>
            </form>
          )}
        </AppDemoCard>

        <div className="space-y-3 lg:col-span-2">
          <AppDemoTableShell>
            <table className="min-w-full divide-y divide-[#1E242B] text-xs">
              <thead className="bg-[#12161A]">
                <tr>
                  {['Filho', 'Cargo', 'Orixá', 'Guia', 'Status', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E242B]">
                {filteredChildren.map((child) => (
                  <tr
                    key={child.id}
                    className="cursor-pointer transition-colors hover:bg-[#1E242B]/40"
                    onClick={() => {
                      setSelectedChildId(child.id);
                      setActiveTab('profile');
                    }}
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[#F1F5F9]">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={child.foto_url}
                          name={child.nome}
                          shape="circle"
                          textSize="text-[10px]"
                          className="h-7 w-7"
                        />
                        {child.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#94A3B8]">{child.cargo || '—'}</td>
                    <td className="px-4 py-3.5 font-semibold text-primary">{child.orixa_frente || '—'}</td>
                    <td className="px-4 py-3.5 italic text-[#94A3B8]">
                      {child.quizilas?.[0] || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={childStatusClass(child.status)}>{child.status}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(child.id, child.nome);
                        }}
                        disabled={deletingId === child.id}
                        className="rounded p-1 text-rose-400 hover:bg-white/5 hover:text-rose-300 disabled:opacity-50"
                        aria-label={`Remover ${child.nome}`}
                      >
                        {deletingId === child.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
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
            </span>
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}
