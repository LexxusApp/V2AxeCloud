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
import { digitsOnly, normalizeBrWhatsAppMsisdn, previewBrWhatsAppMsisdn } from '../lib/whatsappPhone';

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

function qrImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const s = String(src).trim();
  if (!s) return null;
  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
  return `data:image/png;base64,${s}`;
}

export default function WhatsAppConfig() {
  const [status, setStatus] = useState<WaStatus>('DISCONNECTED');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [isMobileConnect, setIsMobileConnect] = useState(false);
  const [showQrOnMobile, setShowQrOnMobile] = useState(false);
  const [pairingLockedUntil, setPairingLockedUntil] = useState(0);
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
  const qrRef = useRef<string | null>(qrCode);
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

  useEffect(() => {
    qrRef.current = qrCode;
  }, [qrCode]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const touch = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent);
    const apply = () => setIsMobileConnect(mq.matches || touch);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

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
            if (statusRef.current === 'PAIRING' && (pairingRef.current || qrRef.current)) {
              return;
            }
            setStatus('DISCONNECTED');
            setPairingCode(null);
            setQrCode(null);
            return;
          }
          throw new Error(String((data as { error?: string })?.error || `Falha ao consultar status (${res.status})`));
        }

        const nextStatus = String((data as { status?: string })?.status || '').toUpperCase();

        if (nextStatus === 'CONNECTED') {
          setStatus('CONNECTED');
          setPairingCode(null);
          setQrCode(null);
        } else if (nextStatus === 'DISCONNECTED' || nextStatus === 'LOADING' || nextStatus === 'QRCODE') {
          if (statusRef.current === 'PAIRING' && (pairingRef.current || qrRef.current)) {
            setStatus('PAIRING');
          } else {
            setStatus('DISCONNECTED');
            setPairingCode(null);
            setQrCode(null);
          }
        } else {
          if (statusRef.current === 'PAIRING' && (pairingRef.current || qrRef.current)) {
            setStatus('PAIRING');
          } else {
            setStatus('DISCONNECTED');
            setPairingCode(null);
            setQrCode(null);
          }
        }
        setErrorMsg(null);
        setServiceNotice(null);
      } catch (err) {
        console.error('Erro ao checar status do WhatsApp:', err);
        setServiceNotice(WHATSAPP_INIT_FALLBACK);
        if (statusRef.current === 'PAIRING' && (pairingRef.current || qrRef.current)) {
          return;
        }
        setStatus('DISCONNECTED');
        setPairingCode(null);
        setQrCode(null);
        setErrorMsg(null);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 15000);

    return () => clearInterval(intervalId);
  }, []);

  const applyConnectResponse = (data: Record<string, unknown>) => {
    const msgOk = String(data.message || '');
    if (msgOk.includes('já está conectado')) {
      setStatus('CONNECTED');
      setPairingCode(null);
      setQrCode(null);
      return;
    }
    const code = typeof data.pairingCode === 'string' ? formatPairingCode(data.pairingCode) : null;
    const qr = qrImageSrc(typeof data.qrcode === 'string' ? data.qrcode : null);
    if (code || qr) {
      setPairingCode(code);
      setQrCode(qr);
      setStatus('PAIRING');
      if (code) setPairingLockedUntil(Date.now() + 90_000);
    } else {
      setStatus('LOADING');
    }
  };

  const postWhatsAppStart = async (body: Record<string, string>) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      const userId = await getSessionUserId();
      const res = await fetch(whatsappApiUrl('/connect'), {
        method: 'POST',
        headers: whatsappRailwayHeaders(token, userId),
        body: whatsappRailwayJsonBody(userId, body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(
            typeof data.error === 'string' ? data.error : 'Sessão expirada. Faça login novamente.',
          );
          setServiceNotice(null);
          return;
        }
        if (isBadGatewayOrTimeout(res.status) || isWhatsappServiceWarmingPayload(data, res.status)) {
          setServiceNotice(
            typeof data.error === 'string' ? data.error : WHATSAPP_INIT_FALLBACK,
          );
          setErrorMsg(null);
          setStatus('LOADING');
          return;
        }
        setErrorMsg(String(data.error || `Falha ao iniciar WhatsApp (${res.status})`));
        setServiceNotice(null);
        setStatus('DISCONNECTED');
        setPairingCode(null);
        setQrCode(null);
        return;
      }
      applyConnectResponse(data);
      setServiceNotice(null);
    } catch (err) {
      console.error('Erro ao iniciar WhatsApp:', err);
      setErrorMsg(err instanceof Error ? err.message : WHATSAPP_INIT_FALLBACK);
      setServiceNotice(null);
      setStatus('DISCONNECTED');
      setPairingCode(null);
      setQrCode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartQr = async () => {
    setPairingCode(null);
    setQrCode(null);
    await postWhatsAppStart({ mode: 'qrcode' });
  };

  const handleStart = async () => {
    const phoneDigits = digitsOnly(phone);
    if (phoneDigits.length < 10) {
      setErrorMsg('Informe o número do celular com DDD (apenas dígitos).');
      return;
    }
    let msisdn: string;
    try {
      msisdn = normalizeBrWhatsAppMsisdn(phone);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Número inválido.');
      return;
    }
    setPairingCode(null);
    setQrCode(null);
    setPairingLockedUntil(0);
    setStatus('LOADING');
    setServiceNotice('Preparando código no servidor (~15s). Não feche esta tela.');
    await postWhatsAppStart({ phone: msisdn });
  };

  const cancelPairing = () => {
    setPairingCode(null);
    setQrCode(null);
    setPairingLockedUntil(0);
    setStatus('DISCONNECTED');
  };

  const pairingLocked = pairingLockedUntil > Date.now();

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
      setQrCode(null);
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
    <div className="card-luxury mx-auto w-full min-w-0 max-w-5xl space-y-6 overflow-x-hidden p-5 sm:space-y-8 sm:p-8 lg:p-10">
      <div className="grid gap-4 border-b border-white/5 pb-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-2xl shadow-emerald-500/10 sm:h-20 sm:w-20 sm:rounded-3xl">
          <MessageSquare className="h-8 w-8" />
        </div>
        <div className="min-w-0">
          <h2 className="text-3xl font-black leading-tight text-white sm:text-3xl">Conexão WhatsApp</h2>
          <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-gray-500 sm:text-base">Integre seu Terreiro com notificações automáticas via WhatsApp pela Evolution API.</p>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 text-left md:grid-cols-2 md:gap-8">
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
                     status === 'PAIRING' ? (qrCode ? 'Escaneie o QR' : 'Aguardando código') : 'Desconectado'}
                  </span>
                </div>
              </div>
            </div>

            {(status === 'DISCONNECTED' || status === 'PAIRING') && (
              <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-5 sm:p-6">
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Vincular WhatsApp</h4>

                {isMobileConnect ? (
                  <>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      No <strong className="text-white">mesmo celular</strong> do WhatsApp: gere o código aqui e digite no app
                      (não precisa escanear QR).
                    </p>
                    <ol className="list-decimal space-y-1.5 pl-4 text-[11px] text-gray-500 leading-relaxed">
                      <li>Digite o número <strong className="text-gray-300">deste aparelho</strong> (DDD + 9 + oito dígitos)</li>
                      <li>Toque em <strong className="text-emerald-300">Gerar código</strong> e copie</li>
                      <li>Abra o WhatsApp → <strong className="text-gray-300">Aparelhos conectados</strong></li>
                      <li><strong className="text-gray-300">Conectar com número de telefone</strong> → cole o código em até 60s</li>
                    </ol>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 11912276156"
                      disabled={loading || status === 'PAIRING'}
                      className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 font-mono text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-emerald-500 disabled:opacity-60"
                    />
                    {previewBrWhatsAppMsisdn(phone) && (
                      <p className="text-[11px] text-gray-500">
                        Número da conta:{' '}
                        <span className="font-mono text-emerald-300">{previewBrWhatsAppMsisdn(phone)}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleStart()}
                      disabled={loading || (status === 'PAIRING' && pairingLocked)}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-black uppercase tracking-widest text-background transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                      {loading
                        ? 'Gerando...'
                        : status === 'PAIRING' && pairingLocked
                          ? 'Código ativo — use no WhatsApp'
                          : 'Gerar código neste celular'}
                    </button>
                    {status === 'PAIRING' && pairingLocked && (
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        Não clique de novo por 90 segundos — cada novo código invalida o anterior no WhatsApp.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowQrOnMobile((v) => !v)}
                      className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300"
                    >
                      {showQrOnMobile ? 'Ocultar QR Code' : 'Tenho computador ou outro celular para escanear QR'}
                    </button>
                    {showQrOnMobile && (
                      <button
                        type="button"
                        onClick={() => void handleStartQr()}
                        disabled={loading || status === 'PAIRING'}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-xs font-black uppercase tracking-widest text-gray-300 transition-all hover:bg-white/10 disabled:opacity-50"
                      >
                        Gerar QR Code (outro aparelho)
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      No <strong className="text-white">computador</strong>, escaneie o QR com o celular. No <strong className="text-white">celular</strong>,
                      use o código numérico com o número desta conta.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">QR Code</p>
                        <button
                          type="button"
                          onClick={() => void handleStartQr()}
                          disabled={loading || status === 'PAIRING'}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase tracking-widest text-background transition-all hover:scale-[1.02] disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                          Conectar com QR
                        </button>
                      </div>
                      <div className="space-y-3 rounded-xl border border-white/10 bg-background/50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Código no celular</p>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="11912276156"
                          disabled={loading || status === 'PAIRING'}
                          className="w-full rounded-xl border border-white/10 bg-background px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => void handleStart()}
                          disabled={loading || (status === 'PAIRING' && pairingLocked)}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-[11px] font-black uppercase tracking-widest text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {status === 'PAIRING' && pairingLocked ? 'Código ativo' : 'Gerar código'}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {status === 'PAIRING' && (
                  <button
                    type="button"
                    onClick={cancelPairing}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white"
                  >
                    Cancelar / tentar de novo
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
                    <p className="text-xs text-gray-500 max-w-[260px] mx-auto leading-relaxed">
                      {isMobileConnect
                        ? 'Digite o número deste celular e toque em Gerar código.'
                        : 'Use QR no computador ou código numérico no celular do terreiro.'}
                    </p>
                  </div>
                </motion.div>
              ) : status === 'PAIRING' && (qrCode || pairingCode) ? (
                <motion.div 
                  key="pairing"
                  initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-5 w-full"
                >
                  {qrCode && (
                    <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-emerald-500/30 bg-white p-3 shadow-lg shadow-black/40">
                      <img src={qrCode} alt="QR Code WhatsApp" className="h-auto w-full rounded-lg" />
                    </div>
                  )}
                  {pairingCode && isMobileConnect && (
                    <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/90 max-w-[300px] mx-auto leading-relaxed">
                      Copie <strong className="text-white">sem hífen</strong>, abra o WhatsApp → Aparelhos conectados → Conectar com número → cole em até 60s.
                      Não gere outro código antes de colar.
                    </p>
                  )}
                  {pairingCode && (
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
                  )}
                  <div className="space-y-2 text-center">
                    <p className="text-white font-bold">
                      {qrCode ? 'Escaneie o QR no celular' : 'Digite o código no WhatsApp'}
                    </p>
                    <p className="text-[11px] text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                      {qrCode ? (
                        <>
                          WhatsApp → <span className="font-bold text-gray-300">Aparelhos conectados</span> →{' '}
                          <span className="font-bold text-gray-300">Conectar um aparelho</span> → Escanear QR.
                        </>
                      ) : (
                        <>
                          WhatsApp → <span className="font-bold text-gray-300">Aparelhos conectados</span> →{' '}
                          <span className="font-bold text-gray-300">Conectar com número de telefone</span>.
                        </>
                      )}
                    </p>
                  </div>
                  {pairingCode && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                        const raw = (pairingCode || '').replace(/-/g, '').replace(/\s/g, '');
                        void navigator.clipboard?.writeText(raw);
                      }}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-200 hover:bg-emerald-500/25"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar código
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : status === 'PAIRING' ? (
                <motion.div
                  key="pairing-wait"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center space-y-4"
                >
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-primary font-black uppercase tracking-widest text-xs animate-pulse">
                    Gerando QR / código...
                  </p>
                </motion.div>
              ) : status === 'LOADING' ? (
                <motion.div 
                   key="loading"
                   initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                   className="flex flex-col items-center justify-center space-y-4"
                >
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-primary font-black uppercase tracking-widest text-xs animate-pulse">
                    {serviceNotice?.includes('Preparando código') ? 'Preparando código (~15s)...' : 'Sincronizando com WhatsApp...'}
                  </p>
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
                    <p className="text-xs text-gray-500">
                      Seu Terreiro já está conectado. No celular, reconecte com o código numérico; no computador, use o QR.
                    </p>
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

      <div className="flex items-start gap-4 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-6">
        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-amber-500 font-black uppercase tracking-widest text-[10px]">Aviso Importante</h4>
          <p className="text-xs text-amber-500/80 font-medium text-left">
            Certifique-se de manter o celular conectado à internet ocasionalmente para manter a sessão ativa. A conexão é gerenciada pela Evolution API no seu servidor.
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-7">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h4 className="text-lg font-black text-white">Mensagens Programadas</h4>
            <p className="text-xs text-gray-400">
              Já preenchemos com os textos atuais do sistema. Você pode manter ou personalizar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveTemplates}
            disabled={savingTemplates}
            className="app-page-action inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-xs font-black uppercase tracking-widest text-background disabled:opacity-60 sm:self-auto"
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
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {WHATSAPP_TEMPLATE_ORDER.map((key) => (
            <div key={key} className="min-w-0 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
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
                className="min-w-0 max-w-full w-full resize-y break-words rounded-xl border border-white/10 bg-background px-3 py-2 text-xs text-white outline-none transition-all focus:border-primary"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
