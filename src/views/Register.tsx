import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  Check,
  MapPin,
  Search,
  Camera,
  Building2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { appHref } from '../lib/appHref';
import { navigateToMarketingDocument } from '../lib/purgeServiceWorker';
import { ROUTES } from '../lib/routes';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { AuthScreenBackground } from '../components/AuthScreenBackground';
import { getConversionContext, trackConversionEvent } from '../lib/trackConversion';
import { PASSWORD_HINT_PT, validateStrongPassword } from '../../lib/passwordPolicy';

const GOLD = '#f2b90f';
const fontLogin = '[font-family:Outfit,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif]';

const highlights = [
  'Filhos de santo, mural e calendário no mesmo fluxo',
  'Financeiro com Pix e histórico transparente',
  'Galeria, biblioteca e loja do axé quando precisar',
] as const;

const fieldShell = cn(
  'w-full h-[46px] rounded-lg border border-zinc-300 bg-white px-3 sm:h-[42px]',
  'text-[14px] font-medium text-zinc-900 placeholder:text-zinc-500',
  'outline-none transition-[border-color,box-shadow] duration-200',
  'focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
);

const labelClass =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-800';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function readPreferredBillingCycle(): 'monthly' | 'annual' {
  if (typeof window === 'undefined') return 'monthly';
  const queryCycle = new URLSearchParams(window.location.search).get('billing');
  if (queryCycle === 'annual' || queryCycle === 'monthly') return queryCycle;
  try {
    return window.localStorage.getItem('axecloud:preferred-billing-cycle') === 'annual'
      ? 'annual'
      : 'monthly';
  } catch {
    return 'monthly';
  }
}

export default function Register() {
  const { premium: catalogPrice } = usePlansCatalog();
  const claimId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('claim')?.trim() || ''
    : '';
  const [billingCycle] = useState<'monthly' | 'annual'>(readPreferredBillingCycle);
  const [nomeTerreiro, setNomeTerreiro] = useState('');
  const [nomeZelador, setNomeZelador] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [descricaoPublica, setDescricaoPublica] = useState('');
  const [publicarNoMapa, setPublicarNoMapa] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [cepLookup, setCepLookup] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cepError, setCepError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const startedTracked = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const passwordRules = [
    { label: '8+ caracteres', valid: password.length >= 8 },
    { label: 'uma minúscula', valid: /[a-z]/.test(password) },
    { label: 'uma maiúscula', valid: /[A-Z]/.test(password) },
    { label: 'um número', valid: /\d/.test(password) },
    { label: 'um símbolo', valid: /[^A-Za-z0-9]/.test(password) },
  ] as const;

  useEffect(() => {
    void trackConversionEvent('register_view');
    try {
      window.localStorage.setItem('axecloud:preferred-billing-cycle', billingCycle);
    } catch {
      // O cadastro segue normalmente quando o navegador bloqueia o storage.
    }
  }, [billingCycle]);

  useEffect(() => {
    const normalizedCep = cep.replace(/\D/g, '');
    if (normalizedCep.length !== 8) {
      setCepLookup('idle');
      setCepError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCepLookup('loading');
      setCepError(null);
      try {
        const response = await fetch(`/api/v1/public/cep/${normalizedCep}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o CEP.');
        setEndereco(String(data.logradouro || ''));
        setBairro(String(data.bairro || ''));
        setCidade(String(data.cidade || ''));
        setEstado(String(data.estado || ''));
        setCepLookup('success');
      } catch (lookupError: unknown) {
        if (lookupError instanceof DOMException && lookupError.name === 'AbortError') return;
        setCepLookup('error');
        setCepError(lookupError instanceof Error ? lookupError.message : 'Não foi possível consultar o CEP.');
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cep]);

  const selectedPrice =
    billingCycle === 'annual'
      ? `${catalogPrice.annualLabel}/ano (R$ ${catalogPrice.annualEquivalentMonthly
          .toFixed(2)
          .replace('.', ',')}/mês)`
      : `${catalogPrice.label}${catalogPrice.period}`;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const syncOverflow = () => {
      const lock = mq.matches;
      document.documentElement.style.overflow = lock ? 'hidden' : '';
      document.body.style.overflow = lock ? 'hidden' : '';
    };
    syncOverflow();
    mq.addEventListener('change', syncOverflow);
    return () => {
      mq.removeEventListener('change', syncOverflow);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      rootRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 3) return;
    setError(null);
    setPasswordError(null);

    const passwordCheck = validateStrongPassword(password);
    if (passwordCheck.ok === false) {
      const message = `Revise a senha: ${passwordCheck.message}`;
      setError(message);
      setPasswordError(passwordCheck.message);
      passwordRef.current?.focus();
      void trackConversionEvent('register_failed', {
        metadata: { reason: 'password_policy' },
      });
      return;
    }

    setLoading(true);
    void trackConversionEvent('register_submitted', {
      metadata: { billingCycle, step: 3 },
    });

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_terreiro: nomeTerreiro.trim(),
          nome_zelador: nomeZelador.trim(),
          email: email.trim(),
          password,
          whatsapp: whatsapp.trim(),
          cep: cep.replace(/\D/g, ''),
          endereco: endereco.trim(),
          numero: numero.trim(),
          complemento: complemento.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          estado: estado.trim(),
          descricao_publica: descricaoPublica.trim(),
          publicar_no_mapa: publicarNoMapa,
          billingCycle,
          claimId: claimId || undefined,
          conversion: getConversionContext(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        void trackConversionEvent('register_failed', { metadata: { status: res.status } });
        throw new Error(data.error || 'Não foi possível concluir o cadastro.');
      }

      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        throw new Error('Conta criada, mas o login automático falhou. Entre com seu e-mail e senha.');
      }

      if (profilePhoto && signInData.session?.access_token) {
        try {
          const fileData = await fileToBase64(profilePhoto);
          const uploadResponse = await fetch('/api/v1/settings/directory-profile/upload-photo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${signInData.session.access_token}`,
            },
            body: JSON.stringify({
              fileData,
              fileName: profilePhoto.name,
              contentType: profilePhoto.type || 'image/jpeg',
            }),
          });
          const uploaded = await uploadResponse.json().catch(() => ({}));
          if (uploadResponse.ok && uploaded.publicUrl) {
            const enderecoCompleto = [
              `${endereco.trim()}, ${numero.trim()}`,
              complemento.trim(),
              bairro.trim(),
              `${cidade.trim()} - ${estado.trim().toUpperCase()}`,
              `CEP ${cep.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')}`,
            ].filter(Boolean).join(' · ');
            await fetch('/api/v1/settings/directory-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${signInData.session.access_token}`,
              },
              body: JSON.stringify({
                nome: nomeTerreiro.trim(),
                cep: cep.replace(/\D/g, ''),
                endereco: enderecoCompleto,
                telefone: whatsapp.trim(),
                cidade: cidade.trim(),
                estado: estado.trim(),
                bairro: bairro.trim(),
                descricaoPublica: descricaoPublica.trim(),
                photoSource: 'custom',
                ownerPhotoUrl: uploaded.publicUrl,
                publicacaoStatus: data.radarPublished ? 'publicado' : 'rascunho',
              }),
            });
          }
        } catch (photoError) {
          console.warn('[register] Foto do Radar será concluída no painel:', photoError);
        }
      }

      // Login pós-cadastro não passa por Login.tsx — precisa auditar aqui.
      try {
        const session = signInData.session;
        if (session?.access_token) {
          await fetch('/api/auth/audit-log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            keepalive: true,
            body: JSON.stringify({
              action: 'auth.login_success',
              status: 'success',
              terreiroId: data.tenantId || data.userId || session.user?.id || null,
              details: {
                surface: 'app',
                mode: 'zelador',
                source: 'register',
                email: session.user?.email || email.trim().toLowerCase(),
                userId: session.user?.id || data.userId,
              },
            }),
          });
        }
      } catch {
        /* auditoria best-effort */
      }

      // URL exclusiva de sucesso: permite ao Google Ads contabilizar somente
      // cadastros realmente concluídos, sem confundir a abertura do formulário.
      window.location.href = appHref(`${ROUTES.dashboard}?cadastro=concluido`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const continueRegistration = () => {
    setError(null);
    if (!nomeTerreiro.trim() || !nomeZelador.trim()) {
      setError('Informe o nome da casa e o nome de quem será responsável pela conta.');
      return;
    }
    void trackConversionEvent('register_step_completed', { metadata: { step: 1 } });
    setStep(2);
  };

  const continueAddress = () => {
    setError(null);
    const normalizedCep = cep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(normalizedCep) || endereco.trim().length < 3 || !numero.trim() || bairro.trim().length < 2 || cidade.trim().length < 2 || !/^[A-Za-z]{2}$/.test(estado.trim())) {
      setError('Complete o CEP e o endereço da casa antes de continuar.');
      return;
    }
    if (!publicarNoMapa) {
      setError('Confirme a autorização para que a casa seja incluída no mapa do AxéCloud.');
      return;
    }
    void trackConversionEvent('register_step_completed', { metadata: { step: 2 } });
    setStep(3);
  };

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'fixed inset-0 z-[100] antialiased',
        'flex flex-col bg-[#f4efe3] max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-contain',
        'lg:flex-row lg:overflow-hidden',
        fontLogin
      )}
    >
      <aside
        className="relative hidden w-full shrink-0 flex-col justify-between overflow-hidden bg-[#07140f] lg:flex lg:h-screen lg:min-h-0 lg:w-[38%] xl:w-[42%]"
        aria-label="Sobre o AxéCloud"
      >
        <AuthScreenBackground className="absolute inset-0" />
        <motion.div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/35 to-black/65" aria-hidden />

        <motion.div className="relative z-10 flex flex-col p-6 sm:p-8 lg:flex-1 lg:p-10">
          <a
            href={ROUTES.home}
            onClick={(event) => {
              event.preventDefault();
              void navigateToMarketingDocument(ROUTES.home);
            }}
            className="inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </a>

          <motion.div className="max-w-xl space-y-5 py-6 max-lg:py-4 lg:my-auto lg:py-10">
            <motion.div>
              <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#f2b90f]">AxéCloud</p>
              <h1 className="mt-3 text-[clamp(1.35rem,3vw,1.85rem)] font-extrabold leading-[1.15] tracking-tight text-white">
                A casa organizada.
                <span className="block text-white/90">O axé em primeiro lugar.</span>
              </h1>
              <p className="mt-4 text-[14px] leading-relaxed text-white/75 sm:text-[15px]">
                Você cuida do terreiro com respeito — nós cuidamos da parte que cansa: cadastros,
                mensalidades, comunicados e memória da sua casa, num só lugar.
              </p>
            </motion.div>

            <ul className="space-y-2.5" role="list">
              {highlights.map((line) => (
                <li key={line} className="flex gap-2.5 text-[13px] leading-snug text-white/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f2b90f]/15">
                    <Check className="h-3 w-3 text-[#f2b90f]" strokeWidth={2.5} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>

            <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white/85 backdrop-blur-sm">
              <span className="font-bold text-[#f2b90f]">{TRIAL_DAYS} dias grátis</span>
              {' · '}Ao final, você decide se quer continuar por {selectedPrice}. Nada é cobrado automaticamente.
            </p>
          </motion.div>

          <p className="pb-4 text-[11px] text-white/40 lg:pb-0">Gestão sagrada para zeladores e terreiros.</p>
        </motion.div>
      </aside>

      <main
        ref={mainRef}
        data-register-main
        className="flex w-full flex-col bg-[#f4efe3] text-[#111a15] lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        <motion.div
          className={cn(
            'mx-auto w-full max-w-[720px] px-5 py-8 sm:px-8 sm:py-10 lg:min-h-full lg:flex lg:flex-col lg:justify-start lg:py-12'
          )}
        >
          <a
            href={ROUTES.home}
            onClick={(event) => {
              event.preventDefault();
              void navigateToMarketingDocument(ROUTES.home);
            }}
            className="mb-4 inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-zinc-500 transition hover:text-zinc-800 lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </a>

          <div className="mb-5 rounded-2xl border border-[#d8c9a5] bg-[#fffaf0] px-5 py-4 shadow-sm lg:hidden">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#946d00]">AxéCloud · cadastro da casa</p>
            <p className="mt-1 text-base font-black text-[#102219]">Organização por dentro. Presença no mapa por fora.</p>
            <p className="mt-1 text-xs leading-relaxed text-[#625c50]">
              {TRIAL_DAYS} dias grátis. Sem cartão e sem cobrança automática.
            </p>
          </div>

          <header className="mb-6">
            {claimId ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">Reivindicação aprovada</p>
                <p className="mt-1 text-sm font-bold text-zinc-900">Crie o acesso com o mesmo e-mail da solicitação.</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">Ao concluir, o perfil público será conectado automaticamente a esta conta.</p>
              </div>
            ) : null}
            <div className="mb-5" aria-label={`Etapa ${step} de 3`}>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">
                <span>Etapa {step} de 3</span>
                <span>{step === 1 ? 'Sua casa' : step === 2 ? 'Radar e endereço' : 'Seu acesso'}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ded6c6]">
                <motion.div
                  className="h-full rounded-full bg-[#dca900]"
                  animate={{ width: step === 1 ? '33.333%' : step === 2 ? '66.666%' : '100%' }}
                />
              </div>
            </div>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.03em] text-[#102219] sm:text-[32px]">
              {step === 1 ? 'Primeiro, identifique sua casa.' : step === 2 ? 'Agora, coloque sua casa no Radar.' : 'Por fim, crie seu acesso.'}
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#625c50]">
              {step === 1
                ? 'Esses nomes serão usados para preparar o painel e identificar quem cuida da gestão.'
                : step === 2
                  ? 'O CEP preenche o endereço. Você completa o número, revisa os dados e autoriza a publicação no mapa.'
                  : `Use todos os recursos por ${TRIAL_DAYS} dias. Sem cartão e sem cobrança automática.`}
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            onChangeCapture={() => {
              if (startedTracked.current) return;
              startedTracked.current = true;
              void trackConversionEvent('register_started');
            }}
            className="space-y-4"
          >
            {error && (
              <motion.div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-snug text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {step === 1 ? (
            <motion.div
              key="register-house"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 gap-4 max-lg:gap-5"
            >
              <div className="flex items-start gap-3 rounded-2xl border border-[#d6c9ad] bg-[#fffaf0] px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#103c2d] text-[#f2b90f]"><Building2 className="h-5 w-5" /></span>
                <span><strong className="block text-sm font-black text-[#102219]">Um ambiente exclusivo para sua casa.</strong><small className="mt-1 block text-[11px] leading-relaxed text-[#6e6658]">O cadastro não mistura dados entre terreiros e não exige cartão.</small></span>
              </div>
              <motion.div>
                <label className={labelClass}>Nome do terreiro</label>
                <input
                  className={fieldShell}
                  value={nomeTerreiro}
                  onChange={(e) => setNomeTerreiro(e.target.value)}
                  placeholder="Ilê Axé Exemplo"
                  required
                  autoComplete="organization"
                />
              </motion.div>
              <motion.div>
                <label className={labelClass}>Nome do responsável</label>
                <input
                  className={fieldShell}
                  value={nomeZelador}
                  onChange={(e) => setNomeZelador(e.target.value)}
                  placeholder="Como você é conhecido(a) na casa"
                  required
                  autoComplete="name"
                />
              </motion.div>
              <button
                type="button"
                onClick={continueRegistration}
                className="flex h-[48px] w-full items-center justify-center rounded-xl bg-[#123f2f] text-[13px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-[#0d3326]"
              >
                Continuar
              </button>
              <p className="text-center text-[11px] leading-relaxed text-[#746c60]">Na próxima etapa você revisa o endereço e autoriza a presença no Radar.</p>
            </motion.div>
            ) : step === 2 ? (
            <motion.div
              key="register-radar"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex items-start gap-3 rounded-2xl border border-[#174b38]/15 bg-[#103c2d] px-4 py-3.5 text-white shadow-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f2b90f] text-[#102219]"><MapPin className="h-5 w-5" /></span>
                <span>
                  <strong className="block text-sm font-black">Sua casa já nasce conectada ao Radar.</strong>
                  <small className="mt-1 block text-[11px] leading-relaxed text-white/70">Endereço, apresentação e foto formam o perfil que as pessoas encontrarão no mapa.</small>
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-[0.72fr_1.28fr]">
                <motion.div>
                  <label className={labelClass}>CEP</label>
                  <div className="relative">
                    <input
                      className={cn(fieldShell, 'pr-10')}
                      value={cep.replace(/^(\d{5})(\d{0,3}).*/, '$1-$2')}
                      onChange={(event) => setCep(event.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="00000-000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c7c5c]">
                      {cepLookup === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : cepLookup === 'success' ? <Check className="h-4 w-4 text-emerald-700" /> : <Search className="h-4 w-4" />}
                    </span>
                  </div>
                  {cepError ? <p className="mt-1 text-[10px] font-semibold text-red-700">{cepError}</p> : null}
                </motion.div>
                <motion.div>
                  <label className={labelClass}>Rua ou avenida</label>
                  <input className={fieldShell} value={endereco} onChange={(event) => setEndereco(event.target.value)} placeholder="Preenchido pelo CEP" autoComplete="address-line1" required />
                </motion.div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[0.65fr_1.35fr]">
                <motion.div>
                  <label className={labelClass}>Número</label>
                  <input className={fieldShell} value={numero} onChange={(event) => setNumero(event.target.value)} placeholder="123 ou s/n" autoComplete="address-line2" required />
                </motion.div>
                <motion.div>
                  <label className={labelClass}>Complemento <span className="font-medium normal-case tracking-normal text-zinc-500">(opcional)</span></label>
                  <input className={fieldShell} value={complemento} onChange={(event) => setComplemento(event.target.value)} placeholder="Fundos, salão, referência..." />
                </motion.div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_82px]">
                <motion.div>
                  <label className={labelClass}>Bairro</label>
                  <input className={fieldShell} value={bairro} onChange={(event) => setBairro(event.target.value)} required />
                </motion.div>
                <motion.div>
                  <label className={labelClass}>Cidade</label>
                  <input className={fieldShell} value={cidade} onChange={(event) => setCidade(event.target.value)} autoComplete="address-level2" required />
                </motion.div>
                <motion.div>
                  <label className={labelClass}>UF</label>
                  <input className={fieldShell} value={estado} onChange={(event) => setEstado(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} maxLength={2} autoComplete="address-level1" required />
                </motion.div>
              </div>

              <motion.div>
                <label className={labelClass}>Apresentação da casa <span className="font-medium normal-case tracking-normal text-zinc-500">(opcional)</span></label>
                <textarea
                  value={descricaoPublica}
                  onChange={(event) => setDescricaoPublica(event.target.value.slice(0, 1200))}
                  className="min-h-[86px] w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[14px] font-medium leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Conte brevemente a história, a tradição e como a casa acolhe a comunidade."
                />
                <p className="mt-1 text-right text-[10px] font-semibold text-[#81786c]">{descricaoPublica.length}/1200</p>
              </motion.div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#b8a67f] bg-[#fffaf0] px-4 py-3 transition hover:border-[#9a7400]">
                <input
                  type="file"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)}
                />
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe3c5] text-[#916a12]"><Camera className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-[#102219]">{profilePhoto?.name || 'Adicionar foto da casa'}</strong>
                  <small className="mt-0.5 block text-[11px] text-[#746c60]">Opcional · JPG, PNG ou WebP · até 5 MB</small>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d6c9ad] bg-white px-4 py-3.5">
                <input type="checkbox" checked={publicarNoMapa} onChange={(event) => setPublicarNoMapa(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1f684c]" />
                <span className="text-[12px] leading-relaxed text-[#514b40]"><strong className="block text-[#173c2e]">Autorizo incluir esta casa no mapa público do AxéCloud.</strong>Nome, apresentação, foto e localização informados ficarão visíveis. E-mail e senha nunca serão publicados.</span>
              </label>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => { setError(null); setStep(1); }} className="h-[46px] rounded-xl border border-[#cfc2a6] px-5 text-[12px] font-black uppercase tracking-[0.05em] text-[#4f493d] sm:w-36">Voltar</button>
                <button type="button" onClick={continueAddress} className="flex h-[46px] flex-1 items-center justify-center rounded-xl bg-[#123f2f] text-[13px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-[#0d3326]">Continuar para o acesso</button>
              </div>
            </motion.div>
            ) : (
            <motion.div
              key="register-access"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 gap-4 max-lg:gap-5 sm:grid-cols-2"
            >
              <motion.div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  className={fieldShell}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="zelador@terreiro.com"
                  required
                  autoComplete="email"
                />
              </motion.div>
              <motion.div>
                <label className={labelClass}>WhatsApp <span className="font-medium normal-case tracking-normal text-zinc-500">(opcional)</span></label>
                <input
                  className={fieldShell}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </motion.div>
              <motion.div className="sm:col-span-2">
                <label className={labelClass}>Senha</label>
                <motion.div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    className={cn(
                      fieldShell,
                      'pr-11',
                      passwordError && 'border-red-500 focus:border-red-600 focus:ring-red-500/20'
                    )}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Senha forte"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby="register-password-rules register-password-error"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-800"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </motion.div>
                <div
                  id="register-password-rules"
                  className="mt-2 flex flex-wrap gap-x-3 gap-y-1"
                  aria-label={PASSWORD_HINT_PT}
                >
                  {passwordRules.map((rule) => (
                    <span
                      key={rule.label}
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-medium',
                        rule.valid ? 'text-emerald-700' : 'text-zinc-500'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-3 w-3 items-center justify-center rounded-full border',
                          rule.valid
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-zinc-400 bg-white'
                        )}
                        aria-hidden
                      >
                        {rule.valid ? <Check className="h-2 w-2" strokeWidth={3} /> : null}
                      </span>
                      {rule.label}
                    </span>
                  ))}
                </div>
                {passwordError ? (
                  <p id="register-password-error" className="mt-1.5 text-[11px] font-semibold text-red-700">
                    {passwordError}
                  </p>
                ) : null}
              </motion.div>
            </motion.div>
            )}

            {step === 3 ? <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.99 }}
              style={{ background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)` }}
              className="flex h-[44px] w-full items-center justify-center gap-2 rounded-lg text-[13px] font-black uppercase tracking-[0.06em] text-black shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Criar minha conta e começar`
              )}
            </motion.button> : null}

            {step === 3 ? <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-zinc-600">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
              Sem cartão · cancele quando quiser · nada é cobrado automaticamente
            </p> : null}
            {step === 3 ? <button type="button" onClick={() => { setError(null); setStep(2); }} className="mx-auto text-[12px] font-bold text-zinc-500 hover:text-zinc-900 hover:underline">Voltar para endereço e Radar</button> : null}
          </form>

          <p className="mt-6 text-center text-[13px] text-zinc-700">
            Já tem conta?{' '}
            <a href={ROUTES.login} className="font-bold text-amber-800 hover:text-amber-900 hover:underline">
              Fazer login
            </a>
          </p>
        </motion.div>
      </main>
    </motion.div>
  );
}
