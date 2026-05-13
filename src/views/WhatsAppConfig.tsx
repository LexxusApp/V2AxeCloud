import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Smartphone, Shield, AlertCircle, Loader2, CheckCircle2, Save, RotateCcw, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  whatsappApiUrl,
  whatsappRailwayAuthHeaders,
  whatsappRailwayHeaders,
  whatsappRailwayJsonBody,
} from '../lib/whatsappApiUrl';
import {
  WHATSAPP_TEMPLATE_DEFAULTS,
  WHATSAPP_TEMPLATE_ORDER,
  type WhatsAppTemplateType,
} from '../constants/whatsappTemplates';

const WHATSAPP_INIT_FALLBACK =
  'O serviço de mensageria está inicializando ou temporariamente indisponível. Aguarde um instante e tente novamente.';

function isWhatsappServiceWarmingPayload(data: unknown, httpStatus: number): boolean {
  const code = data && typeof data === 'object' && 'code' in data ? String((data as { code?: string }).code) : '';
  if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
    if (code === 'WHATSAPP_INITIALIZING' || code === 'WHATSAPP_PROXY_FAILED') {
      return true;
    }
    const hasErrorField =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string';
    if (!hasErrorField && !code) return true;
  }
  return false;
}

function isBadGatewayOrTimeout(httpStatus: number): boolean {
  return httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
}

type WaStatus = 'DISCONNECTED' | 'LOADING' | 'PAIRING' | 'CONNECTED';

function formatPairingCode(raw: string): string {
  const compact = String(raw || '').replace(/\s|-/g, '').toUpperCase();
  if (compact.length === 8) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return compact;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export default function WhatsAppConfig() {
  const [status, setStatus] = useState<WaStatus>('DISCONNECTED');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [templates, setTemplates] = useState<Record<WhatsAppTemplateType, string>>(WHATSAPP_TEMPLATE_DEFAULTS);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [templatesSaved, setTemplatesSaved] = useState(false);
  const statusRef = useRef(status);
  const pairingRef = useRef<string | null>(pairingCode);
  const templateMeta: Record<WhatsAppTemplateType, { title: string; hint: string }> = {
    boas_vindas: {
      title: 'Boas-vindas',
      hint: 'Enviada ao cadastrar novo filho.',
    },
    cobranca_mensalidade: {
      title: 'Cobrança de Mensalidade',
      hint: 'Usada no botão de cobrar mensalidade.',
    },
    financeiro: {
      title: 'Financeiro (Lembrete)',
      hint: 'Modelo de lembrete financeiro geral.',
    },
    mural_aviso: {
      title: 'Aviso de Mural',
      hint: 'Disparada ao publicar aviso no mural.',
    },
    convite_evento: {
      title: 'Convite de Evento',
      hint: 'Enviada para convidados de evento.',
    },
    estoque_critico: {
      title: 'Estoque Crítico',
      hint: 'Alerta automático de item em nível crítico.',
    },
  };

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    pairingRef.current = pairingCode;
  }, [pairingCode]);

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
    throw new Error('Sessão expirada. Faça login novamente.');
  };

  // Polling para checar status
  useEffect(() => {
    let intervalId: any;

    const checkStatus = async () => {
      try {
        const token = await getAccessToken();
        const userId = await getSessionUserId();

        const res = await fetch(whatsappApiUrl('/whatsapp/status'), {
          headers: whatsappRailwayAuthHeaders(token, userId),
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) {
            setErrorMsg(
              typeof (data as { error?: string })?.error === 'string'
                ? (data as { error: string }).error
                : 'Sessão expirada. Faça login novamente.',
            );
            setServiceNotice(null);
            return;
          }
          if (isBadGatewayOrTimeout(res.status) || isWhatsappServiceWarmingPayload(data, res.status)) {
            const msg =
              typeof (data as { error?: string })?.error === 'string'
                ? (data as { error: string }).error
                : WHATSAPP_INIT_FALLBACK;
            setServiceNotice(msg);
            setErrorMsg(null);
            if (statusRef.current === 'PAIRING' && pairingRef.current) {
              return;
            }
            setStatus('DISCONNECTED');
            setPairingCode(null);
            return;
          }
          throw new Error(String((data as { error?: string })?.error || `Falha ao consultar status (${res.status})`));
        }

        const nextStatus = String((data as { status?: string })?.status || '').toUpperCase();

        if (nextStatus === 'CONNECTED') {
          setStatus('CONNECTED');
          setPairingCode(null);
        } else if (nextStatus === 'DISCONNECTED' || nextStatus === 'LOADING' || nextStatus === 'QRCODE') {
          // Preserva o código de pareamento exibido até o utilizador concluir ou pedir novo.
          if (statusRef.current === 'PAIRING' && pairingRef.current) {
            setStatus('PAIRING');
          } else {
            setStatus('DISCONNECTED');
            setPairingCode(null);
          }
        } else {
          if (statusRef.current === 'PAIRING' && pairingRef.current) {
            setStatus('PAIRING');
          } else {
            setStatus('DISCONNECTED');
            setPairingCode(null);
          }
        }
        setErrorMsg(null);
        setServiceNotice(null);
      } catch (err) {
        console.error('Erro ao checar status do WhatsApp:', err);
        setServiceNotice(WHATSAPP_INIT_FALLBACK);
        if (statusRef.current === 'PAIRING' && pairingRef.current) {
          return;
        }
        setStatus('DISCONNECTED');
        setPairingCode(null);
        setErrorMsg(null);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const handleStart = async () => {
    const phoneDigits = digitsOnly(phone);
    if (phoneDigits.length < 10) {
      setErrorMsg('Informe o número do celular com DDD (apenas dígitos).');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();

      const res = await fetch(whatsappApiUrl('/connect'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId, { phone: phoneDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : 'Sessão expirada. Faça login novamente.',
          );
          setServiceNotice(null);
          return;
        }
        if (isBadGatewayOrTimeout(res.status) || isWhatsappServiceWarmingPayload(data, res.status)) {
          setServiceNotice(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : WHATSAPP_INIT_FALLBACK,
          );
          setErrorMsg(null);
          setStatus('LOADING');
          return;
        }
        throw new Error(String((data as { error?: string })?.error || `Falha ao iniciar WhatsApp (${res.status})`));
      }
      const msgOk = String((data as { message?: string })?.message || '');
      if (msgOk.includes('já está conectado')) {
        setStatus('CONNECTED');
        setPairingCode(null);
      } else {
        const code =
          typeof (data as { pairingCode?: string })?.pairingCode === 'string'
            ? (data as { pairingCode: string }).pairingCode
            : null;
        if (code) {
          setPairingCode(formatPairingCode(code));
          setStatus('PAIRING');
        } else {
          setStatus('LOADING');
        }
      }
      setServiceNotice(null);
    } catch (err) {
      console.error('Erro ao iniciar WhatsApp:', err);
      setServiceNotice(WHATSAPP_INIT_FALLBACK);
      setStatus('LOADING');
      setErrorMsg(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Deseja realmente desconectar o WhatsApp? Isso limpará sua sessão atual.')) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();

      const res = await fetch(whatsappApiUrl('/whatsapp/logout'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : 'Sessão expirada. Faça login novamente.',
          );
          setServiceNotice(null);
          return;
        }
        if (isBadGatewayOrTimeout(res.status) || isWhatsappServiceWarmingPayload(data, res.status)) {
          setServiceNotice(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : WHATSAPP_INIT_FALLBACK,
          );
          setErrorMsg(null);
          return;
        }
        throw new Error(String((data as { error?: string })?.error || `Falha ao deslogar WhatsApp (${res.status})`));
      }
      setStatus('DISCONNECTED');
      setPairingCode(null);
      setServiceNotice(null);
    } catch (err) {
      console.error('Erro ao deslogar WhatsApp:', err);
      const isNetwork =
        err instanceof TypeError ||
        (err instanceof Error && /network|failed to fetch|load failed|abort/i.test(err.message));
      if (isNetwork) {
        setServiceNotice(WHATSAPP_INIT_FALLBACK);
        setErrorMsg(null);
        return;
      }
      setServiceNotice(null);
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível desconectar o WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone) return;
    
    setSendingTest(true);
    setTestStatus('idle');
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();

      const response = await fetch(whatsappApiUrl('/whatsapp/test-message'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId, { phone: testPhone }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          setErrorMsg(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : 'Sessão expirada. Faça login novamente.',
          );
          setTestStatus('error');
          return;
        }
        if (isBadGatewayOrTimeout(response.status) || isWhatsappServiceWarmingPayload(data, response.status)) {
          setServiceNotice(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : WHATSAPP_INIT_FALLBACK,
          );
          setErrorMsg(null);
          setTestStatus('idle');
          return;
        }
        throw new Error(String((data as { error?: string })?.error || 'Falha no envio'));
      }

      setTestStatus('success');
      setTestPhone('');
    } catch (err) {
      console.error('Erro ao enviar mensagem de teste:', err);
      const isNetwork =
        err instanceof TypeError ||
        (err instanceof Error && /network|failed to fetch|load failed|abort/i.test(err.message));
      if (isNetwork) {
        setServiceNotice(WHATSAPP_INIT_FALLBACK);
        setErrorMsg(null);
        setTestStatus('idle');
        return;
      }
      setTestStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar mensagem de teste.');
    } finally {
      setSendingTest(false);
      setTimeout(() => setTestStatus('idle'), 5000);
    }
  };

  const loadTemplates = async () => {
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const response = await fetch(whatsappApiUrl('/whatsapp/config'), {
        method: 'GET',
        headers: whatsappRailwayAuthHeaders(token, userId),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((data as { error?: string })?.error || 'Falha ao carregar modelos de mensagem.'));
      }
      if ((data as { templates?: unknown })?.templates) {
        setTemplates((data as { templates: Record<WhatsAppTemplateType, string> }).templates);
      }
    } catch (err) {
      console.error('Erro ao carregar templates de WhatsApp:', err);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleTemplateChange = (key: WhatsAppTemplateType, value: string) => {
    setTemplatesSaved(false);
    setTemplates((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetTemplate = (key: WhatsAppTemplateType) => {
    handleTemplateChange(key, WHATSAPP_TEMPLATE_DEFAULTS[key]);
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    setTemplatesSaved(false);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const response = await fetch(whatsappApiUrl('/whatsapp/config'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId, { templates }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((data as { error?: string })?.error || 'Falha ao salvar modelos.'));
      }
      setTemplatesSaved(true);
      setTimeout(() => setTemplatesSaved(false), 3500);
    } catch (err) {
      console.error('Erro ao salvar templates de WhatsApp:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar modelos de mensagem.');
    } finally {
      setSavingTemplates(false);
    }
  };

  return (
    <div className="card-luxury mx-auto w-full max-w-5xl space-y-6 p-5 sm:space-y-8 sm:p-8 lg:p-10">
      <div className="grid gap-4 border-b border-white/5 pb-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-2xl shadow-emerald-500/10 sm:h-20 sm:w-20 sm:rounded-3xl">
          <MessageSquare className="h-8 w-8" />
        </div>
        <div className="min-w-0">
          <h2 className="text-3xl font-black leading-tight text-white sm:text-3xl">Conexão WhatsApp</h2>
          <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-gray-500 sm:text-base">Integre seu Terreiro com notificações automáticas via WhatsApp pela Evolution API.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 text-left md:grid-cols-2 md:gap-8">
        <div className="space-y-6">
          {serviceNotice && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-200/90">
              {serviceNotice}
            </div>
          )}
          {errorMsg && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-300">
              {errorMsg}
            </div>
          )}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-xl font-bold text-white">
              <Shield className="w-5 h-5 text-emerald-500" />
              Status da Instância
            </h3>
            <div className={`rounded-2xl border p-4 transition-all sm:p-6 ${
              status === 'CONNECTED' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-black' 
                : status === 'LOADING' || status === 'PAIRING'
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-white/5 border-white/5 text-gray-400'
            }`}>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  {status === 'LOADING' ? (
                    <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                  ) : status === 'CONNECTED' ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                  ) : status === 'PAIRING' ? (
                    <Loader2 className="h-6 w-6 shrink-0 animate-pulse" />
                  ) : (
                    <AlertCircle className="h-6 w-6 shrink-0" />
                  )}
                  <span className="min-w-0 text-sm font-black uppercase tracking-widest">
                    {status === 'CONNECTED' ? 'Conectado' : 
                     status === 'LOADING' ? 'Inicializando...' : 
                     status === 'PAIRING' ? 'Aguardando código' : 'Desconectado'}
                  </span>
                </div>
              </div>
            </div>

            {(status === 'DISCONNECTED' || status === 'PAIRING') && (
              <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-5 sm:p-6">
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Conectar via Código</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Digite o número do celular que vai parear com o sistema (com DDD; DDI 55 para Brasil é opcional).
                </p>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 11912345678"
                  disabled={loading || status === 'PAIRING'}
                  className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 font-mono text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-emerald-500 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={loading || status === 'PAIRING'}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-black uppercase tracking-widest text-background transition-all hover:scale-[1.02] disabled:opacity-50 sm:w-auto"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  {loading ? 'Gerando...' : status === 'PAIRING' ? 'Código ativo' : 'Gerar código'}
                </button>
                {status === 'PAIRING' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPairingCode(null);
                      setStatus('DISCONNECTED');
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white"
                  >
                    Cancelar / gerar novo
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-5 sm:p-6">
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Recursos Ativos</h4>
            <ul className="space-y-3">
              {[
                'Avisos de Mural Automáticos',
                'Lembretes de Mensalidade',
                'Confirmação de Eventos',
                'Transmissão de Recados'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-400 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex min-h-[260px] flex-col items-center justify-center space-y-6 rounded-2xl border border-white/5 bg-background p-5 text-center sm:min-h-[300px] sm:p-8">
            <AnimatePresence mode="wait">
              {status === 'DISCONNECTED' ? (
                <motion.div 
                  key="disconnected"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-white/5 bg-white/5 p-4 sm:h-48 sm:w-48">
                    <Smartphone className="w-12 h-12 text-white/10" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-white font-bold">Inicie a Conexão</p>
                    <p className="text-xs text-gray-500 max-w-[220px] mx-auto leading-relaxed">
                      Digite o número e clique em <span className="font-black text-emerald-400">Gerar código</span> para vincular o aparelho.
                    </p>
                  </div>
                </motion.div>
              ) : status === 'PAIRING' && pairingCode ? (
                <motion.div 
                  key="pairing"
                  initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-5 w-full"
                >
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {(pairingCode.includes('-') ? pairingCode.split('-') : [pairingCode]).map((seg, idx, arr) => (
                      <React.Fragment key={`${seg}-${idx}`}>
                        <span className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 font-mono text-2xl font-black tracking-[0.35em] text-emerald-200 shadow-inner shadow-black/40 sm:px-5 sm:py-4 sm:text-3xl">
                          {seg}
                        </span>
                        {idx < arr.length - 1 && <span className="text-emerald-500/60 text-xl">—</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="space-y-2 text-center">
                    <p className="text-white font-bold">Digite o código no WhatsApp</p>
                    <p className="text-[11px] text-gray-500 max-w-[260px] mx-auto leading-relaxed">
                      Abra o WhatsApp → <span className="font-bold text-gray-300">Aparelhos conectados</span> → <span className="font-bold text-gray-300">Conectar com número de telefone</span>.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText((pairingCode || '').replace(/-/g, ''))}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-200 hover:bg-emerald-500/25"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </button>
                  </div>
                </motion.div>
              ) : status === 'LOADING' ? (
                <motion.div 
                   key="loading"
                   initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                   className="flex flex-col items-center justify-center space-y-4"
                >
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-primary font-black uppercase tracking-widest text-xs animate-pulse">Sincronizando com WhatsApp...</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="connected"
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center space-y-6"
                >
                  <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                    <CheckCircle2 className="w-12 h-12 text-background" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-emerald-500 font-black uppercase tracking-widest">Conexão Estabelecida</p>
                    <p className="text-xs text-gray-500">Seu Terreiro já está conectado e pronto para enviar mensagens.</p>
                  </div>
                  
                  {/* Test Message Section */}
                  <div className="w-full max-w-sm mt-6 p-4 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                    <p className="text-xs font-bold text-white text-left uppercase tracking-widest">Teste de Conexão</p>
                    <div className="flex flex-col gap-3">
                      <input 
                        type="text" 
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="Ex: 11999999999"
                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-gray-600"
                      />
                      <button 
                        onClick={handleTestMessage}
                        disabled={sendingTest || !testPhone}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-background px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-400 transition-colors"
                      >
                        {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        {sendingTest ? 'Enviando...' : 'Enviar Mensagem de Teste'}
                      </button>
                    </div>
                    {testStatus === 'success' && (
                      <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Mensagem Enviada!
                      </div>
                    )}
                    {testStatus === 'error' && (
                      <div className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center justify-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Erro ao enviar
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleLogout}
                    disabled={loading}
                    className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline disabled:opacity-50 mt-4"
                  >
                    {loading ? 'DESCONECTANDO...' : 'Desconectar Instância'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-amber-500 font-black uppercase tracking-widest text-[10px]">Aviso Importante</h4>
          <p className="text-xs text-amber-500/80 font-medium text-left">
            Certifique-se de manter o celular conectado à internet ocasionalmente para manter a sessão ativa. A conexão é gerenciada pela Evolution API no seu servidor.
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-lg font-black text-white">Mensagens Programadas</h4>
            <p className="text-xs text-gray-400">
              Já preenchemos com os textos atuais do sistema. Você pode manter ou personalizar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveTemplates}
            disabled={savingTemplates}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black uppercase tracking-widest text-background disabled:opacity-60"
          >
            {savingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingTemplates ? 'Salvando...' : 'Salvar Mensagens'}
          </button>
        </div>
        {templatesSaved && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300">
            Modelos salvos com sucesso.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {WHATSAPP_TEMPLATE_ORDER.map((key) => (
            <div key={key} className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{templateMeta[key].title}</p>
                  <p className="text-[11px] text-gray-500">{templateMeta[key].hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetTemplate(key)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-300 hover:bg-white/5"
                >
                  <RotateCcw className="h-3 w-3" />
                  Padrão
                </button>
              </div>
              <textarea
                value={templates[key] ?? ''}
                onChange={(e) => handleTemplateChange(key, e.target.value)}
                rows={7}
                className="w-full resize-y rounded-xl border border-white/10 bg-background px-3 py-2 text-xs text-white outline-none transition-all focus:border-primary"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
