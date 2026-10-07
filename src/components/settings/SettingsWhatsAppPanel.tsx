import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  Clock3,
  MessageSquare,
  Radio,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Wifi,
  Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import {
  whatsappApiUrl,
  whatsappRailwayAuthHeaders,
  whatsappRailwayHeaders,
  whatsappRailwayJsonBody,
} from '../../lib/whatsappApiUrl';

type WaLogTipo = 'gira' | 'financeiro' | 'reza' | 'transmissao' | 'broadcast' | 'acesso' | 'teste';

type WaLogUi = {
  id: string;
  destino: string;
  telefone: string;
  mensagem: string;
  data: string;
  tipo: WaLogTipo;
  status: 'Enviado' | 'Falha' | 'Parcial' | 'Entregue' | 'Lido' | 'Aceito pela Meta';
};

type WaPreferences = {
  notifGiras: boolean;
  notifFinanceiro: boolean;
  notifReza: boolean;
  notifAniversarios: boolean;
};

const DEFAULT_PREFS: WaPreferences = {
  notifGiras: true,
  notifFinanceiro: true,
  notifReza: true,
  notifAniversarios: true,
};

const MAX_VISIBLE_LOGS = 40;
const LOG_FETCH_LIMIT = 50;

const BADGE_COLORS: Record<WaLogTipo, string> = {
  gira: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black',
  financeiro: 'bg-blue-100 text-blue-900 border-blue-300 font-black',
  reza: 'bg-rose-100 text-rose-900 border-rose-300 font-black',
  acesso: 'bg-sky-100 text-sky-900 border-sky-300 font-black',
  teste: 'bg-amber-100 text-amber-900 border-amber-300 font-black',
  broadcast: 'bg-purple-100 text-purple-900 border-purple-300 font-black',
  transmissao: 'bg-purple-100 text-purple-900 border-purple-300 font-black',
};

const BADGE_LABELS: Record<WaLogTipo, string> = {
  gira: 'gira',
  financeiro: 'financeiro',
  reza: 'reza',
  acesso: 'acesso',
  teste: 'teste',
  broadcast: 'broadcast',
  transmissao: 'transmissão',
};

function mapLogTipo(raw: string | null | undefined): WaLogTipo {
  const t = String(raw || '').toLowerCase();
  if (t.includes('gira') || t.includes('convite') || t.includes('evento')) return 'gira';
  if (t.includes('financ') || t.includes('mensal') || t.includes('cobran')) return 'financeiro';
  if (t.includes('reza') || t.includes('altar') || t.includes('vela')) return 'reza';
  if (
    t.includes('acesso') ||
    t.includes('credencial') ||
    t.includes('conta_ativa') ||
    t.includes('senha') ||
    t.includes('forgot') ||
    t.includes('recuperar')
  ) {
    return 'acesso';
  }
  if (t === 'broadcast') return 'broadcast';
  if (t === 'transmissao_aviso' || t === 'mural_aviso' || t.includes('mural') || t.includes('portal')) {
    return 'transmissao';
  }
  if (t === 'teste') return 'teste';
  return 'teste';
}

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje às ${time}`;
  if (isYesterday) return `Ontem às ${time}`;
  return `${d.toLocaleDateString('pt-BR')} às ${time}`;
}

function logDestino(telefone: string | null | undefined, tipo: WaLogTipo): string {
  const tel = String(telefone || '');
  if (tel === 'corrente_geral') return 'Corrente Geral';
  if (tel.length >= 8) return tel.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '($2) $3-$4');
  return tel || 'Destinatário';
}

function WaLiveDot({ active, className }: { active: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} aria-hidden>
      {active ? <span className="wa-live-dot__halo absolute inset-0 rounded-full bg-emerald-500/60" /> : null}
      <span className={cn('relative h-full w-full rounded-full', active ? 'bg-emerald-500' : 'bg-gray-500')} />
    </span>
  );
}

interface SettingsWhatsAppPanelProps {
  initialView?: 'automacoes' | 'teste' | 'historico';
}

export function SettingsWhatsAppPanel({ initialView }: SettingsWhatsAppPanelProps = {}) {
  const [waView, setWaView] = useState<'automacoes' | 'teste' | 'historico'>(() => {
    if (initialView) return initialView;
    const requested = typeof window !== 'undefined' ? sessionStorage.getItem('axecloud:whatsapp-view') : null;
    return requested === 'historico' || requested === 'teste' ? requested : 'automacoes';
  });
  const [connected, setConnected] = useState(false);
  const [channelMessage, setChannelMessage] = useState('');
  const [preferences, setPreferences] = useState<WaPreferences>(DEFAULT_PREFS);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [logs, setLogs] = useState<WaLogUi[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logFilter, setLogFilter] = useState<'todos' | 'falhas' | WaLogTipo>('todos');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const prefsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    sessionStorage.removeItem('axecloud:whatsapp-view');
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) return refreshed.session.access_token;
    throw new Error('Sessão expirada. Faça login novamente.');
  };

  const getSessionUserId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.user?.id) return refreshed.session.user.id;
    throw new Error('Sessão expirada.');
  };

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl(`/whatsapp/logs?limit=${LOG_FETCH_LIMIT}`), {
        headers: whatsappRailwayAuthHeaders(token, userId),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data.error || 'Não foi possível carregar o histórico.'));
      const rows = Array.isArray(data.logs) ? data.logs : [];
      setLogs(
        rows.map((row: Record<string, unknown>) => {
          const tipo = mapLogTipo(String(row.tipo || ''));
          const st = String(row.status || 'sent').toLowerCase();
          return {
            id: String(row.id),
            destino: String(row.destinatario_nome || '').trim() || logDestino(String(row.telefone || ''), tipo),
            telefone: logDestino(String(row.telefone || ''), tipo),
            mensagem: String(row.mensagem || ''),
            data: formatLogDate(String(row.created_at || '')),
            tipo,
            status:
              st === 'failed' || st === 'falha'
                ? 'Falha'
                : st === 'partial'
                  ? 'Parcial'
                  : st === 'delivered' || st === 'entregue'
                    ? 'Entregue'
                    : st === 'read' || st === 'lido'
                      ? 'Lido'
                      : 'Aceito pela Meta',
          };
        }),
      );
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl('/whatsapp/config'), {
        headers: whatsappRailwayAuthHeaders(token, userId),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (data.preferences) {
        setPreferences({ ...DEFAULT_PREFS, ...data.preferences });
      }
    } catch {
      /* silencioso */
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl('/whatsapp/status'), {
        headers: whatsappRailwayAuthHeaders(token, userId),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const st = String(data.status || '').toUpperCase();
      const isConn = st === 'CONNECTED';
      setConnected(isConn);
      setChannelMessage(String(data.message || ''));
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadLogs();
    void checkStatus();
    const id = window.setInterval(() => {
      void checkStatus();
      void loadLogs();
    }, 15000);
    return () => window.clearInterval(id);
  }, [checkStatus, loadConfig, loadLogs]);

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'todos') return true;
    if (logFilter === 'falhas') return log.status === 'Falha' || log.status === 'Parcial';
    return log.tipo === logFilter;
  });
  const visibleLogs = filteredLogs.slice(0, MAX_VISIBLE_LOGS);
  const hiddenLogsCount = Math.max(filteredLogs.length - visibleLogs.length, 0);
  const failedLogsCount = logs.filter((log) => log.status === 'Falha' || log.status === 'Parcial').length;
  const deliveredLogsCount = logs.filter((log) => log.status === 'Entregue' || log.status === 'Lido').length;
  const readLogsCount = logs.filter((log) => log.status === 'Lido').length;
  const enabledAutomations = Object.values(preferences).filter(Boolean).length;

  const persistPreferences = (next: WaPreferences) => {
    if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current);
    prefsSaveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const token = await getAccessToken();
          const userId = await getSessionUserId();
          await fetch(whatsappApiUrl('/whatsapp/config'), {
            method: 'POST',
            headers: whatsappRailwayHeaders(token, userId),
            body: whatsappRailwayJsonBody(userId, { preferences: next }),
          });
        } catch {
          /* silencioso */
        }
      })();
    }, 400);
  };

  const togglePref = (key: keyof WaPreferences, label: string) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    persistPreferences(next);
    notify(`Gatilho de ${label} ${next[key] ? 'ativado' : 'desativado'}!`, 'info');
  };

  const handleTestToPhone = async () => {
    if (!connected) {
      notify('Canal oficial indisponível no momento. Tente novamente em instantes.', 'error');
      return;
    }
    const digits = testPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      notify('Informe um celular válido com DDD (ex.: 11999999999).', 'error');
      return;
    }
    setSendingTest(true);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl('/whatsapp/test-message'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId, { phone: digits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data.error || 'Falha no envio de teste'));
      }
      notify(
        'Mensagem de teste enviada! Verifique o WhatsApp do número informado — ela chega pelo canal oficial AxéCloud.',
        'success',
      );
      void loadLogs();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Erro ao enviar teste', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const prefCards: { key: keyof WaPreferences; title: string; desc: string; toastLabel: string }[] = [
    {
      key: 'notifGiras',
      title: 'Notificação de Gira',
      desc: 'Envia convocação litúrgica aos médiuns quando novas giras forem agendadas.',
      toastLabel: 'Giras',
    },
    {
      key: 'notifFinanceiro',
      title: 'Comprovantes Financeiros',
      desc: 'No dia 1 avisa que a mensalidade está disponível; lembrete semanal se pendente; no vencimento avisa que vence naquele dia. Também envia comprovante quando o pagamento é confirmado.',
      toastLabel: 'Financeiro',
    },
    {
      key: 'notifReza',
      title: 'Altar Virtual (Pedidos de Reza)',
      desc: 'Avisa o zelador quando chegar pedido novo e confirma ao fiel no WhatsApp ao aceitar (reza na próxima gira).',
      toastLabel: 'Altar Virtual',
    },
    {
      key: 'notifAniversarios',
      title: 'Parabéns & Recados Gerais',
      desc: 'Disparos festivos automáticos aos filhos aniversariantes do dia na corrente de fé.',
      toastLabel: 'Mensagens de Confraternização',
    },
  ];

  return (
    <div className="wa-settings-panel space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-3 py-2 text-xs font-bold ${
            toast.type === 'error'
              ? 'border-red-500/30 bg-red-950/30 text-red-300'
              : toast.type === 'info'
                ? 'border-blue-500/30 bg-blue-950/30 text-blue-300'
                : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      <section className="wa-identity-hero relative overflow-hidden rounded-[1.75rem] border border-emerald-400/20 bg-[#071A13] p-5 text-[#F8FAFC] shadow-[0_24px_58px_-34px_rgba(5,150,105,0.75)] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-emerald-300/10 bg-emerald-400/[0.05]" />
        <div className="pointer-events-none absolute -right-4 -top-8 h-32 w-32 rounded-full border border-emerald-300/10" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)] lg:items-end">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-[#052E20] shadow-lg shadow-emerald-950/40">
              <MessageSquare className="h-7 w-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5EEBA5]">Central de comunicação</p>
              <h3 className="mt-1 font-display text-2xl font-black tracking-tight text-white">WhatsApp AxéCloud</h3>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-emerald-50/65">
                Automações, testes e rastreamento dos avisos oficiais da sua casa em um só canal.
              </p>
              <span
                className={cn(
                  'mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider',
                  connected
                    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
                    : 'border-amber-300/20 bg-amber-300/10 text-amber-200',
                )}
              >
                <WaLiveDot active={connected} className="h-2 w-2" />
                {connected ? 'Canal oficial ativo' : 'Canal inicializando'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="border-r border-white/10 p-3">
              <Zap className="h-4 w-4 text-amber-300" aria-hidden />
              <p className="mt-2 text-lg font-black text-white">{enabledAutomations}/4</p>
              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-50/50">automações</p>
            </div>
            <div className="border-r border-white/10 p-3">
              <Clock3 className="h-4 w-4 text-sky-300" aria-hidden />
              <p className="mt-2 text-lg font-black text-white">{logs.length}</p>
              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-50/50">registros</p>
            </div>
            <div className="p-3">
              <Radio className="h-4 w-4 text-[#5EEBA5]" aria-hidden />
              <p className="mt-2 text-sm font-black text-white">Meta</p>
              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-50/50">API oficial</p>
            </div>
          </div>
        </div>
      </section>

      <div className="wa-view-tabs flex gap-1 overflow-x-auto rounded-2xl border border-[#252C35] bg-[#11151A] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Áreas do WhatsApp">
        {[
          { id: 'automacoes' as const, label: 'Automações', icon: Zap },
          { id: 'teste' as const, label: 'Testar envio', icon: Send },
          { id: 'historico' as const, label: 'Histórico', icon: Clock3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={waView === id}
            aria-controls={`wa-panel-${id}`}
            onClick={() => {
              setWaView(id);
              if (id === 'historico') void loadLogs();
            }}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black transition',
              waView === id
                ? 'bg-[#25D366] text-[#052E20] shadow-sm'
                : 'border border-[#303844] bg-[#171C22] text-[#94A3B8] hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div id={`wa-panel-${waView}`} role="tabpanel" className="wa-settings-panel__layout grid min-w-0 grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className={cn('min-w-0 space-y-6', waView === 'historico' ? 'hidden' : 'lg:col-span-12')}>
          {waView !== 'historico' ? (
          <div className="wa-settings-panel__card relative overflow-hidden rounded-2xl border-2 border-[#D8D0C4] bg-white p-5 shadow-xs">
            <h6 className="relative mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#14532D]">
              <Shield className="h-4 w-4 text-[#14532D]" />
              Canal oficial AxéCloud
            </h6>

            <div className="relative space-y-4">
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border-2 border-emerald-600/30 bg-[#F0F7F2] p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[#166534] p-3 text-white shadow-sm">
                    <Wifi className={cn('h-5 w-5', !connected && 'opacity-50')} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#15803D]">
                      {connected ? 'Status: Ativo & Operante' : 'Status: Inicializando'}
                    </span>
                    <h6 className="text-sm font-black text-[#143823]">WhatsApp Business verificado · AxéCloud</h6>
                    <p className="text-xs font-semibold text-[#2C241C]">
                      {channelMessage ||
                        'Canal oficial AxéCloud ativo. Suas notificações serão enviadas pelo número verificado da plataforma.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border-2 border-[#D8D0C4] bg-white p-4 text-xs font-semibold leading-relaxed text-[#1A1612] shadow-xs">
                Não é necessário escanear QR Code ou manter um celular conectado. As mensagens são enviadas pelo canal
                oficial do AxéCloud somente para os contatos da sua casa.
              </div>

              <div className="flex flex-col gap-2 rounded-xl border-2 border-[#D8D0C4] bg-white p-4 text-xs font-bold text-[#1A1612] shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <span>Sincronizando com Giras, Financeiro e Altar Virtual:</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[#15803D]">
                  <WaLiveDot active={connected} className="h-2 w-2" />
                  {connected ? 'Webhook Online' : 'Aguardando canal'}
                </span>
              </div>
            </div>
          </div>
          ) : null}

          {waView === 'automacoes' ? (
          <div className="wa-settings-panel__card overflow-hidden rounded-2xl border-2 border-[#D8D0C4] bg-white p-5 shadow-xs">
            <h6 className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#92400E]">
              <Settings className="h-4 w-4 text-[#92400E]" />
              Avisos automáticos
            </h6>
            <p className="mb-4 text-xs font-semibold leading-relaxed text-[#2A241C]">
              Escolha quais acontecimentos devem gerar mensagens para filhos de santo ou fiéis:
            </p>
            <div className="wa-settings-pref-grid grid min-w-0 grid-cols-1 gap-3.5 md:grid-cols-2">
              {prefCards.map((card) => (
                <div
                  key={card.key}
                  role="button"
                  aria-pressed={preferences[card.key]}
                  tabIndex={0}
                  onClick={() => togglePref(card.key, card.toastLabel)}
                  onKeyDown={(e) => e.key === 'Enter' && togglePref(card.key, card.toastLabel)}
                  className={cn(
                    'wa-settings-pref-card flex min-w-0 cursor-pointer items-start gap-3 overflow-hidden rounded-xl border-2 p-3.5 transition-all shadow-xs',
                    preferences[card.key]
                      ? 'border-[#166534] bg-[#F0F7F2]'
                      : 'border-[#D8D0C4] bg-[#FAF8F5] text-[#2A241C] hover:border-[#166534]/50',
                  )}
                >
                  <span
                    className={cn(
                      'wa-settings-pref-check mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border text-[10px] font-black leading-none',
                      preferences[card.key]
                        ? 'border-[#166534] bg-[#166534] text-white'
                        : 'border-[#948777] bg-white text-transparent',
                    )}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <h6
                      className={cn(
                        'text-xs font-black leading-snug',
                        preferences[card.key] ? 'text-[#143823]' : 'text-[#2A241C]',
                      )}
                    >
                      {card.title}
                    </h6>
                    <p
                      className={cn(
                        'mt-1 break-words text-[11px] font-medium leading-relaxed',
                        preferences[card.key] ? 'text-[#1F2922]' : 'text-[#4A4033]',
                      )}
                    >
                      {card.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          ) : null}

          {waView === 'teste' ? (
          <div className="rounded-2xl border-2 border-[#D8D0C4] bg-white p-5 shadow-xs">
            <h6 className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#14532D]">
              <Send className="h-4 w-4 text-[#14532D]" />
              Testar no seu celular
            </h6>
            <div className="space-y-3">
              <p className="text-xs font-semibold leading-relaxed text-[#2A241C]">
                Envie um teste direto para o número que você informar. A mensagem chega pelo{' '}
                <strong className="font-black text-[#143823]">WhatsApp Business oficial do AxéCloud</strong> (não pelo seu número
                pessoal).
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Seu celular com DDD, ex.: 11999999999"
                  className="w-full rounded-xl border-2 border-[#D8D0C4] bg-white px-3.5 py-2.5 text-xs font-bold text-[#1A1612] placeholder:text-[#6E6456] focus:border-[#166534] focus:outline-none focus:ring-2 focus:ring-[#166534]/20"
                />
                <button
                  type="button"
                  onClick={() => void handleTestToPhone()}
                  disabled={sendingTest || !testPhone.trim()}
                  className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#166534] px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-[#14532D] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                >
                  {sendingTest ? 'Enviando…' : 'Enviar teste'}
                </button>
              </div>
            </div>
          </div>
          ) : null}

          {waView === 'automacoes' ? (
          <div className="rounded-2xl border-2 border-[#D8D0C4] bg-white p-5 shadow-xs">
            <h6 className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#6B21A8]">
              <Send className="h-4 w-4 text-[#6B21A8]" />
              Onde enviar comunicados
            </h6>
            <p className="text-xs font-semibold leading-relaxed text-[#2A241C]">
              Para avisar a corrente via WhatsApp, use o menu <strong className="font-black text-[#143823]">Comunicados</strong>.
              Lá você publica o aviso no app e pode marcar a opção de transmitir automaticamente, com proteção anti-spam integrada.
            </p>
          </div>
          ) : null}
        </div>

        {waView === 'historico' ? (
        <div className="wa-settings-panel__logs wa-history-console flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border-2 border-[#D8D0C4] bg-white p-5 lg:col-span-12 shadow-xs">
          <div className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DDD0] pb-3">
              <div className="flex items-center gap-2">
                <WaLiveDot active className="h-2 w-2" />
                <h6 className="font-display text-sm font-black text-[#143823]">Histórico de envios</h6>
              </div>
              <button type="button" onClick={() => void loadLogs()} disabled={logsLoading} className="inline-flex min-h-9 items-center gap-2 rounded-xl border-2 border-[#166534] bg-[#F0F7F2] px-3.5 text-[10px] font-black uppercase tracking-wider text-[#166534] hover:bg-[#E2EFE5] disabled:cursor-wait disabled:opacity-60 transition-colors">
                <RefreshCw className={cn('h-3.5 w-3.5', logsLoading && 'animate-spin')} />
                {logsLoading ? 'Atualizando' : 'Atualizar'}
              </button>
            </div>

            <p className="text-xs font-semibold text-[#2A241C]">
              Veja quem recebeu, o conteúdo enviado e o resultado informado pelo WhatsApp.
            </p>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'Registrados', value: logs.length, color: 'text-[#143823]' },
                { label: 'Entregues', value: deliveredLogsCount, color: 'text-[#047857]' },
                { label: 'Lidos', value: readLogsCount, color: 'text-[#0369A1]' },
                { label: 'Com falha', value: failedLogsCount, color: failedLogsCount ? 'text-[#B91C1C]' : 'text-[#524A3E]' },
              ].map((metric) => (
                <div key={metric.label} className="rounded-xl border-2 border-[#D8D0C4] bg-[#FAF8F5] p-3.5 shadow-xs">
                  <strong className={cn('block text-2xl font-black', metric.color)}>{metric.value}</strong>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#3D352A]">{metric.label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filtros do histórico">
              {[
                { id: 'todos' as const, label: 'Todos' },
                { id: 'falhas' as const, label: `Falhas${failedLogsCount ? ` (${failedLogsCount})` : ''}` },
                { id: 'financeiro' as const, label: 'Financeiro' },
                { id: 'gira' as const, label: 'Giras' },
                { id: 'acesso' as const, label: 'Acessos' },
                { id: 'transmissao' as const, label: 'Comunicados' },
              ].map((filter) => (
                <button key={filter.id} type="button" onClick={() => setLogFilter(filter.id)} className={cn('min-h-9 shrink-0 rounded-xl border-2 px-3 text-[10px] font-black uppercase tracking-wide transition-all', logFilter === filter.id ? 'border-[#143823] bg-[#143823] text-white shadow-xs' : 'border-[#D8D0C4] bg-[#FAF8F5] text-[#2A241C] hover:border-[#143823] hover:text-[#143823]')}>
                  {filter.label}
                </button>
              ))}
            </div>

            {logsError ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                <span>{logsError}</span>
                <button type="button" onClick={() => void loadLogs()} className="shrink-0 underline font-black">Tentar novamente</button>
              </div>
            ) : null}

            <div className="wa-settings-panel__logs-list max-h-[min(32rem,58dvh)] min-h-[12rem] space-y-2.5 overflow-y-auto overscroll-contain pr-1">
              {logsLoading && logs.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center gap-2 text-xs font-bold text-[#4D4438]"><RefreshCw className="h-4 w-4 animate-spin" /> Carregando envios…</div>
              ) : visibleLogs.length === 0 ? (
                <p className="rounded-xl border-2 border-[#D8D0C4] bg-[#FAF8F5] p-5 text-center text-xs font-bold text-[#4D4438]">
                  {logFilter === 'todos' ? 'Nenhuma transmissão registrada ainda.' : 'Nenhum envio encontrado neste filtro.'}
                </p>
              ) : (
                visibleLogs.map((log) => (
                  <div
                    key={log.id}
                    className="space-y-2 rounded-xl border-2 border-[#D8D0C4] bg-white p-3.5 shadow-xs transition-colors hover:bg-[#FAF8F5]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 max-w-[200px] truncate text-xs font-black text-[#143823]">{log.destino}</span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${BADGE_COLORS[log.tipo]}`}
                        >
                          {BADGE_LABELS[log.tipo]}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] font-bold text-[#4D4438]">{log.data}</span>
                    </div>
                    {log.telefone !== log.destino ? <p className="font-mono text-xs font-bold text-[#2A241C]">{log.telefone}</p> : null}
                    <p className="rounded-xl bg-[#F6F1E8] border border-[#DDD3C4] p-3 text-xs font-semibold leading-relaxed text-[#171410]">
                      &quot;{log.mensagem}&quot;
                    </p>
                    <div className="flex items-center justify-between border-t border-[#E5DDD0] pt-2 text-[10px]">
                      <span className="font-black text-[#3D352A]">Status Gateway:</span>
                      <span
                        className={`flex items-center gap-1 font-black ${
                          log.status === 'Falha'
                            ? 'text-[#B91C1C]'
                            : 'text-[#047857]'
                        }`}
                      >
                        {log.status === 'Falha' ? '✗' : '✓'} {log.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {hiddenLogsCount > 0 ? (
              <p className="rounded-xl border-2 border-[#D8D0C4] bg-[#FAF8F5] px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider text-[#4D4438]">
                +{hiddenLogsCount} registro(s) além do limite desta tela.
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-1.5 rounded-xl border-2 border-[#B7DBC3] bg-[#F0F7F2] p-4 text-xs leading-relaxed text-[#143823]">
            <div className="mb-1 flex items-center gap-1.5 font-black text-[#0F2D1C] text-sm">
              <CheckCircle className="h-4 w-4 text-[#166534]" /> Como testar no AxéCloud:
            </div>
            <p className="font-medium text-[#1F2922]">
              Confira se o canal oficial está ativo. Depois, experimente criar uma nova Gira na aba{' '}
              <strong className="font-black text-[#0F2D1C]">Giras</strong>, registrar um lançamento na aba <strong className="font-black text-[#0F2D1C]">Financeiro</strong> ou aceitar/rezar por um
              pedido na aba <strong className="font-black text-[#0F2D1C]">Pedidos de Reza</strong>. Você verá os envios automáticos e relatórios de fluxo
              surgindo neste painel em tempo real!
            </p>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
