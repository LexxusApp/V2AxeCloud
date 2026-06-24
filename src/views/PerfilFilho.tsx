import React, { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  Copy,
  Home,
  Info,
  Loader2,
  PartyPopper,
  ShoppingBag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { addMonths, endOfMonth, format, parseISO, startOfDay } from 'date-fns';
import { computeProximaDataMensalidadePrevisao } from '../lib/mensalidadeDueDate';
import { isPaidMensalidadeFinanceRow } from '../lib/mensalidadeFinanceRow';
import { ptBR } from 'date-fns/locale';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { authFetch } from '../lib/authenticatedFetch';
import { resolveStoreTenantPk } from '../lib/resolveStoreTenantPk';
import { cn } from '../lib/utils';
import PixPaymentModal, { PixConfig, buildPixPayload } from '../components/PixPaymentModal';
import Avatar from '../components/Avatar';
import Library from './Library';
import { AppPageShell } from '../components/app/AppTopNav';
import { resolveTenantIdForFinance } from '../lib/tenantCache';
import {
  filhoChipPanelClass,
  filhoKickerClass,
  filhoPanelClass,
  filhoPanelInsetClass,
  filhoPanelPaddingClass,
  filhoSectionHeaderClass,
  filhoSectionLinkClass,
  filhoSectionTitleClass,
} from '../lib/filhoUiTokens';

type Tenant =
  | { nome?: string; plan?: string; tenant_id?: string; foto_url?: string }
  | null
  | undefined;

interface PerfilFilhoProps {
  user: SupabaseUser;
  tenantData?: Tenant;
  setActiveTab: (tab: string) => void;
}

interface Notice {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: 'Urgente' | 'Festas' | 'Doutrina' | 'Geral';
  data_publicacao: string;
}

interface Product {
  id: string;
  nome: string;
  preco: number;
  imagem_url: string;
  estoque_atual: number;
}

interface CalEvent {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  descricao?: string;
  status_confirmacao?: string;
  local?: string;
}

const MES_ABREV_PT = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
] as const;

function eventDateTimeMs(ev: CalEvent): number {
  const t = (ev.hora || '00:00:00').trim();
  const time = /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t;
  const ms = new Date(`${ev.data}T${time}`).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function formatHoraEvento(hora?: string): string {
  const raw = (hora || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `às ${m[1].padStart(2, '0')}:${m[2]}`;
  return `às ${raw.slice(0, 5)}`;
}

interface FilhoData {
  id: string;
  nome: string;
  foto_url?: string | null;
  cargo?: string | null;
  orixa_frente?: string | null;
  created_at?: string;
  data_entrada?: string;
}

const MENSALIDADE_VALOR_PADRAO = 89.9;

const categoryConfig: Record<
  Notice['categoria'],
  { icon: typeof Info; color: string; bg: string; border: string; badge: string; label: string }
> = {
  Urgente: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'bg-red-500 text-white',
    label: 'Urgente',
  },
  Festas: {
    icon: PartyPopper,
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    badge: 'bg-amber-400 text-black',
    label: 'Festa',
  },
  Doutrina: {
    icon: BookOpen,
    color: 'text-blue-300',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500 text-white',
    label: 'Doutrina',
  },
  Geral: {
    icon: Info,
    color: 'text-gray-300',
    bg: 'bg-white/5',
    border: 'border-white/10',
    badge: 'bg-white/10 text-white',
    label: 'Aviso',
  },
};

export default function PerfilFilho({ user, tenantData, setActiveTab }: PerfilFilhoProps) {
  const tenantId = resolveTenantIdForFinance(tenantData?.tenant_id, user.id, true);

  const [filho, setFilho] = useState<FilhoData | null>(null);
  const [loadingFilho, setLoadingFilho] = useState(true);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [hasDebt, setHasDebt] = useState(false);
  const [valorMensalidade, setValorMensalidade] = useState<number>(MENSALIDADE_VALOR_PADRAO);
  const [loadingDebt, setLoadingDebt] = useState(true);

  const [pixConfig, setPixConfig] = useState<PixConfig | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [pixFetched, setPixFetched] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);
  const filhoQrRef = useRef<HTMLCanvasElement>(null);
  const [pixBrCode, setPixBrCode] = useState('');
  const [copiedPix, setCopiedPix] = useState(false);
  /** Dia de vencimento configurado pelo zelador (Pix / financeiro). */
  const [diaVencimentoMensalidade, setDiaVencimentoMensalidade] = useState(10);
  const [mensalidadeAtiva, setMensalidadeAtiva] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fallback para quando os dados do banco ainda estão carregando
  // Priorizamos user_metadata.nome que é onde o servidor salvou o nome oficial do filho
  const rawFallback =
    user.user_metadata?.nome || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Filho de Santo';
  
  const isShadowEmailFallback =
    typeof rawFallback === 'string' && /^f_[a-f0-9-]{8,}$/i.test(rawFallback);
  const fallbackName = isShadowEmailFallback ? 'Filho de Santo' : rawFallback;

  // 1. Dados do filho (nome, cargo, foto)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let { data, error } = await supabase
          .from('filhos_de_santo')
          .select('id, nome, foto_url, cargo, orixa_frente, created_at, data_entrada')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!data && user.email) {
          const { data: byEmail, error: emailErr } = await supabase
            .from('filhos_de_santo')
            .select('id, nome, foto_url, cargo, orixa_frente, created_at, data_entrada')
            .eq('email', user.email)
            .maybeSingle();
          if (!emailErr && byEmail) data = byEmail;
        }
        if (!cancelled && !error && data) setFilho(data as FilhoData);
      } finally {
        if (!cancelled) setLoadingFilho(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, user.email]);

  // 2. Mensalidade do mês: entrada "Mensalidade" no financeiro (filho_id ou ID na descrição).
  useEffect(() => {
    if (!filho?.id || !tenantId) {
      setLoadingDebt(false);
      setHasDebt(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDebt(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const txParams = new URLSearchParams({
          tenantId,
          userId: user.id,
          userRole: 'filho',
          limit: '150',
        });
        const em = String(user?.email || '').trim();
        if (em) txParams.set('userEmail', em);
        const txHeaders: Record<string, string> = {};
        if (token) txHeaders.Authorization = `Bearer ${token}`;
        const res = await authFetch(`/api/transactions?${txParams.toString()}`, { headers: txHeaders });
        if (!res.ok) throw new Error('tx');
        const { data } = await res.json();
        const txs = (data || []) as any[];
        const now = new Date();
        const y = now.getFullYear();
        const mo = now.getMonth();
        const paid = txs.some((t) => {
          if (!isPaidMensalidadeFinanceRow(t as Record<string, unknown>)) return false;
          const d = new Date(t.data);
          if (d.getFullYear() !== y || d.getMonth() !== mo) return false;
          if (t.filho_id === filho.id) return true;
          return new RegExp(`\\(ID:${filho.id}\\)`).test(String(t.descricao || ''));
        });
        if (!cancelled) setHasDebt(!paid);
      } catch {
        if (!cancelled) setHasDebt(false);
      } finally {
        if (!cancelled) setLoadingDebt(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filho?.id, tenantId, user.id]);

  // 3. Mural — feed central (estilo rede social)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingNotices(true);
      try {
        const res = await authFetch(`/api/notices?tenantId=${tenantId || ''}`);
        if (!res.ok) throw new Error('Falha ao carregar avisos');
        const { data } = await res.json();
        if (!cancelled) setNotices((data as Notice[]) || []);
      } catch (err) {
        console.error('Erro ao buscar avisos do mural:', err);
      } finally {
        if (!cancelled) setLoadingNotices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // 3.1. Produtos da Loja (Destaques) — mesmo tenant_pk que a aba Loja (perfil_lider.id)
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      try {
        const pk = await resolveStoreTenantPk({
          tenantIdFromContext: tenantId,
          fallbackUserId: user.id,
        });
        if (!pk || cancelled) {
          if (!cancelled) setProducts([]);
          return;
        }
        const { data, error } = await supabase
          .from('produtos')
          .select('id, nome, preco, imagem_url, estoque_atual')
          .is('deleted_at', null)
          .eq('tenant_id', pk)
          .order('nome', { ascending: true })
          .limit(8);

        if (!error && !cancelled) setProducts((data as Product[]) || []);
        else if (!cancelled) setProducts([]);
      } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, user.id]);

  // 4. Configuração Pix — mesma rota que o painel financeiro do zelador: o servidor
  // resolve terreiro_id (perfil_lider) e faz .or(resolvedId, tenantId). Consulta direta
  // no cliente com .eq('terreiro_id', tenantId) falhava quando tenant_id lógico ≠ id do líder.
  const loadPixConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoadingPix(true);
    try {
      const res = await authFetch(
        `/api/v1/financial/pix-config?tenantId=${encodeURIComponent(tenantId)}`
      );
      if (!res.ok) {
        setPixConfig(null);
        return;
      }
      const { data } = await res.json();
      setMensalidadeAtiva(data?.mensalidade_ativa !== false);
      if (data?.dia_vencimento != null && data.dia_vencimento !== '') {
        setDiaVencimentoMensalidade(parseInt(String(data.dia_vencimento), 10) || 10);
      }
      const vm = data?.valor_mensalidade as number | string | null | undefined;
      if (vm != null && !Number.isNaN(Number(vm)) && Number(vm) > 0) {
        setValorMensalidade(Number(vm));
      }
      if (data?.chave_pix) {
        setPixConfig({
          chave_pix: data.chave_pix,
          tipo_chave: data.tipo_chave || 'cpf',
          nome_beneficiario: data.nome_beneficiario || '',
          cidade: 'BRASIL',
        });
      } else {
        setPixConfig(null);
      }
    } catch (err) {
      console.error('Erro ao carregar configuração Pix:', err);
      setPixConfig(null);
    } finally {
      setLoadingPix(false);
      setPixFetched(true);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setPixFetched(false);
      setPixConfig(null);
      setLoadingPix(false);
      setDiaVencimentoMensalidade(10);
      setMensalidadeAtiva(true);
      return;
    }
    setPixFetched(false);
    void loadPixConfig();
  }, [tenantId, loadPixConfig]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setLoadingCal(true);
      try {
        const hoje = startOfDay(new Date());
        const fim = endOfMonth(addMonths(hoje, 5));
        const url = `/api/events?tenantId=${encodeURIComponent(tenantId)}&start=${format(hoje, 'yyyy-MM-dd')}&end=${format(fim, 'yyyy-MM-dd')}&scope=calendar`;
        const res = await authFetch(url);
        if (!res.ok) throw new Error('Falha ao carregar eventos');
        const { data } = await res.json();
        if (!cancelled) setCalEvents((data as CalEvent[]) || []);
      } catch (e) {
        console.error('Erro ao buscar eventos (dashboard filho):', e);
        if (!cancelled) setCalEvents([]);
      } finally {
        if (!cancelled) setLoadingCal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    if (!pixConfig?.chave_pix || !filho) {
      setPixBrCode('');
      return;
    }
    const txid = (filho.id || user.id).replace(/-/g, '').slice(0, 25).padEnd(5, '0');
    const payload = buildPixPayload(pixConfig, valorMensalidade, txid, 'Mensalidade terreiro');
    setPixBrCode(payload);
    const canvas = filhoQrRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, payload, {
      width: 120,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {});
  }, [pixConfig, filho, valorMensalidade, user.id]);

  const openPixModal = async () => {
    setPixModalOpen(true);
    await loadPixConfig();
  };

  const copyPixBrCode = () => {
    if (!pixBrCode) return;
    navigator.clipboard.writeText(pixBrCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2200);
  };

  const pixNotConfigured = pixFetched && !loadingPix && !pixConfig?.chave_pix;

  /** Mesma regra do financeiro do zelador: data de entrada + dia fixo (+ véspera). */
  const proximoVencimentoMensalidadeFmt = useMemo(() => {
    const iso = computeProximaDataMensalidadePrevisao(
      filho?.data_entrada,
      diaVencimentoMensalidade,
      new Date(),
      filho?.created_at
    );
    try {
      const s = format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      return null;
    }
  }, [filho?.data_entrada, filho?.created_at, diaVencimentoMensalidade]);

  const sortedNotices = useMemo(() => {
    return [...notices].sort((a, b) => {
      if (a.categoria === 'Urgente' && b.categoria !== 'Urgente') return -1;
      if (a.categoria !== 'Urgente' && b.categoria === 'Urgente') return 1;
      return new Date(b.data_publicacao).getTime() - new Date(a.data_publicacao).getTime();
    });
  }, [notices]);

  const displayName = filho?.nome?.trim() || fallbackName;
  const cargo = filho?.cargo?.trim();
  const orixa = filho?.orixa_frente?.trim();
  const fotoUrl = filho?.foto_url || null;

  useEffect(() => {
    if (!photoMessage) return;
    const t = window.setTimeout(() => setPhotoMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [photoMessage]);

  const handlePhotoUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !filho) return;

      if (!file.type.startsWith('image/')) {
        setPhotoMessage({ text: 'Selecione uma imagem (JPG, PNG ou WebP).', type: 'error' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setPhotoMessage({ text: 'A imagem deve ter no máximo 5 MB.', type: 'error' });
        return;
      }

      setIsUploadingPhoto(true);
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const encoded = result.split(',')[1];
            if (!encoded) reject(new Error('Falha ao ler a imagem.'));
            else resolve(encoded);
          };
          reader.onerror = () => reject(new Error('Erro ao processar a imagem.'));
          reader.readAsDataURL(file);
        });

        const response = await authFetch('/api/v1/filho/profile-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64Data,
            contentType: file.type,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao enviar foto.');
        }

        const publicUrl = String(data.publicUrl || '');
        setFilho((prev) => (prev ? { ...prev, foto_url: publicUrl } : prev));
        setPhotoMessage({ text: 'Foto de perfil atualizada!', type: 'success' });
      } catch (err: unknown) {
        setPhotoMessage({
          text: err instanceof Error ? err.message : 'Erro ao enviar foto.',
          type: 'error',
        });
      } finally {
        setIsUploadingPhoto(false);
      }
    },
    [filho]
  );

  const proximoEvento = useMemo(() => {
    const now = Date.now();
    const sorted = [...calEvents]
      .filter((e) => {
        const t = eventDateTimeMs(e);
        return t > 0 && t >= now;
      })
      .sort((a, b) => eventDateTimeMs(a) - eventDateTimeMs(b));
    return sorted[0] ?? null;
  }, [calEvents]);

  const proximoEventoLabels = useMemo(() => {
    if (!proximoEvento) return null;
    try {
      const d = parseISO(proximoEvento.data);
      return { dia: format(d, 'd'), mes: MES_ABREV_PT[d.getMonth()] ?? '—' };
    } catch {
      return { dia: '—', mes: '—' };
    }
  }, [proximoEvento]);

  return (
    <AppPageShell fullWidth>
      <div className="flex w-full flex-col gap-4">
        {/* Perfil */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(filhoPanelClass, filhoChipPanelClass, filhoPanelPaddingClass)}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="group relative shrink-0">
              <button
                type="button"
                onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}
                disabled={isUploadingPhoto || loadingFilho || !filho}
                className="relative h-12 w-12 rounded-full ring-2 ring-primary/30 transition hover:ring-primary/50 disabled:opacity-70 sm:h-14 sm:w-14"
                aria-label="Alterar foto de perfil"
              >
                <div className="h-full w-full overflow-hidden rounded-full bg-[#0B0E12]">
                  {loadingFilho ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Avatar
                      src={fotoUrl}
                      name={displayName}
                      alt={displayName}
                      shape="circle"
                      textSize="text-lg"
                      className="h-full w-full"
                    />
                  )}
                </div>
                {!loadingFilho && filho && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    {isUploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Camera className="h-4 w-4 text-primary" />
                    )}
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                onChange={(e) => void handlePhotoUpload(e)}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-base font-bold text-white sm:text-lg">{displayName}</h1>
                {cargo && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                    {cargo}
                  </span>
                )}
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#94A3B8]">
                <span className="inline-flex items-center gap-1.5">
                  <Home className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
                  {tenantData?.nome || 'Terreiro vinculado'}
                </span>
                {orixa && <span className="text-[#64748B]">· {orixa}</span>}
              </p>
            </div>
            {mensalidadeAtiva && !loadingDebt && (
              <span
                className={cn(
                  'ml-auto hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase sm:inline-flex',
                  hasDebt
                    ? 'border-red-500/25 bg-red-500/10 text-red-400'
                    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', hasDebt ? 'bg-red-400' : 'bg-emerald-400')} />
                {hasDebt ? 'Em aberto' : 'Em dia'}
              </span>
            )}
          </div>
          {photoMessage && (
            <p
              className={cn(
                'mt-2 text-[11px] font-semibold',
                photoMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {photoMessage.text}
            </p>
          )}
        </motion.header>

        {/* Mensalidade | Agenda */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <section className={cn(filhoPanelClass, filhoPanelPaddingClass)}>
            <div className={filhoSectionHeaderClass}>
              <div>
                <p className={filhoKickerClass}>Mensalidade</p>
                <h2 className={cn(filhoSectionTitleClass, 'mt-0.5')}>
                  {mensalidadeAtiva ? 'Pagamento via PIX' : 'Não habilitada'}
                </h2>
              </div>
              {mensalidadeAtiva ? (
                <button type="button" onClick={() => setActiveTab('financial')} className={filhoSectionLinkClass}>
                  Detalhes
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            {!mensalidadeAtiva && pixFetched ? (
              <p className="text-sm text-[#94A3B8]">Seu terreiro não cobra mensalidade fixa neste módulo.</p>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-start">
                  <div className="rounded-xl bg-white p-1.5 shadow-sm">
                    <canvas ref={filhoQrRef} className="block rounded-lg" width={120} height={120} />
                  </div>
                  <div>
                    <p className="text-2xl font-black tabular-nums text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorMensalidade)}
                    </p>
                    {tenantId && proximoVencimentoMensalidadeFmt && pixFetched && (
                      <p className="mt-1 text-[11px] text-[#64748B]">
                        Vence em <span className="text-[#94A3B8]">{proximoVencimentoMensalidadeFmt}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className={cn(filhoPanelInsetClass, 'max-h-20 overflow-y-auto px-2.5 py-2')}>
                    <p className="break-all font-mono text-[10px] leading-relaxed text-[#94A3B8] select-all">
                      {pixBrCode || (loadingPix ? 'Carregando…' : '—')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyPixBrCode}
                    disabled={!pixBrCode}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wide transition',
                      copiedPix
                        ? 'bg-emerald-600 text-white'
                        : 'bg-primary text-black hover:opacity-95 disabled:opacity-40',
                    )}
                  >
                    {copiedPix ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedPix ? 'Copiado!' : 'Copiar PIX'}
                  </button>
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span className="inline-flex items-center gap-1">
                      {hasDebt ? (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {loadingDebt ? 'Verificando…' : hasDebt ? 'Pendência no mês' : 'Em dia, axé!'}
                    </span>
                    <button type="button" onClick={openPixModal} className="font-bold text-primary hover:underline">
                      Ampliar
                    </button>
                  </div>
                  {!loadingPix && pixNotConfigured && (
                    <p className="text-[11px] text-amber-500/90">Chave Pix não cadastrada pelo zelador.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className={cn(filhoPanelClass, filhoPanelPaddingClass)}>
            <div className={filhoSectionHeaderClass}>
              <div>
                <p className={filhoKickerClass}>Giras & eventos</p>
                <h2 className={cn(filhoSectionTitleClass, 'mt-0.5')}>Próximo na agenda</h2>
              </div>
              <button type="button" onClick={() => setActiveTab('calendar')} className={filhoSectionLinkClass}>
                Agenda
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {loadingCal ? (
              <div className={cn(filhoPanelInsetClass, 'h-24 animate-pulse')} />
            ) : proximoEvento && proximoEventoLabels ? (
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={cn(
                  filhoPanelInsetClass,
                  'flex w-full gap-3 p-3 text-left transition hover:border-primary/30',
                )}
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-xl font-black leading-none tabular-nums">{proximoEventoLabels.dia}</span>
                  <span className="text-[9px] font-bold uppercase">{proximoEventoLabels.mes}</span>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold text-white">{proximoEvento.titulo}</p>
                  {formatHoraEvento(proximoEvento.hora) && (
                    <p className="mt-0.5 text-xs text-primary">{formatHoraEvento(proximoEvento.hora)}</p>
                  )}
                </div>
              </button>
            ) : (
              <div className={cn(filhoPanelInsetClass, 'flex flex-col items-center px-3 py-8 text-center')}>
                <CalendarIcon className="mb-2 h-7 w-7 text-primary/40" />
                <p className="text-xs font-semibold text-[#94A3B8]">Nenhum evento futuro</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="mt-2 text-[10px] font-bold uppercase tracking-wide text-primary hover:underline"
                >
                  Ver calendário
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Mural | Biblioteca */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <section className={cn(filhoPanelClass, filhoPanelPaddingClass)}>
            <div className={filhoSectionHeaderClass}>
              <div>
                <p className={filhoKickerClass}>Mural do terreiro</p>
                <h2 className={cn(filhoSectionTitleClass, 'mt-0.5')}>Últimos avisos</h2>
              </div>
              <button type="button" onClick={() => setActiveTab('mural')} className={filhoSectionLinkClass}>
                Ver mural
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {loadingNotices ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className={cn(filhoPanelInsetClass, 'h-16 animate-pulse')} />
                ))}
              </div>
            ) : sortedNotices.length === 0 ? (
              <div className={cn(filhoPanelInsetClass, 'py-8 text-center')}>
                <Info className="mx-auto mb-2 h-6 w-6 text-[#64748B]" />
                <p className="text-xs font-semibold text-[#94A3B8]">Nenhum aviso publicado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedNotices.slice(0, 2).map((notice) => {
                  const cfg = categoryConfig[notice.categoria] || categoryConfig.Geral;
                  const Icon = cfg.icon;
                  return (
                    <article
                      key={notice.id}
                      className={cn(
                        filhoPanelInsetClass,
                        'overflow-hidden p-3',
                        notice.categoria === 'Urgente' ? 'border-rose-500/25' : '',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.color)} aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{notice.titulo}</p>
                          <p className="text-[10px] text-[#64748B]">
                            {format(new Date(notice.data_publicacao), "dd MMM • HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className={cn(filhoPanelClass, filhoPanelPaddingClass, 'min-w-0')}>
            <Library
              user={user}
              userRole="filho"
              tenantData={tenantData}
              isAdminGlobal={false}
              setActiveTab={setActiveTab}
              embedded
            />
          </section>
        </div>

        {/* Loja */}
        <section className={cn(filhoPanelClass, filhoPanelPaddingClass)}>
          <div className={filhoSectionHeaderClass}>
            <div>
              <p className={filhoKickerClass}>Loja do Axé</p>
              <h2 className={cn(filhoSectionTitleClass, 'mt-0.5')}>Produtos do terreiro</h2>
            </div>
            <button type="button" onClick={() => setActiveTab('store')} className={filhoSectionLinkClass}>
              Ver loja
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {loadingProducts ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={cn(filhoPanelInsetClass, 'aspect-[4/5] animate-pulse')} />
              ))
            ) : products.length === 0 ? (
              <div className={cn(filhoPanelInsetClass, 'col-span-full py-8 text-center')}>
                <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-[#64748B] opacity-40" />
                <p className="text-xs font-semibold text-[#94A3B8]">Nenhum produto na vitrine</p>
              </div>
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setActiveTab('store')}
                  className={cn(filhoPanelInsetClass, 'overflow-hidden text-left transition hover:border-primary/30')}
                >
                  <div className="relative aspect-square bg-black/40">
                    {product.imagem_url ? (
                      <img src={product.imagem_url} alt={product.nome} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-white/10" />
                      </div>
                    )}
                    {product.estoque_atual <= 0 && (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-bold uppercase text-gray-400">
                        Esgotado
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 p-2.5">
                    <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white">{product.nome}</p>
                    <p className="text-sm font-black text-primary">R$ {product.preco.toFixed(2)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <PixPaymentModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        loading={loadingPix}
        pixConfig={pixConfig}
        valor={valorMensalidade}
        descricao="Mensalidade Ilê Asé"
        txid={(filho?.id || user.id).replace(/-/g, '').slice(0, 25).padEnd(5, '0')}
      />
    </AppPageShell>
  );
}
