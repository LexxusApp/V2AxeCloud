import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  MessageSquare,
  Send,
  Settings,
  Shield,
  Wifi,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import {
  whatsappApiUrl,
  whatsappRailwayAuthHeaders,
  whatsappRailwayHeaders,
  whatsappRailwayJsonBody,
} from '../../lib/whatsappApiUrl';

type WaLogTipo = 'gira' | 'financeiro' | 'reza' | 'broadcast' | 'teste';

type WaLogUi = {
  id: string;
  destino: string;
  mensagem: string;
  data: string;
  tipo: WaLogTipo;
  status: 'Enviado' | 'Falha' | 'Parcial';
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

const DEFAULT_TEST_MSG = '';

function buildComunicadoPreview(text: string, nomeTerreiro: string, zelador: string): string {
  const msg = text.trim();
  const casa = nomeTerreiro.trim() || 'Terreiro';
  const lider = zelador.trim();
  const assinatura = lider ? `— ${lider} · ${casa}` : `— ${casa}`;
  if (!msg) return assinatura;
  return `${msg}\n\n${assinatura}`;
}

const BADGE_COLORS: Record<WaLogTipo, string> = {
  gira: 'bg-emerald-950/40 text-emerald-400 border-emerald-600/10',
  financeiro: 'bg-blue-950/40 text-blue-400 border-blue-600/10',
  reza: 'bg-rose-950/40 text-rose-400 border-rose-600/10',
  teste: 'bg-amber-950/40 text-[#FACC15] border-amber-600/10',
  broadcast: 'bg-violet-950/40 text-violet-300 border-violet-600/10',
};

function mapLogTipo(raw: string | null | undefined): WaLogTipo {
  const t = String(raw || '').toLowerCase();
  if (t.includes('gira') || t.includes('convite') || t.includes('evento')) return 'gira';
  if (t.includes('financ') || t.includes('mensal') || t.includes('cobran')) return 'financeiro';
  if (t.includes('reza') || t.includes('altar') || t.includes('vela')) return 'reza';
  if (t === 'broadcast') return 'broadcast';
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

export function SettingsWhatsAppPanel() {
  const [connected, setConnected] = useState(false);
  const [channelMessage, setChannelMessage] = useState('');
  const [preferences, setPreferences] = useState<WaPreferences>(DEFAULT_PREFS);
  const [testMessage, setTestMessage] = useState(DEFAULT_TEST_MSG);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [correnteCount, setCorrenteCount] = useState<number | null>(null);
  const [nomeTerreiro, setNomeTerreiro] = useState('');
  const [zeladorNome, setZeladorNome] = useState('');
  const [logs, setLogs] = useState<WaLogUi[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const prefsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
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
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl('/whatsapp/logs'), {
        headers: whatsappRailwayAuthHeaders(token, userId),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const rows = Array.isArray(data.logs) ? data.logs : [];
      setLogs(
        rows.map((row: Record<string, unknown>) => {
          const tipo = mapLogTipo(String(row.tipo || ''));
          const st = String(row.status || 'sent').toLowerCase();
          return {
            id: String(row.id),
            destino: logDestino(String(row.telefone || ''), tipo),
            mensagem: String(row.mensagem || ''),
            data: formatLogDate(String(row.created_at || '')),
            tipo,
            status:
              st === 'failed' || st === 'falha'
                ? 'Falha'
                : st === 'partial'
                  ? 'Parcial'
                  : 'Enviado',
          };
        }),
      );
    } catch {
      /* silencioso */
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

  const loadCorrenteCount = useCallback(async () => {
    try {
      const userId = await getSessionUserId();
      const { data, error } = await supabase
        .from('filhos_de_santo')
        .select('id, whatsapp_phone, status')
        .or(`tenant_id.eq.${userId},lider_id.eq.${userId}`)
        .not('whatsapp_phone', 'is', null);
      if (error) return;
      const seen = new Set<string>();
      const total = (data || []).filter((f) => {
        const st = String(f.status || 'Ativo').trim().toLowerCase();
        if (st === 'inativo' || st === 'desligado' || st === 'falecido') return false;
        const phone = String(f.whatsapp_phone || '').replace(/\D/g, '');
        if (phone.length < 10) return false;
        if (seen.has(phone)) return false;
        seen.add(phone);
        return true;
      }).length;
      setCorrenteCount(total);
    } catch {
      /* silencioso */
    }
  }, []);

  const loadTerreiroContext = useCallback(async () => {
    try {
      const userId = await getSessionUserId();
      const { data, error } = await supabase
        .from('perfil_lider')
        .select('nome_terreiro, cargo')
        .eq('id', userId)
        .maybeSingle();
      if (error) return;
      setNomeTerreiro(String(data?.nome_terreiro || '').trim());
      setZeladorNome(String(data?.cargo || '').trim());
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadLogs();
    void loadCorrenteCount();
    void loadTerreiroContext();
    void checkStatus();
    const id = window.setInterval(() => {
      void checkStatus();
      void loadLogs();
      void loadCorrenteCount();
    }, 15000);
    return () => window.clearInterval(id);
  }, [checkStatus, loadConfig, loadCorrenteCount, loadLogs, loadTerreiroContext]);

  const messagePreview = buildComunicadoPreview(testMessage, nomeTerreiro, zeladorNome);

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
      void loadCorrenteCount();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Erro ao enviar teste', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const handleBroadcast = async () => {
    if (!connected) {
      notify('Canal oficial indisponível no momento. Tente novamente em instantes.', 'error');
      return;
    }
    if (!testMessage.trim()) {
      notify('Por favor, digite alguma mensagem para poder testar o disparo.', 'error');
      return;
    }
    setBroadcasting(true);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl('/whatsapp/broadcast'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId, { message: testMessage.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data.error || 'Falha na transmissão'));
      }
      const destino = String(data.destino || 'Corrente Geral');
      const sent = Number(data.sent ?? 0);
      const failed = Number(data.failed ?? 0);
      const total = Number(data.total ?? 0);
      setTestMessage('');
      if (failed > 0) {
        notify(`Transmitido para ${sent} de ${total} médiuns (${failed} falha(s)). Confira os logs ao lado.`, 'info');
      } else {
        notify(`Mensagem transmitida para ${sent || total} filho(s) com WhatsApp cadastrado (${destino}).`, 'success');
      }
      void loadLogs();
      void loadCorrenteCount();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Erro ao transmitir', 'error');
    } finally {
      setBroadcasting(false);
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
      desc: 'Envia lembretes e comprovantes assim que mensalidades dos médiuns forem compensadas.',
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

      <div className="flex flex-col gap-4 border-b border-[#1E242B] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="flex items-center gap-2 font-display text-lg font-bold text-[#F1F5F9]">
            <MessageSquare className="h-5 w-5 text-[#10B981]" />
            Integração & Configuração do WhatsApp
          </h5>
          <p className="text-xs text-[#94A3B8]">
            Notificações automáticas para filhos de santo saem pelo WhatsApp Business oficial do AxéCloud, com o nome
            do membro e do seu terreiro em cada mensagem.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase ${
                connected
                  ? 'border-[#10B981]/20 bg-emerald-950/20 text-[#10B981]'
                  : 'border-[#1E242B] bg-[#1E252E] text-[#94A3B8]'
              }`}
            >
              <WaLiveDot active={connected} className="h-2 w-2" />
            {connected ? 'Canal Oficial Ativo' : 'Canal Indisponível'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="wa-settings-panel__card relative rounded-2xl border border-[#1E242B] bg-[#13171D] p-5">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#10B981]/10" aria-hidden />

            <h6 className="relative mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Shield className="h-4 w-4" />
              1. Canal Oficial AxéCloud (Meta Cloud API)
            </h6>

            <div className="relative space-y-4">
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-emerald-500/15 bg-emerald-950/10 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-600 p-3 text-white">
                    <Wifi className={cn('h-5 w-5', !connected && 'opacity-50')} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="mb-1 block text-[9.5px] font-black uppercase tracking-wide text-emerald-400">
                      {connected ? 'Status: Ativo & Operante' : 'Status: Inicializando'}
                    </span>
                    <h6 className="text-sm font-bold text-[#F1F5F9]">WhatsApp Business verificado — AxéCloud</h6>
                    <p className="text-[9.5px] text-gray-400">
                      {channelMessage ||
                        'Template Meta aviso_geral_axecloud (boas-vindas): {{1}} = membro, {{2}} = AxéCloud. Login em /login com ID + CPF.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#1E242B] bg-[#12161A] p-3 text-xs leading-relaxed text-[#94A3B8]">
                Não é necessário escanear QR Code nem parear celular. Cada terreiro envia apenas para os próprios
                filhos de santo — o isolamento é garantido pelo cadastro no Supabase.
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-3 text-xs text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between">
                <span>Sincronizando com Giras, Financeiro e Altar Virtual:</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                  <WaLiveDot active={connected} className="h-2 w-2" />
                  {connected ? 'Webhook Online' : 'Aguardando canal'}
                </span>
              </div>
            </div>
          </div>

          <div className="wa-settings-panel__card rounded-2xl border border-[#1E242B] bg-[#13171D] p-5">
            <h6 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
              <Settings className="h-4 w-4" />
              2. Filhos de Santo & Fiel: Preferências de Gatilho
            </h6>
            <p className="mb-4 text-xs font-light leading-relaxed text-gray-400">
              Escolha quais acontecimentos administrativos ou religiosos gerarão mensagens automáticas enviadas para os
              respectivos celulares dos filhos de santo ou fiéis:
            </p>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {prefCards.map((card) => (
                <div
                  key={card.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePref(card.key, card.toastLabel)}
                  onKeyDown={(e) => e.key === 'Enter' && togglePref(card.key, card.toastLabel)}
                  className={cn(
                    'wa-settings-pref-card flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                    preferences[card.key]
                      ? 'border-emerald-500/30 bg-[#1E252E]'
                      : 'border-[#1E242B] bg-[#0F1216] opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={preferences[card.key]}
                    readOnly
                    className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded accent-emerald-500"
                  />
                  <div>
                    <h6 className="text-xs font-bold text-[#F1F5F9]">{card.title}</h6>
                    <p className="mt-1 text-[10px] leading-snug text-gray-400">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-5">
            <h6 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Send className="h-4 w-4" />
              3. Testar no seu celular
            </h6>
            <div className="space-y-3">
              <p className="text-[11px] leading-relaxed text-gray-400">
                Envie um teste direto para o número que você informar. A mensagem chega pelo{' '}
                <strong className="text-gray-300">WhatsApp Business oficial do AxéCloud</strong> (não pelo seu número
                pessoal).
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Seu celular com DDD — ex.: 11999999999"
                  className="w-full rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs text-[#F1F5F9] placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                />
                <button
                  type="button"
                  onClick={() => void handleTestToPhone()}
                  disabled={sendingTest || !testPhone.trim()}
                  className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingTest ? 'Enviando…' : 'Enviar teste'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-5">
            <h6 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-400">
              <Send className="h-4 w-4" />
              4. Transmissão para a Corrente
            </h6>
            <div className="space-y-4">
              <p className="text-[11px] leading-relaxed text-gray-400">
                Escreva o comunicado livremente — o filho recebe exatamente o que você digitar, com uma{' '}
                <strong className="text-gray-300">assinatura automática da casa</strong> no final.
                Dispara para cada filho com WhatsApp cadastrado na Corrente (não inclui o zelador automaticamente).
                {correnteCount !== null && correnteCount > 0 ? (
                  <span className="mt-1 block text-violet-300">
                    Destinatários únicos agora: {correnteCount} número(s) com WhatsApp cadastrado.
                  </span>
                ) : null}
                {correnteCount === 0 ? (
                  <span className="mt-1 block text-amber-300">
                    Nenhum filho com WhatsApp válido cadastrado — cadastre um número na Corrente para habilitar o
                    disparo.
                  </span>
                ) : null}
              </p>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                  Mensagem de Comunicado Geral da Casa
                </label>
                <textarea
                  rows={4}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Digite aqui o comunicado da casa — texto livre, sem modelo fixo."
                  className="w-full resize-none rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs leading-relaxed text-[#F1F5F9] placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                />
              </div>
              <div className="rounded-lg border border-violet-500/15 bg-violet-950/20 p-3">
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-violet-300">
                  Prévia do que o filho receberá
                </p>
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-300">{messagePreview}</p>
                <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
                  A assinatura aparece na prévia para você conferir. No WhatsApp, o template da Meta já identifica o
                  terreiro no cabeçalho — evite disparar várias vezes seguidas para o mesmo número.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleBroadcast()}
                disabled={broadcasting || !connected || !testMessage.trim() || correnteCount === 0}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold transition-colors ${
                  connected && correnteCount !== 0
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
                    : 'cursor-not-allowed border border-[#1E242B]/85 bg-[#12161A] text-gray-500 hover:bg-[#12161A]'
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                {broadcasting ? 'Transmitindo…' : 'Disparar Mensagem para a Corrente (Grupo)'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 lg:col-span-5">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#1E242B] pb-3">
              <div className="flex items-center gap-2">
                <WaLiveDot active className="h-1.5 w-1.5" />
                <h6 className="font-display text-sm font-bold text-[#F1F5F9]">Painel de Transmissões Recentes</h6>
              </div>
              <span className="rounded border border-emerald-500/20 bg-[#12161A] px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-[#10B981]">
                Logs Dinâmicos
              </span>
            </div>

            <p className="text-[11px] font-light text-gray-400">
              Abaixo você confere o monitoramento das mensagens de trânsito enviadas pelo webhook do terreiro em tempo
              de execução:
            </p>

            <div className="max-h-[350px] space-y-3 overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <p className="rounded-xl border border-[#1E242B] bg-[#12161A] p-4 text-center text-[10px] text-gray-500">
                  Nenhuma transmissão registrada ainda. Conecte o WhatsApp e envie a primeira mensagem.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="space-y-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-3 transition-colors hover:bg-[#1E242B]/20"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="max-w-[124px] truncate text-[10px] font-bold text-white">{log.destino}</span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase ${BADGE_COLORS[log.tipo]}`}
                        >
                          {log.tipo}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[8px] text-gray-500">{log.data}</span>
                    </div>
                    <p className="rounded bg-black/15 p-2 text-[10.5px] italic leading-relaxed text-gray-300">
                      &quot;{log.mensagem}&quot;
                    </p>
                    <div className="flex items-center justify-between border-t border-[#1E242B]/80 pt-1 text-[8.5px]">
                      <span className="font-bold text-gray-500">Status Gateway:</span>
                      <span
                        className={`flex items-center gap-0.5 font-bold ${log.status === 'Enviado' ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {log.status === 'Enviado' ? '✓' : '✗'} {log.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 space-y-1.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3 text-[10px] leading-relaxed text-gray-400">
            <div className="mb-1 flex items-center gap-1 font-bold text-[#F1F5F9]">
              <CheckCircle className="h-3.5 w-3.5 text-[#10B981]" /> Como testar no AxéCloud:
            </div>
            <p>
              Conecte o WhatsApp no <strong>Passo 1</strong> acima. Depois, experimente criar uma nova Gira na aba{' '}
              <strong>Giras</strong>, registrar um lançamento na aba <strong>Financeiro</strong> ou aceitar/rezar por um
              pedido na aba <strong>Pedidos de Reza</strong>. Você verá os envios automáticos e relatórios de fluxo
              surgindo neste painel em tempo real!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
