import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { DollarSign, Download, Plus, Loader2, X, CheckCircle2, MessageCircle, Lock, Smartphone, Bell, Target, Save, Undo2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { whatsappApiUrl, whatsappRailwayHeaders } from '../lib/whatsappApiUrl';
import FinanceiroBasico from '../components/FinanceiroBasico';
import BodyPortal from '../components/BodyPortal';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AppDemoCard,
  AppDemoPanelHeader,
  AppDemoTableShell,
  AppPrimaryButton,
  appInputClass,
  appLabelClass,
} from '../components/ui/appDemoUi';
import { hasPlanAccess, canonicalPlanSlug } from '../constants/plans';
import type { FinancialSubview } from '../constants/appNav';
import {
  countsTowardSaldo,
  normalizeMovimentoTipo,
  parseFinanceiroDataRef,
} from '../lib/financeiroSaldo';
import { resolveTenantIdForFinance } from '../lib/tenantCache';
import { MODAL_DLG_DONE, MODAL_DLG_IN, MODAL_DLG_OUT, MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../lib/modalMotion';

type MensalidadeZeladorRow = {
  id: string;
  filho_id: string | null;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  status: string | null;
  descricao: string | null;
  categoria: string | null;
  tipo?: string | null;
  created_at?: string | null;
  filhos_de_santo?: { nome: string } | null;
};

const FINANCE_UPDATED_EVENT = 'axecloud:finance-updated';

/**
 * Feature flag: a aba "Caixinha do Axé" esta temporariamente desativada
 * a pedido do produto - sera revisitada futuramente. Para reabilitar
 * basta trocar este valor para true (toda a logica de plano e dados
 * permanece no codigo). Esconde aba, bloqueia fetch e impede o
 * setActiveView de cair na tela de caixinha.
 */
const CAIXINHA_ENABLED = false;

/** Alinha status do financeiro (pt) com filtros de aba pending/paid. */
function mensalidadeStatusIsPending(status: string | null) {
  const t = String(status ?? '').toLowerCase();
  return t === 'pendente' || t === 'pending';
}
function mensalidadeStatusIsPaid(status: string | null) {
  const t = String(status ?? '').toLowerCase();
  return t === 'pago' || t === 'paid' || t === 'confirmado';
}

/** Legado sem coluna `status`: vínculo do filho em `... (ID:uuid)` na descrição (igual ao servidor). */
function extractFilhoIdFromMensalidadeDescricao(descricao: string | null | undefined): string | null {
  const m = String(descricao || '').match(/\(ID:([0-9a-fA-F-]{36})\)/);
  return m ? m[1].toLowerCase() : null;
}

function deriveMensalidadeFilhoIdUi(row: MensalidadeZeladorRow): string | null {
  const direct = row?.filho_id;
  if (direct != null && String(direct).trim() !== '') return String(direct).trim().toLowerCase();
  return extractFilhoIdFromMensalidadeDescricao(row?.descricao);
}

function financeiroRawParaYmdIso(raw: string | null | undefined): string | null {
  const s = raw != null ? String(raw).trim() : '';
  if (!s) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return null;
}

function mensalidadeYmdPreferVenc(row: MensalidadeZeladorRow): string | null {
  return financeiroRawParaYmdIso(row.data_vencimento) ?? financeiroRawParaYmdIso(row.data);
}

/** Uma linha por filho + mês (alinhado ao servidor; cobre respostas antigas sem dedupe). */
function dedupeMensalidadesPorFilhoMesClient(rows: MensalidadeZeladorRow[]): MensalidadeZeladorRow[] {
  const byKey = new Map<string, MensalidadeZeladorRow>();
  for (const row of rows) {
    const fid = deriveMensalidadeFilhoIdUi(row);
    if (!fid) continue;
    const ymd = mensalidadeYmdPreferVenc(row);
    const mk = ymd && ymd.length >= 7 ? ymd.slice(0, 7) : '';
    const k = `${fid}|${mk}`;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, row);
      continue;
    }
    const ta = new Date(String((prev as MensalidadeZeladorRow).created_at || '')).getTime();
    const tb = new Date(String((row as MensalidadeZeladorRow).created_at || '')).getTime();
    if (tb > ta || (tb === ta && String(row.id) > String(prev.id))) byKey.set(k, row);
  }
  return Array.from(byKey.values());
}

function rowIsMensalidadePendenteLegacy(row: MensalidadeZeladorRow): boolean {
  if (String(row.categoria || '') !== 'Mensalidade' || !deriveMensalidadeFilhoIdUi(row)) return false;
  return String(row.descricao || '').toLowerCase().includes('(vencimento');
}

function rowIsMensalidadePagaLegacy(row: MensalidadeZeladorRow): boolean {
  if (String(row.categoria || '') !== 'Mensalidade' || !deriveMensalidadeFilhoIdUi(row)) return false;
  if (rowIsMensalidadePendenteLegacy(row)) return false;
  const d = String(row.descricao || '').toLowerCase();
  const tipo = String(row.tipo || '').toLowerCase();
  return (
    d.includes('(competência') ||
    d.includes('(competencia') ||
    tipo === 'entrada' ||
    tipo === 'receita' ||
    tipo === ''
  );
}

/** Aba Pendentes: coluna status OU legado por texto na descrição (API já filtra mês; UI não pode descartar status null). */
function mensalidadeRowIsPendenteForTabs(row: MensalidadeZeladorRow): boolean {
  if (mensalidadeStatusIsPaid(row.status)) return false;
  if (mensalidadeStatusIsPending(row.status)) return true;
  const st = String(row.status ?? '').trim().toLowerCase();
  if (st !== '') return false;
  // status vazio: descrição "(vencimento" manda — não tratar `tipo entrada` como pago (igual ao servidor).
  return rowIsMensalidadePendenteLegacy(row);
}

/** Aba Pagas: coluna status OU legado (competência / entrada). */
function mensalidadeRowIsPagaForTabs(row: MensalidadeZeladorRow): boolean {
  if (mensalidadeStatusIsPending(row.status)) return false;
  if (mensalidadeStatusIsPaid(row.status)) return true;
  const st = String(row.status ?? '').trim().toLowerCase();
  if (st !== '') return false;
  return rowIsMensalidadePagaLegacy(row);
}

interface Transaction {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  categoria: string;
  data: string;
  descricao: string;
  filho_id?: string;
  status?: string | null;
  created_at?: string | null;
}

interface FinancialProps {
  userRole?: string;
  userId?: string;
  tenantData?: any;
  isAdminGlobal?: boolean;
  setActiveTab: (tab: string) => void;
  isSessionReady?: boolean;
  initialView?: FinancialSubview;
}

export default function Financial({
  userRole,
  userId,
  tenantData,
  isAdminGlobal,
  setActiveTab,
  isSessionReady = false,
  initialView = 'overview',
}: FinancialProps) {
  // Não-filhos são sempre gestores do terreiro (admin, vita, cortesia, premium, oro, axe).
  // O plano controla QUAIS funções de gestão estão disponíveis (via hasPlanAccess), não SE o usuário é gestor.
  const isAdmin = userRole !== 'filho';
  const tenantId = useMemo(
    () => resolveTenantIdForFinance(tenantData?.tenant_id, userId),
    [tenantData?.tenant_id, userId]
  );
  const plan = canonicalPlanSlug(tenantData?.plan);
  const isBasicFinancePlan = plan === 'free';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'overview' | 'mensalidades' | 'caixinha' | 'configs'>(initialView);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);
  const [mensalidadesTab, setMensalidadesTab] = useState<'pendentes' | 'pagas'>('pendentes');
  const [mensalidades, setMensalidades] = useState<MensalidadeZeladorRow[]>([]);
  const [mensalidadesValorEdits, setMensalidadesValorEdits] = useState<Record<string, string>>({});
  const [mensalidadesLoading, setMensalidadesLoading] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Pix Config State
  const [pixConfig, setPixConfig] = useState({
    chave_pix: '',
    tipo_chave: 'cpf',
    nome_beneficiario: '',
    valor_mensalidade: '89.90',
    dia_vencimento: '10',
    mensalidade_ativa: true,
  });
  const [isSavingPix, setIsSavingPix] = useState(false);
  const [isTogglingMensalidade, setIsTogglingMensalidade] = useState(false);

  const mensalidadeAtiva = pixConfig.mensalidade_ativa !== false;

  // Caixinha state
  const [metas, setMetas] = useState<any[]>([]);
  const [pendingDonations, setPendingDonations] = useState<any[]>([]);
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [metaFormData, setMetaFormData] = useState({ titulo: '', valor_alvo: '' });
  const [qrCodeFile, setQrCodeFile] = useState<string | null>(null);

  const hasMensalidadesAccess = hasPlanAccess(tenantData?.plan, 'financial_whatsapp', isAdminGlobal);
  const hasReportsAccess = hasPlanAccess(tenantData?.plan, 'financial_reports', isAdminGlobal);
  const hasCaixinhaAccess = CAIXINHA_ENABLED && hasPlanAccess(tenantData?.plan, 'caixinha', isAdminGlobal);

  // Form state
  const [formData, setFormData] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    valor: '',
    categoria: '',
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    filho_id: ''
  });

  const financialTxKey =
    userId && tenantId && isSessionReady && !(isBasicFinancePlan && userRole !== 'filho')
      ? (['financial-transactions', tenantId, userId, userRole] as const)
      : null;

  const { data: txJson, isLoading: txLoading, mutate: mutateTransactions } = useSWR(
    financialTxKey,
    async ([, tid, uid, role]) => {
      const response = await authFetch(
        `/api/transactions?tenantId=${encodeURIComponent(tid)}&userId=${encodeURIComponent(uid)}&userRole=${encodeURIComponent(String(role))}&limit=200`
      );
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json() as Promise<{ data?: any[] }>;
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      dedupingInterval: 0,
      errorRetryCount: 1,
    }
  );

  useEffect(() => {
    if (!txJson?.data) return;
    const rows = (txJson.data || []).map((t: any) => ({
      ...t,
      valor: Number(t.valor) || 0,
    }));
    setTransactions(rows);
    let entradas = 0;
    let saidas = 0;
    for (const t of rows) {
      if (!countsTowardSaldo(t)) continue;
      const v = Number(t.valor) || 0;
      const mt = normalizeMovimentoTipo(t.tipo);
      if (mt === 'entrada') entradas += v;
      else if (mt === 'saida') saidas += v;
    }
    const saldoRecuperado = entradas - saidas;
    if (import.meta.env.DEV) {
      console.log('[FinanceDebug][Financial]', {
        userId,
        tenantIdEfetivo: tenantId || '(vazio)',
        tenantIdDasProps:
          tenantData?.tenant_id != null && String(tenantData.tenant_id).trim() !== ''
            ? tenantData.tenant_id
            : '(vazio)',
        saldoRecuperado,
        txCount: rows.length,
      });
    }
  }, [txJson, userId, tenantId, tenantData?.tenant_id]);

  const loading = Boolean(financialTxKey && txLoading && !txJson);

  useEffect(() => {
    if (isBasicFinancePlan && userRole !== 'filho') return;
    if (isAdmin) {
      void fetchMensalidadesGrid();
      if (hasCaixinhaAccess) {
        fetchCaixinhaData();
      }
    }
  }, [userRole, userId, isBasicFinancePlan, hasCaixinhaAccess, tenantId]);

  /** Pix + lista de filhos (modal de lançamento / configs). Mensalidades pendentes vêm da API (status pendente ou legado com "(vencimento" na descrição). */
  async function fetchMensalidadesGrid() {
    let dia = parseInt(pixConfig.dia_vencimento, 10) || 10;
    let valorPadrao = pixConfig.valor_mensalidade || '89.90';
    try {
      const res = await authFetch(`/api/v1/financial/pix-config?tenantId=${encodeURIComponent(tenantId || '')}`);
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          dia = parseInt(String(data.dia_vencimento), 10) || 10;
          valorPadrao = data.valor_mensalidade?.toString() || '89.90';
          setPixConfig({
            chave_pix: data.chave_pix || '',
            tipo_chave: data.tipo_chave || 'cpf',
            nome_beneficiario: data.nome_beneficiario || '',
            valor_mensalidade: valorPadrao,
            dia_vencimento: String(dia),
            mensalidade_ativa: data.mensalidade_ativa !== false,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching pix config:', error);
    }

    try {
      const res = await authFetch(
        `/api/children?tenantId=${encodeURIComponent(tenantId || '')}&userRole=${encodeURIComponent(userRole || '')}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar filhos');
      const rows = (json.data || []) as Array<{ id: string; nome: string; created_at?: string; data_entrada?: string }>;
      setChildren(rows.map((c) => ({
        id: c.id,
        nome: c.nome,
        created_at: c.created_at,
        data_entrada: c.data_entrada,
      })));
    } catch (error) {
      console.error('Error fetching children for mensalidades:', error);
      setChildren([]);
    }
  }

  const refreshMensalidades = useCallback(async (opts?: { skipSync?: boolean }) => {
    if (!tenantId) return;
    setMensalidadesLoading(true);
    try {
      const skipSync = opts?.skipSync === true || !mensalidadeAtiva;
      if (!skipSync) {
        await authFetch('/api/v1/financial/mensalidades/sync-pendentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenantId }),
        });
      }
      const base = `/api/v1/financial/mensalidades?tenantId=${encodeURIComponent(tenantId)}`;
      const [rPen, rPag] = await Promise.all([
        authFetch(`${base}&view=pendentes`),
        authFetch(`${base}&view=pagas`),
      ]);
      const jPen = await rPen.json().catch(() => ({}));
      const jPag = await rPag.json().catch(() => ({}));
      if (!rPen.ok) throw new Error(String(jPen.error || 'Falha ao carregar pendentes'));
      if (!rPag.ok) throw new Error(String(jPag.error || 'Falha ao carregar pagas'));
      const pen = dedupeMensalidadesPorFilhoMesClient((jPen.data || []) as MensalidadeZeladorRow[]);
      const pag = (jPag.data || []) as MensalidadeZeladorRow[];
      const byId = new Map<string, MensalidadeZeladorRow>();
      for (const r of pen) byId.set(r.id, r);
      for (const r of pag) byId.set(r.id, r);
      setMensalidades([...byId.values()]);
    } catch (e) {
      console.error('refreshMensalidades:', e);
      setMensalidades([]);
    } finally {
      setMensalidadesLoading(false);
    }
  }, [tenantId, mensalidadeAtiva]);

  const mensalidadesPendentes = useMemo(
    () => mensalidades.filter((r) => mensalidadeRowIsPendenteForTabs(r)),
    [mensalidades]
  );
  const mensalidadesPagas = useMemo(
    () => mensalidades.filter((r) => mensalidadeRowIsPagaForTabs(r)),
    [mensalidades]
  );

  useEffect(() => {
    if (!isAdmin || isBasicFinancePlan || !tenantId) return;
    if (activeView !== 'mensalidades') return;
    void refreshMensalidades();
  }, [activeView, tenantId, isAdmin, isBasicFinancePlan, refreshMensalidades]);

  useEffect(() => {
    if (!isAdmin || isBasicFinancePlan || !tenantId) return;
    if (activeView !== 'mensalidades') return;
    let debounce: number | undefined;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void refreshMensalidades({ skipSync: true });
      }, 400);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (debounce) window.clearTimeout(debounce);
    };
  }, [activeView, tenantId, isAdmin, isBasicFinancePlan, refreshMensalidades]);

  useEffect(() => {
    if (!isAdmin || isBasicFinancePlan || !tenantId) return;
    if (activeView !== 'mensalidades') return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subscribeTimer = window.setTimeout(() => {
      channel = supabase
        .channel(`mensalidades_financeiro_${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'financeiro',
            filter: `tenant_id=eq.${tenantId}`,
          },
          () => {
            void refreshMensalidades({ skipSync: true });
            void mutateTransactions();
            window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
          }
        )
        .subscribe();
    }, 0);

    return () => {
      window.clearTimeout(subscribeTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [activeView, tenantId, isAdmin, isBasicFinancePlan, refreshMensalidades, mutateTransactions]);

  async function handleSavePixConfig(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingPix(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await authFetch('/api/v1/financial/pix-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          terreiro_id: tenantId,
          chave_pix: pixConfig.chave_pix,
          tipo_chave: pixConfig.tipo_chave,
          nome_beneficiario: pixConfig.nome_beneficiario,
          valor_mensalidade: parseFloat(pixConfig.valor_mensalidade) || 0,
          dia_vencimento: parseInt(pixConfig.dia_vencimento) || 10,
          mensalidade_ativa: pixConfig.mensalidade_ativa !== false,
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar');
      alert('✅ Configurações financeiras salvas com sucesso!');
      if (activeView === 'mensalidades') {
        void refreshMensalidades();
      }
    } catch (error: any) {
      console.error('Error saving pix config:', error);
      alert('Erro ao salvar configurações Pix: ' + (error.message || ''));
    } finally {
      setIsSavingPix(false);
    }
  }

  async function fetchCaixinhaData() {
    try {
      const res = await authFetch(
        `/api/v1/financial/caixinha?tenantId=${encodeURIComponent(tenantId || '')}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar caixinha');
      setMetas(json.metas || []);
      setPendingDonations(json.pendingDonations || []);
    } catch (error) {
      console.error('Error fetching caixinha data:', error);
    }
  }

  async function handleCreateMeta(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/v1/financial/caixinha/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          titulo: metaFormData.titulo,
          valor_alvo: parseFloat(metaFormData.valor_alvo),
          qr_code_url: qrCodeFile,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao criar meta');

      setIsMetaModalOpen(false);
      setMetaFormData({ titulo: '', valor_alvo: '' });
      fetchCaixinhaData();
    } catch (error) {
      console.error('Error creating meta:', error);
      alert('Erro ao criar meta.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleValidateDonation(donationId: string, status: 'confirmado' | 'rejeitado', valor: number, metaId: string) {
    try {
      const meta = metas.find((m) => m.id === metaId);
      const res = await authFetch('/api/v1/financial/caixinha/validate-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          donationId,
          status,
          valor,
          metaId,
          metaTitulo: meta?.titulo || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao processar doação');

      fetchCaixinhaData();
      fetchTransactions();
    } catch (error) {
      console.error('Error validating donation:', error);
      alert('Erro ao processar doação.');
    }
  }

  // Mantido para eventual plano básico legado; hoje a régua oficial é Premium/Vita.
  if (isBasicFinancePlan && userRole !== 'filho') {
    return (
      <AppPageShell>
        <AppDemoPanelHeader
          title="Financeiro do terreiro"
          description="Controle simplificado de fluxo de caixa."
        />
        <FinanceiroBasico tenantId={tenantId} userId={userId} />
      </AppPageShell>
    );
  }

  async function handleDownloadReport() {
    if (!hasReportsAccess) {
      setIsUpgradeModalOpen(true);
      return;
    }

    try {
      // Basic CSV Export
      const headers = ['Data', 'Tipo', 'Categoria', 'Valor', 'Descrição'];
      const csvContent = [
        headers.join(','),
        ...transactions.map(t => [
          new Date(t.data).toLocaleDateString('pt-BR'),
          t.tipo.toUpperCase(),
          t.categoria,
          t.valor.toFixed(2),
          `"${t.descricao.replace(/"/g, '""')}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Libera o blob da memória após o clique
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Erro ao gerar relatório.');
    }
  }

  async function handleMensalidadeLiquidar(row: MensalidadeZeladorRow) {
    if (!tenantId || !row.filho_id) return;
    const valorStr = mensalidadesValorEdits[row.id] ?? String(row.valor ?? '');
    const valor = parseFloat(valorStr);
    if (!Number.isFinite(valor) || valor <= 0) {
      alert('Informe um valor válido para a mensalidade.');
      return;
    }

    const backup = mensalidades;
    const paymentDate = new Date().toISOString().split('T')[0];
    setMensalidades((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, status: 'pago', valor, data: paymentDate } : r
      )
    );
    window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão inválida');
      const res = await authFetch('/api/v1/financial/mensalidades/liquidar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: row.id,
          tenant_id: tenantId,
          valor,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(body.error || 'Falha ao marcar como pago'));
      await fetchTransactions({ silent: true });
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
    } catch (error: any) {
      console.error('Error liquidar mensalidade:', error);
      setMensalidades(backup);
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
      alert(error?.message || 'Erro ao registrar pagamento.');
    }
  }

  async function handleMensalidadeEstornar(row: MensalidadeZeladorRow) {
    if (!tenantId) return;
    if (!confirm('Estornar este pagamento? A mensalidade voltará para pendentes.')) return;
    const backup = mensalidades;
    const due = String(row.data_vencimento || row.data || '').slice(0, 10);
    setMensalidades((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, status: 'pendente', data: due || r.data } : r
      )
    );
    window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão inválida');
      const res = await authFetch('/api/v1/financial/mensalidades/estornar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: row.id, tenant_id: tenantId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(body.error || 'Falha ao estornar'));
      await fetchTransactions({ silent: true });
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
    } catch (error: any) {
      console.error('Error estornar mensalidade:', error);
      setMensalidades(backup);
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
      alert(error?.message || 'Erro ao estornar.');
    }
  }

  async function handleToggleMensalidadeAtiva(enabled: boolean) {
    if (!tenantId || isTogglingMensalidade) return;
    setIsTogglingMensalidade(true);
    const previous = pixConfig.mensalidade_ativa !== false;
    setPixConfig((prev) => ({ ...prev, mensalidade_ativa: enabled }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await authFetch('/api/v1/financial/pix-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          terreiro_id: tenantId,
          chave_pix: pixConfig.chave_pix,
          tipo_chave: pixConfig.tipo_chave,
          nome_beneficiario: pixConfig.nome_beneficiario,
          valor_mensalidade: parseFloat(pixConfig.valor_mensalidade) || 0,
          dia_vencimento: parseInt(pixConfig.dia_vencimento) || 10,
          mensalidade_ativa: enabled,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar');
      if (!enabled) {
        setMensalidades((prev) => prev.filter((r) => !mensalidadeRowIsPendenteForTabs(r)));
      } else if (activeView === 'mensalidades') {
        void refreshMensalidades();
      }
    } catch (error: any) {
      setPixConfig((prev) => ({ ...prev, mensalidade_ativa: previous }));
      alert(error?.message || 'Erro ao atualizar cobrança de mensalidade.');
    } finally {
      setIsTogglingMensalidade(false);
    }
  }

  async function handleGerarCobranca(childId: string, nome: string, competenciaIso: string, valorExibicao: string) {
    if (!mensalidadeAtiva) {
      alert('A cobrança de mensalidade está desativada neste terreiro.');
      return;
    }
    if (!hasMensalidadesAccess) {
      setIsUpgradeModalOpen(true);
      return;
    }

    try {
      const [year, month] = competenciaIso.split('-');
      const mesAno = `${month}/${year}`;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const uid = session?.user?.id;
      if (!token || !uid) throw new Error('Sessão expirada');
      const response = await fetch(whatsappApiUrl('/whatsapp/send'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, uid),
        body: JSON.stringify({
          tipo: 'cobranca_mensalidade',
          filhoId: childId,
          variables: {
            nome_filho: nome,
            mes_ano: mesAno,
            valor: valorExibicao,
            nome_terreiro: tenantData?.nome || 'Nosso Terreiro',
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      alert('✅ Cobrança Enviada com Sucesso para o WhatsApp!');
    } catch (error) {
      console.error('Error sending cobranca:', error);
      alert('Erro ao enviar cobrança.');
    }
  }

  async function fetchTransactions(_opts?: { silent?: boolean }) {
    if (!financialTxKey) return;
    try {
      await mutateTransactions();
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { filho_id, ...otherFormData } = formData;
      const insertData: Record<string, unknown> = {
        ...otherFormData,
        valor: parseFloat(formData.valor) || 0,
      };

      if (filho_id) {
        const filhoNome = children.find(c => c.id === filho_id)?.nome || 'Filho';
        insertData.descricao = `${formData.descricao || 'Lançamento'} - ${filhoNome} (ID:${filho_id})`;
      }

      const res = await authFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...insertData, tenantId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao registrar lançamento');
      
      setFormData({
        tipo: 'entrada',
        valor: '',
        categoria: '',
        data: new Date().toISOString().split('T')[0],
        descricao: '',
        filho_id: ''
      });
      fetchTransactions();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Erro ao realizar lançamento financeiro.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir este lançamento? Esta ação não pode ser desfeita.')) return;

    const backup = transactions;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      const res = await authFetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        /* resposta vazia */
      }
      if (!res.ok) {
        console.error('[Financial] Exclusão do lançamento falhou (resposta do servidor):', {
          id,
          httpStatus: res.status,
          payload: body,
          mensagem: body?.error || body?.message,
        });
        throw new Error(String(body?.error || body?.message || `Erro HTTP ${res.status}`));
      }
      await fetchTransactions({ silent: true });
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
    } catch (error: unknown) {
      const err = error as { message?: string; name?: string; stack?: string };
      console.error('[Financial] Erro ao excluir lançamento:', {
        id,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        error,
      });
      setTransactions(backup);
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
      alert(err?.message || 'Erro ao excluir lançamento.');
    }
  }

  const stats = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      if (!countsTowardSaldo(curr)) return acc;
      const valor = Number(curr.valor) || 0;
      const mt = normalizeMovimentoTipo(curr.tipo);
      if (mt === 'entrada') acc.entradas += valor;
      else if (mt === 'saida') acc.saidas += valor;
      return acc;
    }, { entradas: 0, saidas: 0 });
  }, [transactions]);

  const saldo = useMemo(() => stats.entradas - stats.saidas, [stats]);

  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (loading && transactions.length === 0) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  const pageHeader = isAdmin
    ? activeView === 'mensalidades'
      ? {
          title: 'Controle de Mensalidades',
          description: mensalidadeAtiva
            ? 'Use Pendentes e Pagas. Ao marcar como pago, o item sai de pendentes e aparece em pagas na hora.'
            : 'Cobrança desativada — os filhos de santo não veem mensalidade no portal. Ative quando quiser voltar a cobrar.',
        }
      : activeView === 'configs'
        ? {
            title: 'Configurações Pix',
            description: 'Defina chave Pix, valor padrão da mensalidade e dia de vencimento do terreiro.',
          }
        : {
            title: 'Financeiro do terreiro',
            description: 'Entradas, saídas e saldo em tempo real — com Pix e mensalidades integrados.',
          }
    : {
        title: 'Meu financeiro',
        description: 'Acompanhe suas contribuições e mensalidades.',
      };

  return (
    <AppPageShell>
      <AppDemoPanelHeader
        title={pageHeader.title}
        description={pageHeader.description}
        action={
          isAdmin && activeView === 'overview' ? (
            <button
              type="button"
              onClick={handleDownloadReport}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2 text-xs font-bold text-[#F1F5F9] transition hover:border-[#2F3643]',
                !hasReportsAccess && 'opacity-60',
              )}
            >
              <Download className="h-4 w-4" />
              Relatório PDF
            </button>
          ) : null
        }
      />

      <div className="space-y-6">
        {activeView === 'overview' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AppDemoCard className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Entradas</span>
                <p className="mt-1 text-xl font-bold text-emerald-400">{formatBRL(stats.entradas)}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-2.5 text-emerald-400">
                <Plus className="h-5 w-5" />
              </div>
            </AppDemoCard>
            <AppDemoCard className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Saídas</span>
                <p className="mt-1 text-xl font-bold text-rose-400">{formatBRL(stats.saidas)}</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-2.5 text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
            </AppDemoCard>
            <AppDemoCard className="flex items-center justify-between border-primary/25">
              <div>
                <span className="text-[10px] font-bold uppercase text-primary">Saldo</span>
                <p className={cn('mt-1 text-xl font-bold', saldo >= 0 ? 'text-[#F1F5F9]' : 'text-rose-400')}>
                  {formatBRL(saldo)}
                </p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-[#1E252E] p-2.5 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
            </AppDemoCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {isAdmin ? (
              <AppDemoCard>
                <h4 className="mb-4 text-sm font-bold text-[#F1F5F9]">Novo lançamento</h4>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className={appLabelClass}>Descrição</label>
                    <input
                      required
                      className={appInputClass}
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Ex: Mensalidade — filho João"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={appLabelClass}>Fluxo</label>
                      <select
                        className={appInputClass}
                        value={formData.tipo}
                        onChange={(e) =>
                          setFormData({ ...formData, tipo: e.target.value as 'entrada' | 'saida' })
                        }
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                    </div>
                    <div>
                      <label className={appLabelClass}>Categoria</label>
                      <select
                        required
                        className={appInputClass}
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      >
                        <option value="">Selecione…</option>
                        <option value="Mensalidade">Mensalidade</option>
                        <option value="Doação">Doação</option>
                        <option value="Evento">Evento</option>
                        <option value="Insumos">Insumos</option>
                        <option value="Contas">Contas</option>
                        <option value="Manutenção">Manutenção</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={appLabelClass}>Valor (R$)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        className={appInputClass}
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        placeholder="150.00"
                      />
                    </div>
                    <div>
                      <label className={appLabelClass}>Data</label>
                      <input
                        required
                        type="date"
                        className={appInputClass}
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={appLabelClass}>Vincular a filho (opcional)</label>
                    <select
                      className={appInputClass}
                      value={formData.filho_id}
                      onChange={(e) => setFormData({ ...formData, filho_id: e.target.value })}
                    >
                      <option value="">Nenhum</option>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <AppPrimaryButton type="submit" disabled={isSubmitting} className="mt-2 w-full">
                    {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Registrar lançamento'}
                  </AppPrimaryButton>
                </form>
              </AppDemoCard>
            ) : null}

            <div className={cn(isAdmin ? 'lg:col-span-2' : 'lg:col-span-3')}>
            <AppDemoTableShell>
              <table className="min-w-full divide-y divide-[#1E242B] text-xs">
                <thead className="bg-[#12161A]">
                  <tr>
                    {['Descrição', 'Categoria', 'Data', 'Fluxo', 'Valor', ''].map((h) => (
                      <th
                        key={h || 'act'}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E242B]">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-[#1E242B]/40">
                      <td className="px-4 py-3.5 font-medium text-[#F1F5F9]">{t.descricao}</td>
                      <td className="px-4 py-3.5 text-[#94A3B8]">{t.categoria}</td>
                      <td className="px-4 py-3.5 text-[#94A3B8]">
                        {new Date(t.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={
                            t.tipo === 'entrada'
                              ? 'rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[9px] font-bold text-emerald-300'
                              : 'rounded-full border border-rose-500/30 bg-rose-950/50 px-2 py-0.5 text-[9px] font-bold text-rose-300'
                          }
                        >
                          {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3.5 text-right font-bold',
                          t.tipo === 'entrada' ? 'text-emerald-400' : 'text-rose-400',
                        )}
                      >
                        {t.tipo === 'entrada' ? '+' : '−'} {formatBRL(t.valor)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {t.categoria === 'Mensalidade' && (t as Transaction & { filho_id?: string }).filho_id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const {
                                    data: { session },
                                  } = await supabase.auth.getSession();
                                  const token = session?.access_token;
                                  const uid = session?.user?.id;
                                  if (!token || !uid) throw new Error('Sessão expirada');
                                  await fetch(whatsappApiUrl('/whatsapp/send'), {
                                    method: 'POST',
                                    headers: whatsappRailwayHeaders(token, uid),
                                    body: JSON.stringify({
                                      tipo: 'financeiro',
                                      filhoId: (t as Transaction & { filho_id?: string }).filho_id,
                                      variables: {
                                        nome_filho: t.descricao.split(' ').slice(1).join(' ') || 'Filho',
                                        valor_mensalidade: t.valor.toString(),
                                        data_vencimento: new Date(t.data).toLocaleDateString('pt-BR'),
                                        nome_terreiro: tenantData?.nome || 'Nosso Terreiro',
                                      },
                                    }),
                                  });
                                  alert('Lembrete enviado com sucesso!');
                                } catch (e) {
                                  console.error('Error sending financial reminder:', e);
                                  alert('Erro ao enviar lembrete.');
                                }
                              }}
                              className="rounded p-1 text-primary hover:bg-white/5"
                              title="Enviar lembrete WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(t.id)}
                              className="rounded p-1 text-rose-400 hover:bg-white/5"
                              aria-label="Remover lançamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#94A3B8]">
                        Nenhum lançamento registrado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </AppDemoTableShell>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {activeView === 'mensalidades' ? (
            <AppDemoCard>
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3 rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mensalidadeAtiva}
                    aria-busy={isTogglingMensalidade}
                    aria-label="Ativar ou desativar cobrança de mensalidade"
                    disabled={isTogglingMensalidade}
                    onClick={() => void handleToggleMensalidadeAtiva(!mensalidadeAtiva)}
                    className={cn(
                      'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70',
                      mensalidadeAtiva ? 'bg-primary' : 'bg-[#2F3643]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none block h-5 w-5 rounded-full bg-[#F1F5F9] shadow-sm transition-transform duration-200 ease-out',
                        mensalidadeAtiva ? 'translate-x-5' : 'translate-x-0',
                        isTogglingMensalidade && 'opacity-0',
                      )}
                    />
                    {isTogglingMensalidade ? (
                      <Loader2
                        className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-[#080A0D]"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#F1F5F9]">
                      Cobrança de mensalidade {mensalidadeAtiva ? 'ativa' : 'desativada'}
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      {mensalidadeAtiva
                        ? 'O sistema gera pendentes mensais e os filhos veem a cobrança no portal.'
                        : 'Nenhuma mensalidade nova será gerada. Ideal para terreiros que não cobram contribuição fixa.'}
                    </p>
                  </div>
                </div>

                {mensalidadeAtiva ? (
                <div
                  role="tablist"
                  aria-label="Mensalidades por status"
                  className="flex shrink-0 rounded-xl border border-[#1E242B] bg-[#12161A] p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mensalidadesTab === 'pendentes'}
                    id="tab-mensalidades-pendentes"
                    onClick={() => setMensalidadesTab('pendentes')}
                    className={cn(
                      'rounded-lg px-4 py-2 text-xs font-bold transition-all sm:px-5',
                      mensalidadesTab === 'pendentes'
                        ? 'bg-primary text-[#080A0D] shadow-sm'
                        : 'text-[#94A3B8] hover:text-[#F1F5F9]',
                    )}
                  >
                    Pendentes
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mensalidadesTab === 'pagas'}
                    id="tab-mensalidades-pagas"
                    onClick={() => setMensalidadesTab('pagas')}
                    className={cn(
                      'rounded-lg px-4 py-2 text-xs font-bold transition-all sm:px-5',
                      mensalidadesTab === 'pagas'
                        ? 'bg-primary text-[#080A0D] shadow-sm'
                        : 'text-[#94A3B8] hover:text-[#F1F5F9]',
                    )}
                  >
                    Pagas
                  </button>
                </div>
                ) : null}
              </div>

              {!mensalidadeAtiva ? (
                <div className="rounded-xl border border-[#1E242B] bg-[#12161A] px-6 py-12 text-center">
                  <p className="text-sm font-bold text-[#F1F5F9]">Mensalidade desativada</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#94A3B8]">
                    Ative o interruptor acima quando quiser voltar a gerar cobranças e exibir o módulo aos filhos de santo.
                    Pagamentos antigos continuam no financeiro em Visão geral.
                  </p>
                </div>
              ) : null}

              {mensalidadeAtiva && mensalidadesLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#94A3B8]">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Atualizando lista…
                </div>
              )}

              {mensalidadeAtiva && mensalidadesTab === 'pendentes' ? (
                <div role="tabpanel" aria-labelledby="tab-mensalidades-pendentes">
                  {mensalidadesPendentes.length === 0 && !mensalidadesLoading ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-950/30 px-6 py-14 text-center">
                      <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-400" aria-hidden />
                      <p className="text-lg font-bold text-[#F1F5F9]">Tudo em dia!</p>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#94A3B8]">
                        Nenhuma mensalidade pendente para este período.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 sm:hidden">
                        {mensalidadesPendentes.map((row) => {
                          const nome = row.filhos_de_santo?.nome || 'Filho de santo';
                          const fid = row.filho_id || '';
                          const venc = String(row.data_vencimento || row.data || '').slice(0, 10);
                          const valorCampo = mensalidadesValorEdits[row.id] ?? String(row.valor ?? '');
                          return (
                            <div key={row.id} className="rounded-xl border border-[#1E242B] bg-[#12161A] p-4">
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <h4 className="min-w-0 flex-1 text-base font-bold leading-snug text-[#F1F5F9]">{nome}</h4>
                                <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-950/50 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                                  Pendente
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1.5">
                                  <span className={appLabelClass}>Valor (R$)</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={valorCampo}
                                    onChange={(e) =>
                                      setMensalidadesValorEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
                                    }
                                    className={appInputClass}
                                  />
                                </label>
                                <div className="space-y-1.5">
                                  <span className={appLabelClass}>Vencimento</span>
                                  <p className="flex h-10 items-center rounded-xl border border-[#1E242B] bg-[#13171D] px-3 text-xs font-bold text-[#94A3B8]">
                                    {venc ? new Date(`${venc}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleMensalidadeLiquidar(row)}
                                  className="h-10 rounded-xl border border-[#1E242B] bg-[#13171D] text-xs font-bold text-[#F1F5F9] transition hover:border-[#2F3643]"
                                >
                                  Pago
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    fid
                                      ? void handleGerarCobranca(fid, nome, venc, valorCampo)
                                      : undefined
                                  }
                                  disabled={!fid}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#25D366]/10 text-xs font-black text-[#25D366] transition-all hover:bg-[#25D366]/20 disabled:opacity-40"
                                  title="Gerar Cobrança WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                  Cobrar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="hidden sm:block">
                        <AppDemoTableShell>
                        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-[#1E242B] bg-[#12161A]">
                              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Filho</th>
                              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Valor (R$)</th>
                              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Vencimento</th>
                              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Status</th>
                              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E242B]">
                            {mensalidadesPendentes.map((row) => {
                              const nome = row.filhos_de_santo?.nome || 'Filho de santo';
                              const fid = row.filho_id || '';
                              const venc = String(row.data_vencimento || row.data || '').slice(0, 10);
                              const valorCampo = mensalidadesValorEdits[row.id] ?? String(row.valor ?? '');
                              return (
                                <tr key={row.id} className="transition-colors hover:bg-[#12161A]/60">
                                  <td className="px-4 py-3 font-bold text-[#F1F5F9]">{nome}</td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={valorCampo}
                                      onChange={(e) =>
                                        setMensalidadesValorEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
                                      }
                                      className={cn(appInputClass, 'w-28')}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-[#94A3B8]">
                                    {venc ? new Date(`${venc}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="rounded-full border border-amber-500/30 bg-amber-950/50 px-3 py-1 text-[10px] font-bold text-amber-300">
                                      Pendente
                                    </span>
                                  </td>
                                  <td className="space-x-2 px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => void handleMensalidadeLiquidar(row)}
                                      className="rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-2 text-xs font-bold text-[#F1F5F9] transition hover:border-[#2F3643]"
                                    >
                                      Pago
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        fid ? void handleGerarCobranca(fid, nome, venc, valorCampo) : undefined
                                      }
                                      disabled={!fid}
                                      className="inline-flex items-center gap-2 rounded-lg bg-[#25D366]/10 px-4 py-2 text-xs font-bold text-[#25D366] transition-all hover:bg-[#25D366]/20 disabled:opacity-40"
                                      title="Gerar Cobrança WhatsApp"
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                      Cobrar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </AppDemoTableShell>
                      </div>
                    </>
                  )}
                </div>
              ) : mensalidadeAtiva && mensalidadesTab === 'pagas' ? (
                <div role="tabpanel" aria-labelledby="tab-mensalidades-pagas" className="space-y-4">
                  {mensalidadesPagas.length === 0 && !mensalidadesLoading ? (
                    <p className="rounded-xl border border-[#1E242B] bg-[#12161A] py-10 text-center text-sm text-[#94A3B8]">
                      Nenhuma mensalidade paga registrada no mês atual.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3 sm:hidden">
                        {mensalidadesPagas.map((row) => {
                          const nome = row.filhos_de_santo?.nome || 'Filho de santo';
                          const pay = String(row.data || '').slice(0, 10);
                          return (
                            <div key={row.id} className="rounded-xl border border-[#1E242B] bg-[#12161A] p-4">
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <h4 className="min-w-0 flex-1 text-base font-bold leading-snug text-[#F1F5F9]">{nome}</h4>
                                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                                  Pago
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className={appLabelClass}>Valor</span>
                                  <p className="mt-1 font-bold text-emerald-400">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                      Number(row.valor) || 0
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <span className={appLabelClass}>Pagamento</span>
                                  <p className="mt-1 font-bold text-[#94A3B8]">
                                    {pay ? new Date(`${pay}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleMensalidadeEstornar(row)}
                                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-950/60"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                                Estornar pagamento
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="hidden sm:block">
                        <AppDemoTableShell>
                          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-[#1E242B] bg-[#12161A]">
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Filho</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Valor</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Data do pagamento</th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1E242B]">
                              {mensalidadesPagas.map((row) => {
                                const nome = row.filhos_de_santo?.nome || 'Filho de santo';
                                const pay = String(row.data || '').slice(0, 10);
                                return (
                                  <tr key={row.id} className="transition-colors hover:bg-[#12161A]/60">
                                    <td className="px-4 py-3 font-bold text-[#F1F5F9]">{nome}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-emerald-400">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                        Number(row.valor) || 0
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#94A3B8]">
                                      {pay ? new Date(`${pay}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => void handleMensalidadeEstornar(row)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-950/60"
                                      >
                                        <Undo2 className="h-3.5 w-3.5" />
                                        Estornar
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </AppDemoTableShell>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </AppDemoCard>
          ) : activeView === 'caixinha' ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white px-0">Caixinha do Axé</h3>
                  <p className="text-gray-400 font-medium px-0">Gerencie as metas e arrecadações coletivas.</p>
                </div>
                <button 
                  onClick={() => setIsMetaModalOpen(true)}
                  className="bg-primary text-background px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Nova Meta
                </button>
              </div>

              {pendingDonations.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-red-500">
                    <Bell className="w-5 h-5 animate-bounce" />
                    <h4 className="font-black uppercase tracking-widest text-sm">Doações Pendentes de Validação</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingDonations.map(donation => (
                      <AppDemoCard key={donation.id} className="flex flex-col gap-4 border-l-4 border-l-red-500">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Doador</p>
                            <p className="font-bold text-white">{donation.filhos_de_santo?.nome || 'Anônimo'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Valor</p>
                            <p className="font-black text-primary text-lg">R$ {Number(donation.valor).toFixed(2)}</p>
                          </div>
                        </div>
                        {donation.comprovante_url && (
                          <div className="relative group aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/5">
                            <img src={donation.comprovante_url} alt="Comprovante" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <a href={donation.comprovante_url} target="_blank" rel="noopener noreferrer" className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-xs font-bold text-white border border-white/10 transition-all hover:bg-white/20">
                                Ver em Tela Cheia
                              </a>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => handleValidateDonation(donation.id, 'confirmado', Number(donation.valor), donation.meta_id)} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-xs hover:bg-emerald-600 transition-colors">
                            Confirmar Recebimento
                          </button>
                          <button onClick={() => handleValidateDonation(donation.id, 'rejeitado', Number(donation.valor), donation.meta_id)} className="px-4 bg-white/5 text-gray-500 py-3 rounded-xl font-black text-xs hover:bg-red-500/10 hover:text-red-500 transition-all">
                            Rejeitar
                          </button>
                        </div>
                      </AppDemoCard>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
                {metas.map(meta => {
                  const progress = Math.min((Number(meta.valor_atual) / Number(meta.valor_alvo)) * 100, 100);
                  return (
                    <AppDemoCard key={meta.id} className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <Target className="w-6 h-6 text-primary" />
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          meta.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                        )}>
                          {meta.status === 'active' ? 'Em Andamento' : 'Concluída'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white mb-1">{meta.titulo}</h4>
                        <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Meta do Terreiro</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <p className="text-xs font-black text-gray-500 uppercase tracking-widest px-0">Progresso</p>
                          <p className="text-sm font-black text-white px-0">
                            R$ {Number(meta.valor_atual).toFixed(2)} <span className="text-gray-500">/ R$ {Number(meta.valor_alvo).toFixed(2)}</span>
                          </p>
                        </div>
                        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.3)]" />
                        </div>
                      </div>
                      {meta.qr_code_url && (
                        <div className="pt-4 border-t border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">QR Code Pix Configurado</p>
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white p-1">
                            <img src={meta.qr_code_url} alt="QR Code" className="w-full h-full object-contain" />
                          </div>
                        </div>
                      )}
                    </AppDemoCard>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              <AppDemoCard className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#F1F5F9]">Recebimento via Pix</h4>
                    <p className="text-xs text-[#94A3B8]">Chave Pix, valor padrão da mensalidade e vencimento mensal.</p>
                  </div>
                </div>
                <form onSubmit={handleSavePixConfig} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={appLabelClass}>Mensalidade padrão</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A3B8]">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={pixConfig.valor_mensalidade}
                          onChange={(e) => setPixConfig({ ...pixConfig, valor_mensalidade: e.target.value })}
                          className={cn(appInputClass, 'pl-9')}
                          placeholder="89,90"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={appLabelClass}>Tipo de chave</label>
                      <select
                        value={pixConfig.tipo_chave}
                        onChange={(e) => setPixConfig({ ...pixConfig, tipo_chave: e.target.value })}
                        className={cn(appInputClass, '[&>option]:bg-[#13171D]')}
                      >
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="celular">Celular</option>
                        <option value="aleatoria">Aleatória</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={appLabelClass}>Chave Pix</label>
                    <input
                      type="text"
                      value={pixConfig.chave_pix}
                      onChange={(e) => setPixConfig({ ...pixConfig, chave_pix: e.target.value })}
                      className={appInputClass}
                      placeholder="Sua chave Pix"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={appLabelClass}>Nome do beneficiário</label>
                      <input
                        type="text"
                        value={pixConfig.nome_beneficiario}
                        onChange={(e) => setPixConfig({ ...pixConfig, nome_beneficiario: e.target.value })}
                        className={appInputClass}
                        placeholder="Nome completo ou razão social"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={appLabelClass}>Dia de vencimento</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={pixConfig.dia_vencimento}
                          onChange={(e) => setPixConfig({ ...pixConfig, dia_vencimento: e.target.value })}
                          className={appInputClass}
                          placeholder="10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#64748B]">/ mês</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <AppPrimaryButton type="submit" disabled={isSavingPix} className="inline-flex items-center gap-2">
                      {isSavingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isSavingPix ? 'Salvando…' : 'Salvar configurações'}
                    </AppPrimaryButton>
                  </div>
                </form>
              </AppDemoCard>
            </div>
          )}
        </div>
      )}

      {/* Modal de Upgrade */}
      <AnimatePresence>
        {isUpgradeModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute inset-0 bg-black/[0.92] backdrop-blur-none"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 w-full space-y-5 rounded-3xl border border-primary/20 bg-[#1B1C1C] px-6 py-8 text-center sm:max-w-md sm:px-10"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">Recurso Exclusivo</h3>
                <p className="text-gray-400 font-medium">
                  A automação de mensagens e relatórios avançados são exclusivos para assinantes do <span className="text-primary font-bold">Plano Premium</span> ou <span className="text-primary font-bold">Plano Vita</span>.
                </p>
              </div>
              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => {
                    setIsUpgradeModalOpen(false);
                    window.dispatchEvent(new CustomEvent('navigate-to-subscription'));
                  }}
                  className="w-full bg-primary text-background font-black py-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                >
                  Fazer Upgrade Agora
                </button>
                <button 
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="w-full text-gray-500 font-bold py-2 hover:text-white transition-colors"
                >
                  Talvez mais tarde
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Nova Meta */}
      <AnimatePresence>
        {isMetaModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-y-contain p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMetaModalOpen(false)}
              className="absolute inset-0 bg-background/[0.94] backdrop-blur-none"
            />
            <motion.div
              initial={MODAL_DLG_IN}
              animate={MODAL_DLG_DONE}
              exit={MODAL_DLG_OUT}
              transition={MODAL_TW}
              className="bg-card border border-white/10 w-full max-w-sm rounded-[2rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">Nova Meta</h3>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium uppercase tracking-widest">Caixinha do Axé</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMetaModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-gray-500 transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateMeta} className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto no-scrollbar">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Título da Meta</label>
                    <input
                      required
                      type="text"
                      value={metaFormData.titulo}
                      onChange={(e) => setMetaFormData({ ...metaFormData, titulo: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm sm:text-base text-white focus:border-primary outline-none transition-all"
                      placeholder="Ex: Reforma do Telhado"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Valor Alvo (R$)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={metaFormData.valor_alvo}
                      onChange={(e) => setMetaFormData({ ...metaFormData, valor_alvo: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm sm:text-base text-white focus:border-primary outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest ml-1">QR Code Pix (URL da Imagem)</label>
                    <input
                      type="url"
                      value={qrCodeFile || ''}
                      onChange={(e) => setQrCodeFile(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm sm:text-base text-white focus:border-primary outline-none transition-all"
                      placeholder="https://..."
                    />
                    <p className="text-[10px] text-gray-500 italic ml-1">Insira o link da imagem do seu QR Code Pix pessoal.</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-background py-3 sm:py-4 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 text-sm sm:text-base cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto" />
                    ) : (
                      'Criar Meta Coletiva'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </AppPageShell>
  );
}
