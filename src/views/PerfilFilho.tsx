import React, { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  PartyPopper,
  User,
  ShoppingBag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
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
import { filhoKickerClass, filhoPanelClass, filhoPanelInsetClass, filhoSectionTitleClass } from '../lib/filhoUiTokens';

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

function formatDataPorExtenso(dataIso: string): string {
  try {
    const s = format(parseISO(dataIso), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return '';
  }
}

function textoPresenca(status?: string): string | null {
  const s = (status || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'confirmado') return 'Presença confirmada';
  if (lower === 'pendente') return 'Confirme sua presença';
  if (lower === 'recusado' || lower === 'ausente') return `Presença: ${s}`;
  return `Status: ${s}`;
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
      width: 168,
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
    <AppPageShell>
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Topo — nome do terreiro (vínculo) + perfil compacto */}
      <header className={cn(filhoPanelClass, 'relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10')}>
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10">
          <div className="flex-1 min-w-0 text-center lg:text-left space-y-3">
            <p className={filhoKickerClass}>Terreiro vinculado</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#F1F5F9] sm:text-4xl lg:text-5xl break-words">
              {tenantData?.nome || 'Terreiro vinculado'}
            </h1>
            <p className="text-sm text-[#94A3B8] max-w-xl mx-auto lg:mx-0">
              Portal do filho de santo — mensalidade, giras, mural e loja do Axé em um só lugar.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 shrink-0">
            <div className="flex items-center justify-center gap-4">
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}
                  disabled={isUploadingPhoto || loadingFilho || !filho}
                  className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-[3px] bg-gradient-to-br from-primary via-amber-300 to-amber-600 shadow-xl shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed"
                  aria-label="Alterar foto de perfil"
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-black border-2 border-black">
                    {loadingFilho ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-7 h-7 animate-spin text-primary" />
                      </div>
                    ) : (
                      <Avatar
                        src={fotoUrl}
                        name={displayName}
                        alt={displayName}
                        shape="circle"
                        textSize="text-2xl sm:text-3xl"
                        className="w-full h-full"
                      />
                    )}
                  </div>
                  {!loadingFilho && filho && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {isUploadingPhoto ? (
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-primary mb-0.5" />
                          <span className="text-[8px] font-black uppercase tracking-wider text-white">Alterar</span>
                        </>
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
              <div className="text-left min-w-0 max-w-[220px]">
                <p className="text-lg font-black text-white truncate">{displayName}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {cargo && (
                    <span className="inline-flex rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">
                      {cargo}
                    </span>
                  )}
                  {orixa && (
                    <span className="inline-flex rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-gray-300">
                      {orixa}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {photoMessage && (
              <p
                className={cn(
                  'text-[11px] font-semibold text-center max-w-[220px]',
                  photoMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {photoMessage.text}
              </p>
            )}
            <p className="text-[10px] text-gray-500 text-center max-w-[220px]">
              Toque na foto para escolher do celular ou computador
            </p>
          </div>
        </div>
      </header>

      {/* Mensalidade (PIX) | Próximo evento — altura independente por coluna */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start [&>section]:min-w-0">
        <section className={cn(filhoPanelClass, 'flex w-full flex-col p-6 sm:p-8')}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className={filhoKickerClass}>Mensalidade</p>
              <h2 className={cn(filhoSectionTitleClass, 'mt-1')}>
                {mensalidadeAtiva ? 'Pagamento via PIX' : 'Não habilitada'}
              </h2>
            </div>
            {mensalidadeAtiva ? (
            <button
              type="button"
              onClick={() => setActiveTab('financial')}
              className="shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary flex items-center gap-1"
            >
              Detalhes
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            ) : null}
          </div>

          {!mensalidadeAtiva && pixFetched ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-primary" aria-hidden />
              <p className="text-sm font-bold text-white">Seu terreiro não cobra mensalidade fixa</p>
              <p className="mt-2 max-w-xs text-xs text-gray-500">
                A zeladoria desativou este módulo. Contribuições podem ser combinadas diretamente com a diretoria.
              </p>
            </div>
          ) : (
          <div className="flex flex-col sm:flex-row gap-6 flex-1">
            <div className="flex flex-col items-center sm:items-start gap-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Valor</p>
              <p className="text-3xl sm:text-4xl font-black text-primary tabular-nums">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorMensalidade)}
              </p>
              <div className="rounded-2xl bg-white p-2.5 shadow-lg border border-white/20">
                <canvas ref={filhoQrRef} className="block rounded-xl" width={168} height={168} />
              </div>
              {tenantId && proximoVencimentoMensalidadeFmt && pixFetched && (
                <button
                  type="button"
                  onClick={() => setActiveTab('financial')}
                  className="group mt-1.5 w-full max-w-[188px] shrink-0 rounded-lg px-2 py-1 text-center transition-colors border border-transparent hover:border-white/[0.08] hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
                  aria-label={`Próximo vencimento da mensalidade: ${proximoVencimentoMensalidadeFmt}. Abrir mensalidade.`}
                >
                  <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-gray-600 leading-none">
                    Próximo vencimento
                  </p>
                  <p className="text-[10px] font-medium text-gray-400 mt-0.5 tabular-nums leading-tight group-hover:text-gray-300">
                    {proximoVencimentoMensalidadeFmt}
                  </p>
                </button>
              )}
              {!loadingPix && pixNotConfigured && (
                <p className="text-xs text-amber-500/90 text-center sm:text-left max-w-[240px]">
                  O zelador ainda não cadastrou a chave Pix. Avise a gestão.
                </p>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pix copia e cola</p>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 max-h-28 overflow-y-auto">
                <p className="text-[10px] font-mono text-gray-400 break-all leading-relaxed select-all">
                  {pixBrCode || (loadingPix ? 'Carregando…' : '—')}
                </p>
              </div>
              <button
                type="button"
                onClick={copyPixBrCode}
                disabled={!pixBrCode}
                className={cn(
                  'w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all',
                  copiedPix ? 'bg-emerald-600 text-white' : 'bg-primary text-black hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {copiedPix ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedPix ? 'Copiado!' : 'Copiar código PIX'}
              </button>
              {pixConfig?.chave_pix && (
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Chave ({pixConfig.tipo_chave})</p>
                  <p className="text-xs font-mono text-primary break-all">{pixConfig.chave_pix}</p>
                </div>
              )}
              <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-gray-500">
                {hasDebt ? <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                <span>{loadingDebt ? 'Verificando situação…' : hasDebt ? 'Há pendência na mensalidade.' : 'Situação em dia, axé!'}</span>
              </div>
              <button
                type="button"
                onClick={openPixModal}
                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide text-left"
              >
                Abrir PIX em tela cheia
              </button>
            </div>
          </div>
          )}
        </section>

        <section className={cn(filhoPanelClass, 'flex w-full flex-col self-start p-5 sm:p-6')}>
          <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
            <div>
              <p className={filhoKickerClass}>Giras & eventos</p>
              <h2 className={cn(filhoSectionTitleClass, 'mt-0.5 tracking-tight')}>Próximo na agenda</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary flex items-center gap-1 shrink-0"
            >
              Ver agenda
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingCal ? (
            <div className="w-full rounded-xl border border-[#1E242B] bg-[#12161A] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white/10 animate-pulse shrink-0" />
                  <div className="h-10 w-28 rounded bg-white/10 animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-0 sm:items-end sm:border-l sm:border-white/10 sm:pl-5 pt-3 sm:pt-0 border-t border-white/10 sm:border-t-0">
                <div className="h-3 w-full max-w-[180px] sm:max-w-none rounded bg-white/10 animate-pulse sm:ml-auto" />
                <div className="h-3 w-24 rounded bg-primary/20 animate-pulse sm:ml-auto" />
              </div>
            </div>
          ) : proximoEvento && proximoEventoLabels ? (
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              aria-label={`Abrir agenda completa: ${proximoEvento.titulo}`}
              className={cn(
                filhoPanelInsetClass,
                'group flex w-full cursor-pointer flex-col px-4 py-3.5 text-left transition-all hover:border-primary/30 sm:px-5 sm:py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45',
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5 shrink-0">
                <p className="text-[11px] text-white/90 italic tracking-wide">Próximo evento</p>
                {proximoEvento.tipo ? (
                  <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
                    {proximoEvento.tipo}
                  </span>
                ) : null}
              </div>
              {formatDataPorExtenso(proximoEvento.data) ? (
                <p className="text-[10px] font-semibold text-gray-500 mb-2 leading-snug pr-6">
                  {formatDataPorExtenso(proximoEvento.data)}
                </p>
              ) : null}
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 min-w-0">
                <div className="flex items-center gap-3 shrink-0">
                  <CalendarIcon className="w-8 h-8 text-primary shrink-0 stroke-[1.25] group-hover:scale-105 transition-transform" aria-hidden />
                  <div className="flex items-end gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-primary tabular-nums leading-none tracking-tight">
                      {proximoEventoLabels.dia}
                    </span>
                    <span className="text-xs font-black text-white uppercase tracking-[0.16em] pb-0.5">
                      {proximoEventoLabels.mes}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex flex-col gap-1 border-t border-white/10 pt-3 sm:border-t-0 sm:border-l sm:border-white/10 sm:pl-5 sm:pt-0 sm:flex-1">
                  <p className="text-sm text-white font-bold leading-snug line-clamp-2">{proximoEvento.titulo}</p>
                  {formatHoraEvento(proximoEvento.hora) ? (
                    <p className="text-sm text-primary italic font-semibold tabular-nums">
                      {formatHoraEvento(proximoEvento.hora)}
                    </p>
                  ) : null}
                  {proximoEvento.local?.trim() ? (
                    <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">
                      <span className="font-black text-gray-500 uppercase tracking-wider">Local: </span>
                      {proximoEvento.local.trim()}
                    </p>
                  ) : null}
                  {textoPresenca(proximoEvento.status_confirmacao) ? (
                    <p className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wide">
                      {textoPresenca(proximoEvento.status_confirmacao)}
                    </p>
                  ) : null}
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 mt-1 flex items-center gap-1">
                    Ver na agenda
                    <ArrowRight className="w-3 h-3 inline group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#2F3643] bg-[#12161A] px-4 py-8 text-center">
              <CalendarIcon className="w-9 h-9 text-primary/45 mx-auto mb-2.5" />
              <p className="text-xs font-bold text-gray-400 italic">Nenhum evento futuro na agenda</p>
              <p className="text-[11px] text-gray-600 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Quando o zelador cadastrar giras ou eventos, o próximo aparecerá aqui.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                Abrir calendário completo
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Mural + Biblioteca — colunas iguais, painéis alinhados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        <section className={cn(filhoPanelClass, 'flex min-w-0 flex-col p-5 sm:p-6')}>
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#1E242B] pb-3">
            <div className="min-w-0">
              <p className={filhoKickerClass}>Mural do terreiro</p>
              <h2 className={cn(filhoSectionTitleClass, 'mt-0.5')}>Últimos avisos</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('mural')}
              className="shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary flex items-center gap-1"
            >
              Ver mural
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loadingNotices ? (
            <div className="space-y-3 w-full">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#1E242B] bg-[#12161A] h-28 animate-pulse"
                />
              ))}
            </div>
          ) : sortedNotices.length === 0 ? (
            <div className="w-full rounded-xl border border-dashed border-[#2F3643] bg-[#12161A] py-10 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto">
                <Info className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-sm font-bold text-gray-300">Nenhum aviso por aqui ainda</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Quando o zelador publicar avisos no mural, eles aparecerão neste feed.
              </p>
            </div>
          ) : (
            <div className="space-y-3 w-full min-w-0">
            {sortedNotices.slice(0, 2).map((notice, idx) => {
              const cfg = categoryConfig[notice.categoria] || categoryConfig.Geral;
              const Icon = cfg.icon;
              return (
                <motion.article
                  key={notice.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    filhoPanelInsetClass,
                    'overflow-hidden',
                    notice.categoria === 'Urgente' ? 'border-rose-500/25' : '',
                  )}
                >
                  <header className="flex items-start gap-2.5 px-3.5 pt-3.5 pb-2.5 border-b border-white/[0.06]">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0',
                        cfg.bg,
                        cfg.border
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-xs font-black text-white leading-tight truncate">
                          {tenantData?.nome || 'Terreiro'}
                        </p>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest',
                            cfg.badge
                          )}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                        {format(new Date(notice.data_publicacao), "dd 'de' MMM • HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </header>

                  <div className="px-3.5 py-3 space-y-1">
                    <h3 className="text-sm font-black text-white tracking-tight leading-snug line-clamp-2">
                      {notice.titulo}
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none text-gray-400 text-xs leading-relaxed line-clamp-3 [&>*:first-child]:mt-0">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{notice.conteudo}</ReactMarkdown>
                    </div>
                  </div>
                </motion.article>
              );
            })}
            {sortedNotices.length > 2 ? (
              <button
                type="button"
                onClick={() => setActiveTab('mural')}
                className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                + {sortedNotices.length - 2} aviso(s) no mural
              </button>
            ) : null}
            </div>
          )}
        </section>

        <section className={cn(filhoPanelClass, 'flex min-w-0 min-h-0 flex-col p-5 sm:p-6')}>
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

      {/* Loja do Axé */}
      <section className={cn(filhoPanelClass, 'p-5 sm:p-6 space-y-4')}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1E242B] pb-3">
          <div className="min-w-0">
            <p className={filhoKickerClass}>Loja do Axé</p>
            <h2 className={cn(filhoSectionTitleClass, 'mt-0.5')}>Produtos do terreiro</h2>
            <p className="text-xs text-gray-500 mt-1">Itens cadastrados pelo zelador para a comunidade.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className="shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary flex items-center gap-1"
          >
            Ir para a loja
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {loadingProducts ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
            ))
          ) : products.length === 0 ? (
            <div className="col-span-full py-10 text-center rounded-xl border border-dashed border-[#2F3643] bg-[#12161A]">
              <ShoppingBag className="w-9 h-9 text-gray-600 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold text-gray-400">Nenhum produto na vitrine ainda</p>
            </div>
          ) : (
            products.map((product) => (
              <motion.button
                key={product.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('store')}
                className="group text-left rounded-xl border border-[#1E242B] bg-[#12161A] overflow-hidden transition-colors hover:border-primary/30"
              >
                <div className="aspect-square bg-black/50 relative">
                  {product.imagem_url ? (
                    <img
                      src={product.imagem_url}
                      alt={product.nome}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-10 h-10 text-white/10" />
                    </div>
                  )}
                  {product.estoque_atual <= 0 && (
                    <span className="absolute bottom-2 left-2 text-[9px] font-black uppercase bg-black/80 text-gray-400 px-2 py-0.5 rounded-md border border-white/10">
                      Esgotado
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-0.5">
                  <p className="text-[11px] font-black text-white line-clamp-2 leading-tight">{product.nome}</p>
                  <p className="text-sm font-black text-primary">R$ {product.preco.toFixed(2)}</p>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </section>

      {/* Footer suave */}
      <footer className="text-center pt-2 pb-2">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-700 flex items-center justify-center gap-1.5">
          <User className="w-3 h-3" />
          Ilê Asé — Portal do Filho de Santo
        </div>
      </footer>

      <PixPaymentModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        loading={loadingPix}
        pixConfig={pixConfig}
        valor={valorMensalidade}
        descricao="Mensalidade Ilê Asé"
        txid={(filho?.id || user.id).replace(/-/g, '').slice(0, 25).padEnd(5, '0')}
      />
    </div>
    </AppPageShell>
  );
}
