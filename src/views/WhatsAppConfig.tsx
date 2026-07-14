import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Smartphone, Shield, AlertCircle, Loader2, CheckCircle2, Save, RotateCcw, Copy } from 'lucide-react';
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
import { AppDemoCard } from '../components/ui/appDemoUi';

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

type WhatsAppConfigProps = {
  /** Dentro de Configurações — layout v3 sem card externo duplicado */
  embedded?: boolean;
};

export default function WhatsAppConfig({ embedded = false }: WhatsAppConfigProps) {
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
    dados_acesso: {
      title: 'Dados de acesso',
      hint: 'Enviado ao cadastrar filho, reenvio em massa ou botão na ficha. Template Meta conta_ativa_axecloud + senha em texto livre.',
    },
    cobranca_mensalidade: {
      title: 'Cobrança de Mensalidade',
      hint: 'Template Meta cobranca_mensalidade_axecloud — botão Gerar cobrança no Financeiro.',
    },
    financeiro: {
      title: 'Financeiro (Lembrete)',
      hint: 'Enviado automaticamente 3 dias antes e no dia do vencimento.',
    },
    mensalidade_confirmada: {
      title: 'Mensalidade Confirmada',
      hint: 'Template Meta mensalidade_confirmada_axecloud — ao confirmar pagamento no financeiro.',
    },
    mural_aviso: {
      title: 'Aviso de Mural',
      hint: 'Disparada automaticamente ao publicar aviso no mural.',
    },
    convite_evento: {
      title: 'Convite de Evento',
      hint: 'Inclui links de confirmar/declinar presença ({{link_confirmar}}, {{link_declinar}}).',
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

  const renderConnectionPanel = () => {
    if (status === 'DISCONNECTED') {
      return (
        <div className="flex h-full min-h-[220px] flex-col items-center justify-center space-y-6 text-center">
          <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#181818] sm:h-40 sm:w-40">
            <Smartphone className="h-12 w-12 text-white/20" aria-hidden />
          </div>
          <div className="space-y-2 px-2">
            <p className="font-bold text-white">Inicie a Conexão</p>
            <p className="mx-auto max-w-[260px] text-xs leading-relaxed text-gray-500">
              {isMobileConnect
                ? 'Digite o número deste celular e toque em Gerar código.'
                : 'Use QR no computador ou código numérico no celular do terreiro.'}
            </p>
          </div>
        </div>
      );
    }

    if (status === 'PAIRING' && (qrCode || pairingCode)) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center space-y-5">
          {qrCode && (
            <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-emerald-500/30 bg-white p-3">
              <img src={qrCode} alt="QR Code WhatsApp" className="h-auto w-full rounded-lg" />
            </div>
          )}
          {pairingCode && isMobileConnect && (
            <p className="mx-auto max-w-[300px] rounded-xl border border-emerald-500/25 bg-[#0f1812] px-3 py-2 text-[11px] leading-relaxed text-emerald-100/90">
              Copie <strong className="text-white">sem hífen</strong>, abra o WhatsApp → Aparelhos conectados → Conectar com número → cole em até 60s.
              Não gere outro código antes de colar.
            </p>
          )}
          {pairingCode && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(pairingCode.includes('-') ? pairingCode.split('-') : [pairingCode]).map((seg, idx, arr) => (
                <React.Fragment key={`${seg}-${idx}`}>
                  <span className="rounded-2xl border border-emerald-500/30 bg-[#0f1812] px-4 py-3 font-mono text-2xl font-black tracking-[0.35em] text-emerald-200 sm:px-5 sm:py-4 sm:text-3xl">
                    {seg}
                  </span>
                  {idx < arr.length - 1 && <span className="text-xl text-emerald-500/60">—</span>}
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="space-y-2 text-center">
            <p className="font-bold text-white">
              {qrCode ? 'Escaneie o QR no celular' : 'Digite o código no WhatsApp'}
            </p>
            <p className="mx-auto max-w-[280px] text-[11px] leading-relaxed text-gray-500">
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
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-[#0f1812] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-200 hover:bg-[#142018]"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar código
              </button>
            </div>
          )}
        </div>
      );
    }

    if (status === 'PAIRING' || status === 'LOADING') {
      return (
        <div className="flex h-full flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-primary">
            {status === 'PAIRING'
              ? 'Gerando QR / código...'
              : serviceNotice?.includes('Preparando código')
                ? 'Preparando código (~15s)...'
                : 'Sincronizando com WhatsApp...'}
          </p>
        </div>
      );
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center space-y-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500">
          <CheckCircle2 className="h-12 w-12 text-background" />
        </div>
        <div className="space-y-2">
          <p className="font-black uppercase tracking-widest text-emerald-500">Conexão Estabelecida</p>
          <p className="text-xs text-gray-500">
            Seu Terreiro já está conectado. No celular, reconecte com o código numérico; no computador, use o QR.
          </p>
        </div>

        <div className="mt-6 w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-[#181818] p-4">
          <p className="text-left text-xs font-bold uppercase tracking-widest text-white">Teste de Conexão</p>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Ex: 11999999999"
              className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500"
            />
            <button
              onClick={handleTestMessage}
              disabled={sendingTest || !testPhone}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-background transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              {sendingTest ? 'Enviando...' : 'Enviar Mensagem de Teste'}
            </button>
          </div>
          {testStatus === 'success' && (
            <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
              <CheckCircle2 className="h-3 w-3" /> Mensagem Enviada!
            </div>
          )}
          {testStatus === 'error' && (
            <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500">
              <AlertCircle className="h-3 w-3" /> Erro ao enviar
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          disabled={loading}
          className="mt-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline disabled:opacity-50"
        >
          {loading ? 'DESCONECTANDO...' : 'Desconectar Instância'}
        </button>
      </div>
    );
  };

  const isConnected = status === 'CONNECTED';

  const header = embedded ? (
    <div className="flex flex-col gap-4 border-b border-[#1E242B] pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h6 className="flex items-center gap-2 font-display text-lg font-bold text-[#F1F5F9]">
          <MessageSquare className="h-5 w-5 text-[#10B981]" aria-hidden />
          Integração & Configuração do WhatsApp
        </h6>
        <p className="text-xs text-[#94A3B8]">
          Conecte o número do terreiro para automatizar notificações, cobranças de mensalidades e avisos de giras.
        </p>
      </div>
      <span
        className={`flex items-center gap-1.5 self-start rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase transition-all sm:self-auto ${
          isConnected
            ? 'border-[#10B981]/20 bg-emerald-950/20 text-[#10B981]'
            : 'border-[#1E242B] bg-[#1E252E] text-[#94A3B8]'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${isConnected ? 'animate-ping bg-emerald-500' : 'bg-gray-500'}`} />
        {isConnected ? 'Dispositivo Conectado' : 'Aparelho Desconectado'}
      </span>
    </div>
  ) : (
    <div className="grid gap-4 border-b border-white/5 pb-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-[#0f1812] text-emerald-500 sm:h-20 sm:w-20 sm:rounded-3xl">
        <MessageSquare className="h-8 w-8" />
      </div>
      <div className="min-w-0">
        <h2 className="text-3xl font-black leading-tight text-white sm:text-3xl">Conexão WhatsApp</h2>
        <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-gray-500 sm:text-base">
          Integre seu Terreiro com notificações automáticas via WhatsApp pela Evolution API.
        </p>
      </div>
    </div>
  );

  const body = (
    <>
      {header}

      <div className="min-w-0 space-y-6 text-left">
        {serviceNotice && (
          <div className="rounded-2xl border border-amber-500/30 bg-[#1a1508] px-4 py-3 text-xs font-semibold text-amber-200/90">
            {serviceNotice}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/30 bg-[#1a1012] px-4 py-3 text-xs font-semibold text-red-300">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <Shield className="h-5 w-5 shrink-0 text-emerald-500" />
            Status da Instância
          </h3>
          <div
            className={`rounded-2xl border p-4 sm:p-6 ${
              status === 'CONNECTED'
                ? 'border-emerald-500/25 bg-[#0f1812] font-black text-emerald-500'
                : status === 'LOADING' || status === 'PAIRING'
                  ? 'border-primary/25 bg-[#1a1708] text-primary'
                  : 'border-white/10 bg-[#181818] text-gray-400'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              {status === 'LOADING' ? (
                <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
              ) : status === 'CONNECTED' ? (
                <CheckCircle2 className="h-6 w-6 shrink-0" />
              ) : status === 'PAIRING' ? (
                <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
              ) : (
                <AlertCircle className="h-6 w-6 shrink-0" />
              )}
              <span className="min-w-0 text-sm font-black uppercase tracking-widest">
                {status === 'CONNECTED'
                  ? 'Conectado'
                  : status === 'LOADING'
                    ? 'Inicializando...'
                    : status === 'PAIRING'
                      ? qrCode
                        ? 'Escaneie o QR'
                        : 'Aguardando código'
                      : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-8">
          {(status === 'DISCONNECTED' || status === 'PAIRING') ? (
            <div className="flex h-full flex-col space-y-4 rounded-2xl border border-white/10 bg-[#181818] p-5 sm:p-6">
              <h4 className="text-sm font-black uppercase tracking-widest text-white">Vincular WhatsApp</h4>

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
                      className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500 disabled:opacity-60"
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
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-black uppercase tracking-widest text-background transition-colors hover:bg-emerald-400 disabled:opacity-50"
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
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#181818] px-5 text-xs font-black uppercase tracking-widest text-gray-300 transition-colors hover:bg-[#222222] disabled:opacity-50"
                      >
                        Gerar QR Code (outro aparelho)
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-relaxed text-gray-400">
                      No <strong className="text-white">computador</strong>, escaneie o QR com o celular. No{' '}
                      <strong className="text-white">celular</strong>, use o código numérico com o número desta conta.
                    </p>
                    <div className="grid flex-1 gap-4 sm:grid-cols-2 sm:items-stretch">
                      <div className="flex h-full min-h-[148px] flex-col rounded-xl border border-emerald-500/25 bg-[#0f1812] p-4">
                        <p className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          QR Code
                        </p>
                        <div className="mt-3 flex flex-1 flex-col justify-end">
                          <button
                            type="button"
                            onClick={() => void handleStartQr()}
                            disabled={loading || status === 'PAIRING'}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase tracking-widest text-background transition-colors hover:bg-emerald-400 disabled:opacity-50"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                            ) : (
                              <Smartphone className="h-4 w-4 shrink-0" />
                            )}
                            <span>Conectar com QR</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex h-full min-h-[148px] flex-col rounded-xl border border-white/10 bg-[#181818] p-4">
                        <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Código no celular
                        </p>
                        <div className="mt-3 flex flex-1 flex-col justify-end gap-3">
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
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0f1812] px-4 text-[11px] font-black uppercase tracking-widest text-emerald-200 hover:bg-[#142018] disabled:opacity-50"
                          >
                            {status === 'PAIRING' && pairingLocked ? 'Código ativo' : 'Gerar código'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              {status === 'PAIRING' && (
                <button
                  type="button"
                  onClick={cancelPairing}
                  className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white"
                >
                  Cancelar / tentar de novo
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#141414] p-6 text-center md:col-span-2">
              {renderConnectionPanel()}
            </div>
          )}

          {(status === 'DISCONNECTED' || status === 'PAIRING') && (
            <div className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] p-5 text-center sm:p-8">
              {renderConnectionPanel()}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#181818] p-5 sm:p-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-white">Recursos Ativos</h4>
          <ul className="space-y-3">
            {[
              'Avisos de Mural ao publicar',
              'Lembrete automático de mensalidade',
              'Convites de eventos no calendário',
              'Alertas de estoque crítico (cron diário)',
              'Cobrança manual no financeiro',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-sm font-medium text-gray-400">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-3xl border border-amber-500/25 bg-[#1a1508] p-4 sm:p-6">
        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-amber-500 font-black uppercase tracking-widest text-[10px]">Aviso Importante</h4>
          <p className="text-xs text-amber-500/80 font-medium text-left">
            Certifique-se de manter o celular conectado à internet ocasionalmente para manter a sessão ativa. A conexão é gerenciada pela Evolution API no seu servidor.
          </p>
        </div>
      </div>

      <div className="space-y-5 overflow-hidden rounded-3xl border border-white/10 bg-[#141414] p-4 sm:p-7">
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
            className="app-page-action self-start sm:self-auto"
          >
            {savingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingTemplates ? 'Salvando...' : 'Salvar Mensagens'}
          </button>
        </div>
        {templatesSaved && (
          <div className="rounded-xl border border-emerald-500/30 bg-[#0f1812] px-3 py-2 text-[11px] font-bold text-emerald-300">
            Modelos salvos com sucesso.
          </div>
        )}
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {WHATSAPP_TEMPLATE_ORDER.map((key) => (
            <div key={key} className="min-w-0 space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-[#181818] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{templateMeta[key].title}</p>
                  <p className="text-[11px] text-gray-500">{templateMeta[key].hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetTemplate(key)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-300 hover:bg-[#222222]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Padrão
                </button>
              </div>
              <textarea
                value={templates[key] ?? ''}
                onChange={(e) => handleTemplateChange(key, e.target.value)}
                rows={7}
                className="min-w-0 max-w-full w-full resize-y break-words rounded-xl border border-white/10 bg-[#121212] px-3 py-2 text-xs text-white outline-none transition-colors focus:border-primary"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="animate-fadeIn space-y-6 overflow-x-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:p-6">
        {body}
      </div>
    );
  }

  return (
    <AppDemoCard className="mx-auto w-full min-w-0 max-w-5xl space-y-6 overflow-x-hidden sm:space-y-8">
      {body}
    </AppDemoCard>
  );
}
