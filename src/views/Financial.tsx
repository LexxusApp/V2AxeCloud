import { ModernFinancialOverview } from '../components/financial/ModernFinancialOverview';
import { useModernInterface } from '../components/app/ModernInterfaceContext';
import { fetchAllFinancialTransactions } from '../lib/financialTransactions';
import { brazilFinancialToday } from '../lib/financialOverview';
import { consumeModuleCreation } from '../lib/moduleCreation';
import DataLoadError from '../components/DataLoadError';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useSWR from 'swr';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Coffee,
  CheckCircle2,
  Clock3,
  Copy,
  DollarSign,
  Download,
  Loader2,
  Lock,
  MessageCircle,
  MoreVertical,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Target,
  Trash2,
  Undo2,
  WalletCards,
  PieChart,
  X,
  Bell,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { confirmAction } from '../lib/confirmAction';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { whatsappApiUrl, whatsappRailwayHeaders } from '../lib/whatsappApiUrl';
import FinanceiroBasico from '../components/FinanceiroBasico';
import CantinaView from '../components/financial/CantinaView';
import { SacredOverviewView } from '../components/financial/SacredOverviewView';
import ReceiptReviewPanel from '../components/financial/ReceiptReviewPanel';
import {useReceiptReviews,RECEIPT_UPDATED} from '../lib/receiptReviewClient';
import { SacredMensalidadesView } from '../components/financial/SacredMensalidadesView';
import { SacredPixConfigView } from '../components/financial/SacredPixConfigView';
import { FinancialEntryModal } from '../components/financial/FinancialEntryModal';
import { isCantinaEnabled } from '../lib/cantinaFeature';
import BodyPortal from '../components/BodyPortal';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  AxePageHeader,
  AxeTabsBar,
  AxeMetricRail,
  AxeMetricCard,
  AxeCard,
  AxeButton,
} from '../components/shared/AxePageScaffold';
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
import { buildManualFinanceEntry } from '../../lib/manualFinance';
import { showHouseToast } from '../lib/houseToast';
import { refreshMensalidadesWithoutBlocking, synchronizeMensalidadesOnce, withMensalidadeDeadline } from '../lib/mensalidadeRefresh';
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
  return t === 'pendente' || t === 'pending' || t === 'atrasado' || t === 'overdue';
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

/** Aba Pendentes: coluna status OU legado por texto na descrição (API lista em aberto de qualquer mês). */
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
  tipo: string;
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
  const modern = useModernInterface();
  const OverviewComponent = modern ? ModernFinancialOverview : SacredOverviewView;
  // Não-filhos são sempre gestores do terreiro (admin, vita, cortesia, premium, oro, axe).
  // O plano controla QUAIS funções de gestão estão disponíveis (via hasPlanAccess), não SE o usuário é gestor.
  const isAdmin = userRole !== 'filho';
  const tenantId = useMemo(
    () => resolveTenantIdForFinance(tenantData?.tenant_id, userId, userRole === 'filho'),
    [tenantData?.tenant_id, userId, userRole]
  );
  const plan = canonicalPlanSlug(tenantData?.plan);
  const isBasicFinancePlan = plan === 'free';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  useEffect(() => { setTransactions([]); setChildren([]); }, [userId, tenantId, userRole]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const requestRef = useRef<{ key: string; id: string } | null>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'overview' | 'mensalidades' | 'cantina' | 'caixinha' | 'configs'>(initialView);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  useEffect(() => {
    if (!modern || !isAdmin || !isSessionReady || isBasicFinancePlan) return;
    if (consumeModuleCreation({ userId, tenantId }, 'financial')) { setSubmitError(null); setEntryModalOpen(true); }
  }, [modern, isAdmin, isSessionReady, isBasicFinancePlan, userId, tenantId]);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);
  const [mensalidadesTab, setMensalidadesTab] = useState<'pendentes' | 'pagas' | 'comprovantes'>('pendentes');
  const receiptFeed=useReceiptReviews(userId,tenantId,Boolean(userId&&tenantId&&isSessionReady&&userRole!=='filho'&&activeView==='mensalidades'));
  const [mensalidades, setMensalidades] = useState<MensalidadeZeladorRow[]>([]);
  const [mensalidadesValorEdits, setMensalidadesValorEdits] = useState<Record<string, string>>({});
  const [mensalidadesLoading, setMensalidadesLoading] = useState(false);
  const [mensalidadesSyncing, setMensalidadesSyncing] = useState(false);
  const [mensalidadesError, setMensalidadesError] = useState('');
  const mensalidadesScope = `${userId}:${tenantId}`;
  const mensalidadesScopeRef = useRef(mensalidadesScope);
  mensalidadesScopeRef.current = mensalidadesScope;
  const mensalidadesLoadedRef = useRef('');
  const mensalidadesSyncCounts = useRef(new Map<string, number>());
  useEffect(() => { setMensalidades([]); setMensalidadesSyncing(false); setMensalidadesLoading(false); setMensalidadesError(''); }, [mensalidadesScope]);
  const mensalidadesRefreshVersion = useRef(0);
  const [processingMensalidadeId, setProcessingMensalidadeId] = useState<string | null>(null);
  const [sendingChargeKey, setSendingChargeKey] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [openTransactionActions, setOpenTransactionActions] = useState<string | null>(null);
  const [financeSearch, setFinanceSearch] = useState('');
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [mensalidadeSearch, setMensalidadeSearch] = useState('');

  // Pix Config State
  const [pixConfig, setPixConfig] = useState({
    chave_pix: '',
    tipo_chave: 'cpf',
    nome_beneficiario: '',
    valor_mensalidade: '69.90',
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
    data: brazilFinancialToday(),
    descricao: '',
    filho_id: '',
    status: 'pendente' as 'pago' | 'pendente',
    jurosTipo: 'nenhum' as 'nenhum' | 'valor' | 'porcentagem',
    jurosValor: '',
  });

  const financialTxKey =
    userId && tenantId && isSessionReady && !(isBasicFinancePlan && userRole !== 'filho')
      ? (['financial-transactions', tenantId, userId, userRole] as const)
      : null;

  const { data: txJson, error: txError, isLoading: txLoading, mutate: mutateTransactions } = useSWR(
    financialTxKey,
    async ([, tid, uid, role]) => {
      const base = `/api/transactions?tenantId=${encodeURIComponent(tid)}&userId=${encodeURIComponent(uid)}&userRole=${encodeURIComponent(String(role))}`;
      if (role !== 'filho') return fetchAllFinancialTransactions<Transaction>(authFetch, base);
      const response = await authFetch(`${base}&limit=200`);
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
  const cashTransactions = useMemo(
    () => transactions.filter((transaction) => countsTowardSaldo(transaction)),
    [transactions]
  );

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
    let valorPadrao = pixConfig.valor_mensalidade || '69.90';
    try {
      const res = await authFetch(`/api/v1/financial/pix-config?tenantId=${encodeURIComponent(tenantId || '')}`);
      const cType = res.headers.get('content-type') || '';
      if (res.ok && cType.includes('application/json')) {
        const { data } = await res.json().catch(() => ({}));
        if (data) {
          dia = parseInt(String(data.dia_vencimento), 10) || 10;
          valorPadrao = data.valor_mensalidade?.toString() || '69.90';
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
      console.warn('Silent fallback for pix config:', error);
    }

    try {
      const res = await authFetch(
        `/api/children?tenantId=${encodeURIComponent(tenantId || '')}&userRole=${encodeURIComponent(userRole || '')}`
      );
      const cType = res.headers.get('content-type') || '';
      if (res.ok && cType.includes('application/json')) {
        const json = await res.json().catch(() => ({}));
        const rows = (json.data || []) as Array<{ id: string; nome: string; created_at?: string; data_entrada?: string }>;
        setChildren(rows.map((c) => ({
          id: c.id,
          nome: c.nome,
          created_at: c.created_at,
          data_entrada: c.data_entrada,
        })));
      }
    } catch (error) {
      console.warn('Silent fallback for children in financial:', error);
      setChildren([]);
    }
  }

  const refreshMensalidades = useCallback(async (opts?: { skipSync?: boolean }) => {
    if (!tenantId) return;
    const scope = `${userId}:${tenantId}`;
    let version = 0;
    const current = () => mensalidadesScopeRef.current === scope && mensalidadesRefreshVersion.current === version;
    const sync = opts?.skipSync !== true && mensalidadeAtiva;
    if (mensalidadesLoadedRef.current !== scope) setMensalidadesLoading(true);
    setMensalidadesError('');
    if (sync) { mensalidadesSyncCounts.current.set(scope, (mensalidadesSyncCounts.current.get(scope) || 0) + 1); setMensalidadesSyncing(true); }
    await refreshMensalidadesWithoutBlocking({
      read: async () => {
        version = ++mensalidadesRefreshVersion.current;
        const base = `/api/v1/financial/mensalidades?tenantId=${encodeURIComponent(tenantId)}`;
        const [rPen, rPag] = await withMensalidadeDeadline(signal => Promise.all([
          authFetch(`${base}&view=pendentes`, {signal}), authFetch(`${base}&view=pagas`, {signal}),
        ]));
        const [jPen, jPag] = await Promise.all([rPen.json().catch(() => ({})), rPag.json().catch(() => ({}))]);
        if (!rPen.ok) throw new Error(String(jPen.error || 'Falha ao carregar pendentes'));
        if (!rPag.ok) throw new Error(String(jPag.error || 'Falha ao carregar pagas'));
        const byId = new Map<string, MensalidadeZeladorRow>();
        for (const row of dedupeMensalidadesPorFilhoMesClient((jPen.data || []) as MensalidadeZeladorRow[])) byId.set(row.id, row);
        for (const row of (jPag.data || []) as MensalidadeZeladorRow[]) byId.set(row.id, row);
        return [...byId.values()];
      },
      sync: sync ? () => synchronizeMensalidadesOnce(scope, async () => {
        const response = await withMensalidadeDeadline(signal => authFetch('/api/v1/financial/mensalidades/sync-pendentes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId }), signal,
        }));
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(result.error || 'Não foi possível atualizar as mensalidades'));
        return result;
      }) : undefined,
      onData: data => { if (current()) { setMensalidades(data); mensalidadesLoadedRef.current = scope; } },
      onReadDone: () => { if (current()) setMensalidadesLoading(false); },
      onSyncDone: () => {
        if (!sync) return;
        const remaining = Math.max(0, (mensalidadesSyncCounts.current.get(scope) || 1) - 1);
        if (remaining) mensalidadesSyncCounts.current.set(scope, remaining); else mensalidadesSyncCounts.current.delete(scope);
        if (mensalidadesScopeRef.current === scope && remaining === 0) setMensalidadesSyncing(false);
      },
      onError: error => { if (current()) { console.error('refreshMensalidades:', error); setMensalidadesError('Não foi possível atualizar agora. Os dados já carregados foram mantidos.'); } },
    });
  }, [tenantId, userId, mensalidadeAtiva]);

  useEffect(()=>{
    if(!isAdmin||!isSessionReady||!tenantId)return;
    const refresh=()=>{void refreshMensalidades({skipSync:true});void mutateTransactions();};
    window.addEventListener(RECEIPT_UPDATED,refresh);
    return()=>window.removeEventListener(RECEIPT_UPDATED,refresh);
  },[isAdmin,isSessionReady,tenantId,refreshMensalidades,mutateTransactions]);

  const mensalidadesPendentes = useMemo(
    () => mensalidades.filter((r) => mensalidadeRowIsPendenteForTabs(r)),
    [mensalidades]
  );
  const mensalidadesPagas = useMemo(
    () => mensalidades.filter((r) => mensalidadeRowIsPagaForTabs(r)),
    [mensalidades]
  );
  const mensalidadesPendentesFiltradas = useMemo(() => {
    const query = mensalidadeSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return mensalidadesPendentes;
    return mensalidadesPendentes.filter((row) =>
      String(row.filhos_de_santo?.nome || '').toLocaleLowerCase('pt-BR').includes(query)
    );
  }, [mensalidadesPendentes, mensalidadeSearch]);
  const mensalidadesPagasFiltradas = useMemo(() => {
    const query = mensalidadeSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return mensalidadesPagas;
    return mensalidadesPagas.filter((row) =>
      String(row.filhos_de_santo?.nome || '').toLocaleLowerCase('pt-BR').includes(query)
    );
  }, [mensalidadesPagas, mensalidadeSearch]);

  useEffect(() => {
    if (!isAdmin || isBasicFinancePlan || !tenantId) return;
    if (activeView !== 'mensalidades' && activeView !== 'overview') return;
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
    if (!pixConfig.chave_pix?.trim()) {
      const { showHouseToast } = await import('../lib/houseToast');
      showHouseToast('Informe a chave Pix do terreiro.', 'error');
      return;
    }
    if (!pixConfig.nome_beneficiario?.trim()) {
      const { showHouseToast } = await import('../lib/houseToast');
      showHouseToast('Informe o nome do titular/beneficiário do Pix.', 'error');
      return;
    }
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
      const { showHouseToast } = await import('../lib/houseToast');
      showHouseToast('Pix e mensalidade salvos');
      if (activeView === 'mensalidades') {
        void refreshMensalidades();
      }
    } catch (error: any) {
      console.error('Error saving pix config:', error);
      const { showHouseToast } = await import('../lib/houseToast');
      showHouseToast(
        error?.message
          ? `Não deu para salvar: ${error.message}`
          : 'Não deu para salvar o Pix. Tente de novo.',
        'error',
      );
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
      showHouseToast('Erro ao criar meta.', 'error');
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
      showHouseToast('Erro ao processar doação.', 'error');
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

      {isAdmin && (
        <div data-financial-tabs="true" className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#252B33]/60 pb-3">
          <button
            type="button"
            onClick={() => {
              setActiveView('overview');
              setActiveTab?.('financial');
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
              activeView === 'overview'
                ? 'bg-primary text-[#080A0D] shadow-sm'
                : 'border border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-primary/40 hover:text-[#F1F5F9]'
            )}
          >
            <PieChart className="h-4 w-4" />
            Visão geral
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('mensalidades');
              setActiveTab?.('financial-mensalidades');
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
              activeView === 'mensalidades'
                ? 'bg-primary text-[#080A0D] shadow-sm'
                : 'border border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-primary/40 hover:text-[#F1F5F9]'
            )}
          >
            <WalletCards className="h-4 w-4" />
            Mensalidades
            {mensalidadesPendentes.length > 0 && (
              <span className={cn(
                'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-black',
                activeView === 'mensalidades' ? 'bg-[#080A0D]/20 text-[#080A0D]' : 'bg-amber-400/20 text-amber-300'
              )}>
                {mensalidadesPendentes.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView('configs');
              setActiveTab?.('financial-configs');
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
              activeView === 'configs'
                ? 'bg-primary text-[#080A0D] shadow-sm'
                : 'border border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-primary/40 hover:text-[#F1F5F9]'
            )}
          >
            <Smartphone className="h-4 w-4" />
            Configurações Pix
          </button>
        </div>
      )}
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
        ...cashTransactions.map(t => [
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
      showHouseToast('Erro ao gerar relatório.', 'error');
    }
  }

  async function handleMensalidadeLiquidar(row: MensalidadeZeladorRow) {
    if (!tenantId || !row.filho_id || processingMensalidadeId) return;
    const valorStr = mensalidadesValorEdits[row.id] ?? String(row.valor ?? '');
    const valor = parseFloat(valorStr);
    if (!Number.isFinite(valor) || valor <= 0) {
      showHouseToast('Informe um valor válido para a mensalidade.', 'error');
      return;
    }

    setProcessingMensalidadeId(row.id);
    showHouseToast('Registrando pagamento…', 'info');
    const paymentDate = brazilFinancialToday();

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
      setMensalidades((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, status: 'pago', valor, data: paymentDate } : r
        )
      );
      await fetchTransactions({ silent: true });
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
      showHouseToast('Pagamento registrado com sucesso');
    } catch (error: any) {
      console.error('Error liquidar mensalidade:', error);
      showHouseToast(error?.message || 'Erro ao registrar pagamento.', 'error');
    } finally {
      setProcessingMensalidadeId(null);
    }
  }

  async function handleMensalidadeEstornar(row: MensalidadeZeladorRow) {
    if (!tenantId || processingMensalidadeId) return;
    if (!(await confirmAction({ title: 'Estornar pagamento?', description: 'A mensalidade voltará para a lista de pendentes. O histórico financeiro será atualizado.', confirmLabel: 'Estornar pagamento', tone: 'warning' }))) return;
    setProcessingMensalidadeId(row.id);
    showHouseToast('Estornando pagamento…', 'info');
    const due = String(row.data_vencimento || row.data || '').slice(0, 10);
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
      setMensalidades((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, status: 'pendente', data: due || r.data } : r
        )
      );
      await fetchTransactions({ silent: true });
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
      showHouseToast('Pagamento estornado; mensalidade voltou para pendentes');
    } catch (error: any) {
      console.error('Error estornar mensalidade:', error);
      showHouseToast(error?.message || 'Erro ao estornar.', 'error');
    } finally {
      setProcessingMensalidadeId(null);
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
      showHouseToast(enabled ? 'Cobrança de mensalidade ativada' : 'Cobrança de mensalidade desativada');
    } catch (error: any) {
      setPixConfig((prev) => ({ ...prev, mensalidade_ativa: previous }));
      showHouseToast(error?.message || 'Erro ao atualizar cobrança de mensalidade.', 'error');
    } finally {
      setIsTogglingMensalidade(false);
    }
  }

  async function handleGerarCobranca(childId: string, nome: string, competenciaIso: string, valorExibicao: string) {
    if (!mensalidadeAtiva) {
      showHouseToast('A cobrança de mensalidade está desativada neste terreiro.', 'info');
      return;
    }
    if (!hasMensalidadesAccess) {
      setIsUpgradeModalOpen(true);
      return;
    }
    if (!pixConfig?.chave_pix?.trim()) {
      showHouseToast('Configure a chave Pix do terreiro antes de enviar cobranças.', 'error');
      setActiveView('configs');
      return;
    }

    const chargeKey = `${childId}:${competenciaIso}`;
    if (sendingChargeKey) return;

    setSendingChargeKey(chargeKey);
    showHouseToast(`Enviando cobrança para ${nome}…`, 'info');

    try {
      let mesAno = '';
      if (competenciaIso && competenciaIso.includes('-')) {
        const parts = competenciaIso.split('-');
        if (parts.length >= 2) mesAno = `${parts[1]}/${parts[0]}`;
      }
      if (!mesAno) {
        const now = new Date();
        mesAno = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      }

      const numVal = parseFloat(String(valorExibicao || '').replace(',', '.')) || parseFloat(pixConfig.valor_mensalidade) || 0;
      const valorFormatado = numVal > 0 ? numVal.toFixed(2).replace('.', ',') : (valorExibicao || '0,00');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const uid = session?.user?.id;
      if (!token || !uid) throw new Error('Sessão expirada. Faça login novamente.');
      const response = await fetch(whatsappApiUrl('/whatsapp/send'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, uid),
        body: JSON.stringify({
          tipo: 'cobranca_mensalidade',
          filhoId: childId,
          variables: {
            nome_filho: nome,
            mes_ano: mesAno,
            valor: valorFormatado,
            nome_terreiro: tenantData?.nome || 'Nosso Terreiro',
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const rawErr = String(result?.error || result?.message || 'Não foi possível enviar a mensagem.');
        if (rawErr.includes('131026') || rawErr.toLowerCase().includes('undeliverable') || rawErr.toLowerCase().includes('não possui whatsapp')) {
          throw new Error(`O número de ${nome} não possui WhatsApp ativo. Corrija o telefone no módulo Médiuns.`);
        }
        if (rawErr.includes('131047') || rawErr.toLowerCase().includes('24h')) {
          throw new Error(`Janela de 24h expirada para ${nome}. Mensagem de contingência enviada.`);
        }
        throw new Error(rawErr);
      }
      showHouseToast(`Cobrança enviada para ${nome} pelo WhatsApp`);
    } catch (error: unknown) {
      console.error('Error sending cobranca:', error);
      showHouseToast(
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível enviar a cobrança. Tente novamente.',
        'error',
      );
    } finally {
      setSendingChargeKey(null);
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

  async function handleSubmit(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();
    if (submitLock.current) return false;
    submitLock.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (!tenantId) throw new Error('Selecione o terreiro antes de registrar.');
      const entry = buildManualFinanceEntry(formData);
      const key = JSON.stringify({ tenantId, ...formData });
      if (requestRef.current?.key !== key) requestRef.current = { key, id: crypto.randomUUID() };
      const res = await authFetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tenantId, requestId: requestRef.current.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.id) throw new Error(json.error || 'O banco não confirmou o lançamento.');
      const saved = { ...json.data, valor: Number(json.data.valor) };
      setTransactions(previous => [saved, ...previous.filter(t => t.id !== saved.id)]);
      requestRef.current = null;
      setFormData({ tipo: 'entrada', valor: '', categoria: '', data: brazilFinancialToday(),
        descricao: '', filho_id: '', status: 'pendente', jurosTipo: 'nenhum', jurosValor: '' });
      window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
      void fetchTransactions();
      void refreshMensalidades({ skipSync: true });
      showHouseToast(entry.categoria === 'Mensalidade' && entry.status === 'pendente'
        ? 'Mensalidade salva em Mensalidades e vinculada ao portal do filho de santo.' : 'Lançamento registrado no extrato financeiro.');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao realizar lançamento financeiro.';
      setSubmitError(message);
      showHouseToast(message, 'error');
      return false;
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmAction({ title: 'Excluir lançamento?', description: 'Esta ação remove o lançamento do financeiro e não poderá ser desfeita.', confirmLabel: 'Excluir lançamento', tone: 'danger' }))) return;

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
      showHouseToast('Lançamento financeiro excluído');
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
      showHouseToast(err?.message || 'Erro ao excluir lançamento.', 'error');
    }
  }

  async function handleSendFinancialReminder(t: Transaction) {
    if (sendingReminderId) return;
    setSendingReminderId(t.id);
    showHouseToast('Enviando cobrança pelo WhatsApp…', 'info');
    try {
      const filhoId = (t as Transaction & { filho_id?: string }).filho_id;
      if (!filhoId) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const uid = session?.user?.id;
      if (!token || !uid) throw new Error('Sessão expirada');
      const response = await fetch(whatsappApiUrl('/whatsapp/send'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, uid),
        body: JSON.stringify({
          tipo: 'mensalidade_pendente',
          filhoId,
          variables: {
            nome_filho: t.descricao.split(' ').slice(1).join(' ') || 'Filho',
            valor_mensalidade: t.valor.toString(),
            mes_ano: new Date(t.data).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
            data_vencimento: new Date(t.data).toLocaleDateString('pt-BR'),
            nome_terreiro: tenantData?.nome || 'Nosso Terreiro',
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(result?.error || result?.message || 'Não foi possível enviar a mensagem.'));
      }
      showHouseToast('Cobrança enviada pelo WhatsApp');
    } catch (e: unknown) {
      console.error('Error sending financial reminder:', e);
      showHouseToast(
        e instanceof Error && e.message
          ? `Não foi possível enviar: ${e.message}`
          : 'Não foi possível enviar a cobrança. Tente novamente.',
        'error',
      );
    } finally {
      setSendingReminderId(null);
    }
  }

  const stats = useMemo(() => {
    return cashTransactions.reduce((acc, curr) => {
      const valor = Number(curr.valor) || 0;
      const mt = normalizeMovimentoTipo(curr.tipo);
      if (mt === 'entrada') acc.entradas += valor;
      else if (mt === 'saida') acc.saidas += valor;
      return acc;
    }, { entradas: 0, saidas: 0 });
  }, [cashTransactions]);

  const saldo = useMemo(() => stats.entradas - stats.saidas, [stats]);
  const filteredCashTransactions = useMemo(() => {
    const query = financeSearch.trim().toLocaleLowerCase('pt-BR');
    return cashTransactions.filter((transaction) => {
      const movementType = normalizeMovimentoTipo(transaction.tipo);
      const matchesType = financeTypeFilter === 'todos' || movementType === financeTypeFilter;
      const matchesSearch =
        !query ||
        `${transaction.descricao} ${transaction.categoria}`
          .toLocaleLowerCase('pt-BR')
          .includes(query);
      return matchesType && matchesSearch;
    });
  }, [cashTransactions, financeSearch, financeTypeFilter]);
  const pendingMonthlyTotal = useMemo(
    () => mensalidadesPendentes.reduce((total, row) => total + (Number(row.valor) || 0), 0),
    [mensalidadesPendentes]
  );
  const paidMonthlyTotal = useMemo(
    () => mensalidadesPagas.reduce((total, row) => total + (Number(row.valor) || 0), 0),
    [mensalidadesPagas]
  );
  const overdueMonthlyCount = useMemo(() => {
    const today = brazilFinancialToday();
    return mensalidadesPendentes.filter((row) => {
      const dueDate = mensalidadeYmdPreferVenc(row);
      return Boolean(dueDate && dueDate < today);
    }).length;
  }, [mensalidadesPendentes]);

  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  function renderTransactionActions(t: Transaction) {
    const hasReminder = t.categoria === 'Mensalidade' && !!(t as Transaction & { filho_id?: string }).filho_id;
    const isOpen = openTransactionActions === t.id;
    if (!hasReminder && !isAdmin) {
      return <span className="text-xs text-[#64748B]">—</span>;
    }

    return (
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={() => setOpenTransactionActions((current) => (current === t.id ? null : t.id))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#1E242B] bg-[#12161A] text-[#94A3B8] transition hover:border-primary/40 hover:text-primary"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Abrir ações do lançamento"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {isOpen ? (
          <div className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-xl border border-[#1E242B] bg-[#0F1318] p-1.5 text-left shadow-2xl shadow-black/40">
            {hasReminder ? (
              <button
                type="button"
                onClick={() => {
                  setOpenTransactionActions(null);
                  void handleSendFinancialReminder(t);
                }}
                disabled={sendingReminderId !== null}
                aria-busy={sendingReminderId === t.id}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#25D366] transition hover:bg-[#25D366]/10 disabled:cursor-wait disabled:opacity-60"
                role="menuitem"
              >
                {sendingReminderId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                {sendingReminderId === t.id ? 'Enviando…' : 'Cobrar pelo WhatsApp'}
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setOpenTransactionActions(null);
                  void handleDelete(t.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10"
                role="menuitem"
              >
                <Trash2 className="h-4 w-4" />
                Excluir lançamento
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
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
      : activeView === 'cantina'
        ? {
            title: 'Cantina do Terreiro',
            description: 'Controle de consumo, limite por médium e caderneta digital do terreiro.',
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
      <div className="financial-v5-page">
      <AxePageHeader
        theme="gold"
        kicker={
          activeView === 'mensalidades'
            ? 'ARRECADAÇÃO & MENSALIDADES'
            : activeView === 'cantina'
              ? 'CADERNETA & CONSUMO DO TERREIRO'
              : activeView === 'configs'
                ? 'CANAL DE RECEBIMENTO PIX'
                : 'LIVRO DE CAIXA SAGRADO'
        }
        title={pageHeader.title}
        description={pageHeader.description}
        actions={
          isAdmin && activeView === 'overview' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadReport}
                data-axe-button={modern ? 'ghost' : undefined}
                className={cn(
                  modern ? 'inline-flex items-center gap-2 px-4 py-2.5 text-sm' : 'inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/50 bg-black/40 backdrop-blur-md px-4 py-2.5 text-xs font-black text-amber-200 transition hover:bg-black/60 hover:text-white hover:border-[#D4AF37]',
                  !hasReportsAccess && 'opacity-60',
                )}
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
            </div>
          ) : null
        }
      />

      <div className="space-y-6">
        <DataLoadError message={txError ? 'Não foi possível conferir o extrato completo. Atualize os dados antes de conferir os totais.' : null} onRetry={() => void mutateTransactions()} />
        {isAdmin && <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={() => { setSubmitError(null); setEntryModalOpen(true); }} className="app-v5-primary-button inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173a2b] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/>Novo lançamento</button><button type="button" onClick={() => { setSubmitError(null); setFormData(previous => ({ ...previous, tipo: 'entrada', categoria: 'Mensalidade', status: 'pendente', descricao: '', valor: '', filho_id: '', jurosTipo: 'nenhum', jurosValor: '' })); setEntryModalOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ccd7c9] bg-white px-4 py-2.5 text-sm font-semibold text-[#264b35]"><CalendarDays size={17}/>Lançar mensalidade antiga</button></div>}
        {isAdmin && (
          <AxeTabsBar
            tabs={[
              { id: 'overview', label: 'Visão Geral', icon: PieChart },
              {
                id: 'mensalidades',
                label: 'Mensalidades',
                icon: WalletCards,
                badge: mensalidadesPendentes.length > 0 ? mensalidadesPendentes.length : undefined,
              },
              ...(isCantinaEnabled(tenantData, undefined, userId)
                ? [{ id: 'cantina', label: 'Cantina', icon: Coffee }]
                : []),
              { id: 'configs', label: 'Configurações Pix', icon: Smartphone },
            ]}
            activeTab={activeView}
            onChange={(tabId) => {
              setActiveView(tabId as any);
              if (tabId === 'overview') setActiveTab?.('financial');
              else if (tabId === 'mensalidades') setActiveTab?.('financial-mensalidades');
              else if (tabId === 'cantina') setActiveTab?.('financial-cantina');
              else if (tabId === 'configs') setActiveTab?.('financial-configs');
            }}
          />
        )}
        {activeView === 'overview' ? (loading ? <div role="status"><AppPanelLoading /><p className="text-sm text-[#586b5e]">Conferindo o extrato completo…</p></div> : txError ? null : (
          <OverviewComponent
            onNewEntry={() => setEntryModalOpen(true)}
            saldo={saldo}
            stats={stats}
            pendingMonthlyTotal={pendingMonthlyTotal}
            mensalidadesPendentes={mensalidadesPendentes}
            cashTransactions={cashTransactions}
            filteredCashTransactions={filteredCashTransactions}
            financeSearch={financeSearch}
            setFinanceSearch={setFinanceSearch}
            financeTypeFilter={financeTypeFilter}
            setFinanceTypeFilter={setFinanceTypeFilter}
            formData={formData}
            setFormData={setFormData}
            handleSubmit={handleSubmit}
            submitError={submitError}
            isSubmitting={isSubmitting}
            children={children}
            isAdmin={isAdmin}
            renderTransactionActions={renderTransactionActions}
            formatBRL={formatBRL}
          />)
        ) : (
        <div className="space-y-6">
          {activeView === 'mensalidades' ? (
            <SacredMensalidadesView
              receiptPanel={<ReceiptReviewPanel feed={receiptFeed} tenantId={tenantId||''}/>}
              receiptPendingCount={receiptFeed.pendingCount}
              receiptOpenIds={receiptFeed.openIds}
              mensalidadeAtiva={mensalidadeAtiva}
              isTogglingMensalidade={isTogglingMensalidade}
              handleToggleMensalidadeAtiva={handleToggleMensalidadeAtiva}
              mensalidadesTab={mensalidadesTab}
              setMensalidadesTab={setMensalidadesTab}
              mensalidadeSearch={mensalidadeSearch}
              setMensalidadeSearch={setMensalidadeSearch}
              mensalidadesLoading={mensalidadesLoading}
              mensalidadesSyncing={mensalidadesSyncing}
              mensalidadesError={mensalidadesError}
              onRetryMensalidades={() => void refreshMensalidades()}
              mensalidadesPendentesFiltradas={mensalidadesPendentesFiltradas}
              mensalidadesPagasFiltradas={mensalidadesPagasFiltradas}
              pendingMonthlyTotal={pendingMonthlyTotal}
              overdueMonthlyCount={overdueMonthlyCount}
              handleMensalidadeLiquidar={handleMensalidadeLiquidar}
              handleGerarCobranca={handleGerarCobranca}
              processingMensalidadeId={processingMensalidadeId}
              sendingChargeKey={sendingChargeKey}
              mensalidadesValorEdits={mensalidadesValorEdits}
              setMensalidadesValorEdits={setMensalidadesValorEdits}
              formatBRL={formatBRL}
              onNavigateToConfigs={() => setActiveTab?.('financial-configs')}
              onNavigateToChildren={() => setActiveTab?.('children')}
            />
          ) : activeView === 'cantina' ? (
            <CantinaView
              tenantId={tenantId}
              userId={userId}
              terreiroNome={tenantData?.nome_terreiro || tenantData?.name || 'Terreiro'}
              chavePix={pixConfig.chave_pix}
            />
          ) : activeView === 'caixinha' ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-[#17130D]">Caixinha do Axé</h3>
                  <p className="font-semibold text-[#665F55]">Gerencie as metas e arrecadações coletivas.</p>
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
                  <div className="flex items-center gap-2 text-rose-600">
                    <Bell className="w-5 h-5 animate-bounce" />
                    <h4 className="font-black uppercase tracking-widest text-sm">Doações Pendentes de Validação</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingDonations.map(donation => (
                      <AppDemoCard key={donation.id} className="flex flex-col gap-4 border-l-4 border-l-rose-500">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-wider text-[#665F55]">Doador</p>
                            <p className="font-bold text-[#17130D]">{donation.filhos_de_santo?.nome || 'Anônimo'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-extrabold uppercase tracking-wider text-[#665F55]">Valor</p>
                            <p className="font-black text-amber-600 text-lg">R$ {Number(donation.valor).toFixed(2)}</p>
                          </div>
                        </div>
                        {donation.comprovante_url && (
                          <div className="relative group aspect-video rounded-xl overflow-hidden bg-black/40 border border-[#D8D0C4]">
                            <img src={donation.comprovante_url} alt="Comprovante" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <a href={donation.comprovante_url} target="_blank" rel="noopener noreferrer" className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-xs font-bold text-white border border-white/10 transition-all hover:bg-white/20">
                                Ver em Tela Cheia
                              </a>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => handleValidateDonation(donation.id, 'confirmado', Number(donation.valor), donation.meta_id)} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-xs hover:bg-emerald-700 transition-colors">
                            Confirmar Recebimento
                          </button>
                          <button onClick={() => handleValidateDonation(donation.id, 'rejeitado', Number(donation.valor), donation.meta_id)} className="px-4 bg-[#EDE7DA] text-[#665F55] py-3 rounded-xl font-black text-xs hover:bg-rose-100 hover:text-rose-700 transition-all">
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
                        <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Target className="w-6 h-6 text-amber-600" />
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          meta.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-700 border-gray-300"
                        )}>
                          {meta.status === 'active' ? 'Em Andamento' : 'Concluída'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-[#17130D] mb-1">{meta.titulo}</h4>
                        <p className="text-xs font-bold text-[#665F55] uppercase tracking-wider">Meta do Terreiro</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <p className="text-xs font-extrabold uppercase tracking-wider text-[#665F55]">Progresso</p>
                          <p className="text-sm font-black text-[#17130D]">
                            R$ {Number(meta.valor_atual).toFixed(2)} <span className="text-[#665F55] font-bold">/ R$ {Number(meta.valor_alvo).toFixed(2)}</span>
                          </p>
                        </div>
                        <div className="h-3 bg-[#E8E2D5] rounded-full overflow-hidden border border-[#D8D0C4]">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-amber-500 shadow-sm" />
                        </div>
                      </div>
                      {meta.qr_code_url && (
                        <div className="pt-4 border-t border-[#D8D0C4]">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#665F55] mb-3">QR Code Pix Configurado</p>
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white p-1 border border-[#D8D0C4]">
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
            <SacredPixConfigView
              pixConfig={pixConfig}
              setPixConfig={setPixConfig}
              handleSavePixConfig={handleSavePixConfig}
              isSavingPix={isSavingPix}
              formatBRL={formatBRL}
              terreiroNome={tenantData?.nome_terreiro || tenantData?.name || 'Terreiro Sagrado'}
            />
          )}
        </div>
      )}

      {/* Modal de Upgrade */}
      <BodyPortal>
      <AnimatePresence>
        {isUpgradeModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[88dvh] flex-col space-y-5 overflow-hidden rounded-lg border border-[#DED8CB] bg-[#F9F6EE] px-6 py-8 text-center text-[#171A16] shadow-2xl sm:max-w-md sm:px-10"
            >
              <div className="w-20 h-20 bg-[#F1E8D2] rounded-full flex items-center justify-center mx-auto shrink-0">
                <Lock className="w-10 h-10 text-[#8F7724]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-black text-[#171A16]">Recurso Exclusivo</h3>
                <p className="text-[#6F675C] font-medium">
                  A automação de mensagens e relatórios avançados são exclusivos para assinantes do <span className="text-[#8F7724] font-bold">Plano Premium</span> ou <span className="text-[#8F7724] font-bold">Plano Vita</span>.
                </p>
              </div>
              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => {
                    setIsUpgradeModalOpen(false);
                    window.dispatchEvent(new CustomEvent('navigate-to-subscription'));
                  }}
                  className="w-full bg-[#17251D] text-[#FFFAF0] font-black py-4 rounded-lg shadow-lg hover:bg-[#20342A] hover:scale-105 transition-transform"
                >
                  Fazer Upgrade Agora
                </button>
                <button 
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="w-full text-[#6F675C] font-bold py-2 hover:text-[#171A16] transition-colors"
                >
                  Talvez mais tarde
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </BodyPortal>

      <FinancialEntryModal dueDay={Number(pixConfig.dia_vencimento) || 10} open={entryModalOpen} onOpenChange={open => { if (!isSubmitting) setEntryModalOpen(open); }} formData={formData} setFormData={setFormData} handleSubmit={handleSubmit} submitError={submitError} isSubmitting={isSubmitting} children={children} formatBRL={formatBRL}/>

      {/* Modal Nova Meta */}
      <BodyPortal>
      <AnimatePresence>
        {isMetaModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-y-contain p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMetaModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_DLG_IN}
              animate={MODAL_DLG_DONE}
              exit={MODAL_DLG_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-w-sm max-h-[88dvh] flex-col overflow-hidden rounded-lg border border-[#DED8CB] bg-[#F9F6EE] text-[#171A16] shadow-2xl"
            >
              <div className="p-5 sm:p-6 border-b border-[#DED8CB] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#F1E8D2] flex items-center justify-center">
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-[#8F7724]" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-display font-black text-[#171A16]">Nova Meta</h3>
                    <p className="text-xs sm:text-sm text-[#6F675C] font-medium uppercase tracking-widest">Caixinha do Axé</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMetaModalOpen(false)}
                  className="rounded-full border border-[#DCD6CA] bg-white/70 p-2 text-[#171A16] transition-colors hover:bg-white"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateMeta} className="flex-1 p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto no-scrollbar">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-black text-[#6F675C] uppercase tracking-widest ml-1">Título da Meta</label>
                    <input
                      required
                      type="text"
                      value={metaFormData.titulo}
                      onChange={(e) => setMetaFormData({ ...metaFormData, titulo: e.target.value })}
                      className="w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm sm:text-base text-[#171A16] placeholder:text-[#9B9184] focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15 transition-all"
                      placeholder="Ex: Reforma do Telhado"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-black text-[#6F675C] uppercase tracking-widest ml-1">Valor Alvo (R$)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={metaFormData.valor_alvo}
                      onChange={(e) => setMetaFormData({ ...metaFormData, valor_alvo: e.target.value })}
                      className="w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm sm:text-base text-[#171A16] placeholder:text-[#9B9184] focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-black text-[#6F675C] uppercase tracking-widest ml-1">QR Code Pix (URL da Imagem)</label>
                    <input
                      type="url"
                      value={qrCodeFile || ''}
                      onChange={(e) => setQrCodeFile(e.target.value)}
                      className="w-full rounded-xl border border-[#D8D2C4] bg-white px-3 py-2.5 text-sm sm:text-base text-[#171A16] placeholder:text-[#9B9184] focus:border-[#526A55] focus:outline-none focus:ring-2 focus:ring-[#526A55]/15 transition-all"
                      placeholder="https://..."
                    />
                    <p className="text-[10px] text-[#6F675C] italic ml-1">Insira o link da imagem do seu QR Code Pix pessoal.</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#17251D] text-[#FFFAF0] py-3 sm:py-4 rounded-xl font-black shadow-lg hover:bg-[#20342A] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 text-sm sm:text-base cursor-pointer"
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
      </BodyPortal>
      </div>
      </div>
    </AppPageShell>
  );
}
