import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { getConversionContext, trackConversionEvent } from '../../lib/trackConversion';
import { PASSWORD_HINT_PT, validateStrongPassword } from '../../../lib/passwordPolicy';
import { TRIAL_DAYS } from '../../../lib/planPricing';
import { AuthScreenBackground } from '../AuthScreenBackground';

type ClaimActivationPayload = {
  claimId: string;
  protocol: string;
  status: string;
  canRegister: boolean;
  nomeTerreiro: string;
  nomeZelador: string;
  email: string;
  whatsapp: string;
  cidade: string;
  estado: string;
  photoUrl: string | null;
  coverPhotoUrl: string | null;
  publicacaoStatus: string;
  terreiro: { nome: string; slug: string };
};

async function recordProgress(claimId: string, event: 'opened' | 'started') {
  await fetch(
    '/api/v1/public/diretorio/reivindicacao/' + encodeURIComponent(claimId) + '/progresso',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ event }),
    },
  ).catch(() => undefined);
}

export function ClaimActivationExperience({ claimId }: { claimId: string }) {
  const [claim, setClaim] = useState<ClaimActivationPayload | null>(null);
  const [loadingClaim, setLoadingClaim] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const passwordRules = [
    { label: '8+ caracteres', valid: password.length >= 8 },
    { label: 'minúscula', valid: /[a-z]/.test(password) },
    { label: 'maiúscula', valid: /[A-Z]/.test(password) },
    { label: 'número', valid: /\d/.test(password) },
    { label: 'símbolo', valid: /[^A-Za-z0-9]/.test(password) },
  ] as const;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          '/api/v1/public/diretorio/reivindicacao/' + encodeURIComponent(claimId) + '/cadastro',
        );
        const payload = await response.json().catch(() => ({})) as ClaimActivationPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Não foi possível abrir este convite.');
        if (cancelled) return;
        setClaim(payload);
        void recordProgress(claimId, 'opened');
        void trackConversionEvent('claim_activation_opened', {
          ctaId: 'claim-activation-opened',
          metadata: { claimId },
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível abrir este convite.');
        }
      } finally {
        if (!cancelled) setLoadingClaim(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    void recordProgress(claimId, 'started');
    void trackConversionEvent('claim_activation_started', {
      ctaId: 'claim-activation-password',
      metadata: { claimId },
    });
  }

  async function activate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const check = validateStrongPassword(password);
    if (check.ok === false) {
      setError('Revise a senha: ' + check.message);
      return;
    }
    if (!claim?.canRegister) {
      setError('Este convite ainda não está disponível para ativação.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          password,
          billingCycle: 'monthly',
          conversion: getConversionContext(),
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        tenantId?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Não foi possível ativar sua casa.');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: claim.email,
        password,
      });
      if (signInError) {
        window.location.href = ROUTES.login;
        return;
      }
      window.location.href = appHref(ROUTES.dashboard + '?reivindicacao=ativada');
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Não foi possível ativar sua casa.');
    } finally {
      setSubmitting(false);
    }
  }

  const visual = claim?.coverPhotoUrl || claim?.photoUrl;

  return (
    <div className="min-h-dvh bg-[#f1ede4] px-0 py-0 text-[#142119] sm:px-5 sm:py-5 lg:grid lg:place-items-center">
      <main className="mx-auto grid min-h-dvh w-full max-w-6xl overflow-hidden bg-[#fffdf8] shadow-[0_30px_90px_rgba(18,33,25,.18)] sm:min-h-0 sm:rounded-3xl sm:border sm:border-[#d9d0c0] lg:grid-cols-[minmax(0,0.92fr)_minmax(30rem,1.08fr)]">
        <section className="relative min-h-[16rem] overflow-hidden bg-[#071a12] text-white sm:min-h-[20rem] lg:min-h-[42rem]">
          {visual ? (
            <img src={visual} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          ) : (
            <AuthScreenBackground className="absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,18,12,.2),rgba(3,18,12,.92))]" aria-hidden />
          <div className="relative flex h-full min-h-[16rem] flex-col justify-between p-6 sm:min-h-[20rem] sm:p-9 lg:min-h-[42rem] lg:p-12">
            <a href={ROUTES.home} className="inline-flex w-fit items-center gap-3 rounded-xl bg-black/25 px-3 py-2 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efbd14]">
              <img src="/axecloud-trident.png" alt="" className="h-8 w-7 object-contain" />
              <strong className="text-sm">AxéCloud</strong>
            </a>
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/14 px-3 py-1.5 text-xs font-bold text-emerald-200">
                <BadgeCheck className="h-4 w-4" /> Responsabilidade confirmada
              </span>
              <h1 className="mt-4 text-balance text-3xl font-black leading-[1.04] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                {claim?.nomeTerreiro || 'Sua casa está pronta para ser ativada.'}
              </h1>
              {claim ? (
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/72">
                  <MapPin className="h-4 w-4 text-[#efbd14]" />
                  {[claim.cidade, claim.estado].filter(Boolean).join(', ') || 'Perfil público AxéCloud'}
                </p>
              ) : null}
              <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-white/68">
                O perfil já foi verificado. Ao ativar, você assume as fotos, a biografia, os contatos e as informações públicas no Radar.
              </p>
            </div>
          </div>
        </section>

        <section className="flex min-h-[32rem] items-center px-6 py-9 sm:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-lg">
            {loadingClaim ? (
              <div className="grid min-h-72 place-items-center" role="status">
                <div className="text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#9b7200]" />
                  <p className="mt-3 text-sm font-semibold text-[#5f665f]">Preparando os dados da sua casa…</p>
                </div>
              </div>
            ) : claim ? (
              <>
                <div className="flex items-center gap-3">
                  {claim.photoUrl ? (
                    <img src={claim.photoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-[#d8ceb9]" />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#123f2f] text-[#efbd14]"><ShieldCheck className="h-6 w-6" /></span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#142119]">Olá, {claim.nomeZelador.split(/\s+/)[0] || 'responsável'}.</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#777166]">Protocolo {claim.protocol}</p>
                  </div>
                </div>

                <h2 className="mt-7 text-balance text-3xl font-black leading-tight tracking-[-0.035em] text-[#142119] sm:text-4xl">
                  Falta apenas criar seu acesso.
                </h2>
                <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[#62675f]">
                  Não vamos pedir novamente endereço, fotos ou documentos. Crie sua senha e entre direto no painel da casa.
                </p>

                <div className="mt-6 rounded-2xl border border-[#dcd3c3] bg-[#f7f2e8] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <LockKeyhole className="h-5 w-5 shrink-0 text-[#8c690b]" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#4f564f]">E-mail confirmado na reivindicação</p>
                      <p className="mt-0.5 truncate text-sm font-black text-[#142119]">{claim.email}</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={activate} className="mt-5">
                  <label htmlFor="claim-password" className="block text-sm font-black text-[#142119]">Crie sua senha</label>
                  <div className="relative mt-2">
                    <input
                      id="claim-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError(null);
                        markStarted();
                      }}
                      autoComplete="new-password"
                      aria-describedby="claim-password-rules claim-activation-error"
                      aria-invalid={Boolean(error)}
                      placeholder="Digite uma senha segura"
                      className="h-13 w-full rounded-xl border border-[#cfc6b7] bg-white px-4 pr-12 text-base font-semibold outline-none transition-[border-color,box-shadow] focus:border-[#9b7200] focus:ring-4 focus:ring-[#efbd14]/18"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-[#62675f] hover:bg-[#f1ede4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7200]"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div id="claim-password-rules" className="mt-3 flex flex-wrap gap-x-3 gap-y-2" aria-label={PASSWORD_HINT_PT}>
                    {passwordRules.map((rule) => (
                      <span key={rule.label} className={rule.valid ? 'inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700' : 'inline-flex items-center gap-1.5 text-xs font-semibold text-[#7d7a72]'}>
                        <span className={rule.valid ? 'grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white' : 'h-4 w-4 rounded-full border border-[#bdb5a8]'}>
                          {rule.valid ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                        </span>
                        {rule.label}
                      </span>
                    ))}
                  </div>

                  {error ? (
                    <p id="claim-activation-error" role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-relaxed text-red-800">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#efbd14] px-5 text-sm font-black text-[#142119] shadow-[0_12px_28px_rgba(186,131,0,.2)] transition-[background-color,transform] hover:bg-[#ffd143] active:scale-[.99] disabled:cursor-wait disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    {submitting ? 'Ativando sua casa…' : 'Ativar e administrar minha casa'}
                    {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
                  </button>
                </form>

                <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-[#666b64]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#387355]" />
                  <p>{TRIAL_DAYS} dias para conhecer o sistema, sem cartão e sem cobrança automática. Depois da ativação, você completa biografia e fotos no Radar.</p>
                </div>
                <p className="mt-6 text-center text-xs font-semibold text-[#6f706b]">
                  Já possui uma conta? <a href={ROUTES.login} className="font-black text-[#765700] underline underline-offset-4">Entrar no AxéCloud</a>
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-red-700" />
                <h2 className="mt-3 text-xl font-black text-red-950">Não foi possível abrir este convite.</h2>
                <p className="mt-2 text-sm leading-relaxed text-red-800">{error || 'Confira se o link está completo ou peça um novo envio.'}</p>
                <a href={ROUTES.login} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#142119] px-5 text-sm font-black text-white">Ir para o acesso</a>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
