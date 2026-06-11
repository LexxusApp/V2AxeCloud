import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  MessageSquare,
  QrCode,
  Radio,
  Send,
  Settings,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  whatsappApiUrl,
  whatsappRailwayAuthHeaders,
  whatsappRailwayHeaders,
  whatsappRailwayJsonBody,
} from '../../lib/whatsappApiUrl';

type WaLogTipo = 'gira' | 'financeiro' | 'reza' | 'teste';

type WaLogUi = {
  id: string;
  destino: string;
  mensagem: string;
  data: string;
  tipo: WaLogTipo;
  status: 'Enviado' | 'Falha';
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

const DEFAULT_TEST_MSG =
  '⚠️ Comunicado do Terreiro: Salve a Corrente! Lembra-se que hoje nossa sessão inicia às 20:00 com passe e descarrego. Aguardamos todos na curimba!';

const BADGE_COLORS: Record<WaLogTipo, string> = {
  gira: 'bg-emerald-950/40 text-emerald-400 border-emerald-600/10',
  financeiro: 'bg-blue-950/40 text-blue-400 border-blue-600/10',
  reza: 'bg-rose-950/40 text-rose-400 border-rose-600/10',
  teste: 'bg-amber-950/40 text-[#FACC15] border-amber-600/10',
};

function qrImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const s = String(src).trim();
  if (!s) return null;
  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
  return `data:image/png;base64,${s}`;
}

function mapLogTipo(raw: string | null | undefined): WaLogTipo {
  const t = String(raw || '').toLowerCase();
  if (t.includes('gira') || t.includes('convite') || t.includes('evento')) return 'gira';
  if (t.includes('financ') || t.includes('mensal') || t.includes('cobran')) return 'financeiro';
  if (t.includes('reza') || t.includes('altar') || t.includes('vela')) return 'reza';
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
  if (tel === 'corrente_geral' || tipo === 'teste') return 'Corrente Geral';
  if (tel.length >= 8) return tel.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '($2) $3-$4');
  return tel || 'Destinatário';
}

export function SettingsWhatsAppPanel() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState('(11) 99999-8888');
  const [preferences, setPreferences] = useState<WaPreferences>(DEFAULT_PREFS);
  const [testMessage, setTestMessage] = useState(DEFAULT_TEST_MSG);
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
            status: st === 'failed' || st === 'falha' ? 'Falha' : 'Enviado',
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
      if (data.phoneNumber) {
        const digits = String(data.phoneNumber).replace(/\D/g, '');
        if (digits.length >= 10) {
          setPhone(
            digits.length === 11
              ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
              : String(data.phoneNumber),
          );
        }
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
      if (isConn) {
        setShowQr(false);
        setQrCode(null);
        setConnecting(false);
      } else if (data.qrcode) {
        const qr = qrImageSrc(data.qrcode);
        if (qr) {
          setQrCode(qr);
          setShowQr(true);
        }
      }
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

  const handleGenerateQr = async () => {
    setConnecting(true);
    setShowQr(false);
    setQrCode(null);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl('/connect'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId, { mode: 'qrcode' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data.error || 'Falha ao gerar QR Code'));
      }
      const qr = qrImageSrc(typeof data.qrcode === 'string' ? data.qrcode : null);
      if (qr) {
        setQrCode(qr);
        setShowQr(true);
        notify('QR Code de emparelhamento gerado com sucesso!', 'info');
      } else {
        notify('Gerando canais criptografados de sincronização…', 'info');
        setShowQr(true);
      }
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Erro ao conectar WhatsApp', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      await fetch(whatsappApiUrl('/whatsapp/logout'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId),
      });
      setConnected(false);
      setShowQr(false);
      setQrCode(null);
      notify('WhatsApp do Zelador desconectado com sucesso.', 'info');
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Erro ao desconectar', 'error');
    }
  };

  const handleBroadcast = async () => {
    if (!connected) {
      notify('Não foi possível enviar: WhatsApp desconectado. Conecte no Passo 1 antes de transmitir.', 'error');
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
      setTestMessage('');
      notify(`Mensagem de teste transmitida com sucesso para ${destino}!`, 'success');
      void loadLogs();
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
      desc: 'Envia aviso de firmeza de vela e oração iniciada aos devotos que efetuarem preces.',
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
    <div className="animate-fadeIn space-y-6">
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
            Conecte o seu número para automatizar o envio de notificações, cobranças de mensalidades e avisos de giras
            para os filhos de santo da corrente.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${
              connected
                ? 'border-[#10B981]/20 bg-emerald-950/20 text-[#10B981]'
                : 'border-[#1E242B] bg-[#1E252E] text-[#94A3B8]'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-ping bg-emerald-500' : 'bg-gray-500'}`} />
            {connected ? 'Dispositivo Conectado' : 'Aparelho Desconectado'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="relative overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] p-5">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#10B981]/5 blur-xl filter" />

            <h6 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Smartphone className="h-4 w-4" />
              1. Conexão do Celular (Zelador)
            </h6>

            {!connected ? (
              <div className="space-y-4">
                <div className="space-y-2.5 rounded-xl border border-[#1E242B] bg-[#12161A]/80 p-4">
                  <p className="text-[11px] leading-relaxed text-[#94A3B8]">
                    Siga as instruções abaixo para vincular o WhatsApp oficial do Terreiro à plataforma Axé Cloud:
                  </p>
                  <ol className="ml-1 list-inside list-decimal space-y-1.5 text-xs font-light text-gray-300">
                    <li>Abra o WhatsApp no seu smartphone.</li>
                    <li>
                      Vá em <strong className="text-white">Aparelhos Conectados</strong> no menu de configurações.
                    </li>
                    <li>
                      Selecione <strong className="text-[#10B981]">Conectar um aparelho</strong> e aponte para o QR
                      Code.
                    </li>
                  </ol>
                </div>

                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  {!showQr && !connecting ? (
                    <button
                      type="button"
                      onClick={() => void handleGenerateQr()}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#10B981]/10 transition-all hover:bg-[#059669] sm:w-auto"
                    >
                      <QrCode className="h-4 w-4" />
                      Gerar QR Code de Integração
                    </button>
                  ) : connecting ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-emerald-950/20 px-4 py-2.5 text-xs font-bold text-emerald-400">
                      <svg className="h-4 w-4 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Gerando canais criptografados de sincronização...
                    </div>
                  ) : (
                    <div className="animate-fadeIn flex w-full flex-col items-center justify-center space-y-4 rounded-xl border border-[#1E242B] bg-[#12161A] p-5">
                      <div className="relative overflow-hidden rounded-lg border-2 border-emerald-500 bg-white p-3 shadow-lg">
                        {qrCode ? (
                          <img src={qrCode} alt="QR Code WhatsApp" className="h-40 w-40 object-contain" />
                        ) : (
                          <>
                            <div className="grid h-40 w-40 grid-cols-4 gap-1 bg-zinc-100 p-1 opacity-90">
                              {Array.from({ length: 16 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`rounded-sm ${(i * 7 + 3) % 2 === 0 ? 'bg-zinc-900' : 'bg-transparent'} ${i === 0 || i === 3 || i === 12 ? 'border-4 border-zinc-900 bg-transparent' : ''}`}
                                />
                              ))}
                            </div>
                            <div className="pointer-events-none absolute inset-0 flex animate-pulse items-center justify-center bg-emerald-500/10">
                              <QrCode className="h-12 w-12 text-[#10B981]" />
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-1 text-center">
                        <span className="block text-[8.5px] font-black uppercase tracking-widest text-amber-500">
                          Sincronização Ativa
                        </span>
                        <p className="text-[10px] text-gray-400">QR Code expira em 3 minutos. Escaneie-o no celular.</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowQr(false);
                          setQrCode(null);
                        }}
                        className="cursor-pointer rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-bold text-gray-400 transition-colors hover:bg-white/5"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn space-y-4">
                <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-emerald-500/15 bg-emerald-950/10 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-600 p-3 text-white">
                      <Wifi className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="mb-1 block text-[9.5px] font-black uppercase tracking-wide text-emerald-400">
                        Status: Ativo & Operante
                      </span>
                      <h6 className="text-sm font-bold text-[#F1F5F9]">
                        {phone} (Zelador)
                      </h6>
                      <p className="text-[9.5px] text-gray-400">
                        Vínculo Webhook API • Signal 100% • Bateria: 94% • Versão Node-WS: 2.34.1
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDisconnect()}
                    className="cursor-pointer self-stretch rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-2 text-xs font-bold text-rose-400 transition-all hover:bg-rose-900/30 sm:self-auto"
                  >
                    Desconectar Aparelho
                  </button>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-3 text-xs text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between">
                  <span>Sincronizando com Giras, Financeiro e Altar Virtual em tempo de execução:</span>
                  <span className="flex shrink-0 items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                    <Radio className="h-3 w-3 shrink-0 animate-ping" /> Webhook Online
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-5">
            <h6 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
              <Settings className="h-4 w-4" />
              2. Filhos de Santo & Fiel: Preferências de Gatilho
            </h6>
            <p className="mb-4 text-xs font-light leading-relaxed text-gray-400">
              Escolha quais acontecimentos administrativos ou religiosos gerarão mensagens automáticas enviadas para os
              respectivos celulares dos filhos de santo ou fiéis:
            </p>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {prefCards.map((card) => (
                <div
                  key={card.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePref(card.key, card.toastLabel)}
                  onKeyDown={(e) => e.key === 'Enter' && togglePref(card.key, card.toastLabel)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                    preferences[card.key]
                      ? 'border-emerald-500/30 bg-[#1E252E]'
                      : 'border-[#1E242B] bg-[#0F1216] opacity-60'
                  }`}
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
              3. Testar Transmissão Direta (Médiuns)
            </h6>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                  Mensagem de Comunicado Geral da Casa
                </label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Redija uma mensagem rápida para testar a comunicação com todos os filhos de santo cadastrados na corrente."
                  className="w-full resize-none rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 text-xs leading-relaxed text-[#F1F5F9] placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleBroadcast()}
                disabled={broadcasting}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold transition-all ${
                  connected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10 hover:bg-emerald-500'
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
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
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
                    className="animate-fadeIn space-y-2 rounded-xl border border-[#1E242B] bg-[#12161A] p-3 transition-colors hover:bg-[#1E242B]/20"
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
