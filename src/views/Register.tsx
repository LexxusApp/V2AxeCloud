import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../lib/routes';
import { LANDING_PRICE } from '../constants/landingFeatures';

const GOLD = '#f2b90f';
const fontLogin = '[font-family:Montserrat,system-ui,sans-serif]';
const bgImage = `${import.meta.env.BASE_URL}login-bg-premium.png`;

const highlights = [
  'Filhos de santo, mural e calendário no mesmo fluxo',
  'Financeiro com Pix e histórico transparente',
  'Galeria, biblioteca e loja do axé quando precisar',
] as const;

const fieldShell = cn(
  'w-full h-[42px] rounded-lg border border-zinc-300 bg-white px-3',
  'text-[14px] font-medium text-zinc-900 placeholder:text-zinc-500',
  'outline-none transition-[border-color,box-shadow] duration-200',
  'focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
);

const labelClass =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-800';

export default function Register() {
  const [nomeTerreiro, setNomeTerreiro] = useState('');
  const [nomeZelador, setNomeZelador] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível concluir o cadastro.');
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        console.warn('[register] auto-login:', signInErr.message);
      }

      const checkoutPath =
        data.checkoutPath || (data.tenantId ? `/checkout?tenant=${data.tenantId}` : null);
      if (checkoutPath) {
        window.location.href = checkoutPath;
      } else {
        setError('Cadastro criado, mas o pagamento não pôde ser iniciado. Entre em contato com o suporte.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('fixed inset-0 z-[100] flex flex-col overflow-hidden antialiased lg:flex-row', fontLogin)}
    >
      {/* Painel esquerdo — imagem + mensagem */}
      <aside
        className="relative flex min-h-[220px] shrink-0 flex-col justify-between overflow-hidden bg-black lg:min-h-0 lg:w-[52%] xl:w-[55%]"
        aria-label="Sobre o AxéCloud"
      >
        <img
          src={bgImage}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center brightness-[0.75]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-black/90"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col p-6 sm:p-8 lg:p-10">
          <a
            href={ROUTES.home}
            className="inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </a>

          <div className="my-auto max-w-xl space-y-5 py-6 lg:py-10">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#f2b90f]">AxéCloud</p>
              <h1 className="mt-3 text-[clamp(1.35rem,3vw,1.85rem)] font-extrabold leading-[1.15] tracking-tight text-white">
                A casa organizada.
                <span className="block text-white/90">O axé em primeiro lugar.</span>
              </h1>
              <p className="mt-4 text-[14px] leading-relaxed text-white/75 sm:text-[15px]">
                Você cuida do terreiro com respeito — nós cuidamos da parte que cansa: cadastros,
                mensalidades, comunicados e memória da sua casa, num só lugar.
              </p>
            </div>

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
              <span className="font-bold text-[#f2b90f]">
                {LANDING_PRICE.label}
                {LANDING_PRICE.period}
              </span>
              {' · '}Pix ou cartão · painel liberado na hora após o pagamento.
            </p>
          </div>

          <p className="text-[11px] text-white/40">Gestão sagrada para zeladores e terreiros.</p>
        </div>
      </aside>

      {/* Painel direito — formulário */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white text-zinc-900">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-6 py-8 sm:px-10 sm:py-10">
          <header className="mb-6">
            <h2 className="text-[22px] font-extrabold tracking-tight text-zinc-900 sm:text-[24px]">
              Cadastre seu terreiro
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-700">
              Preencha os dados abaixo. Em seguida você escolhe Pix ou cartão no checkout seguro.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-snug text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Nome do terreiro</label>
                <input
                  className={fieldShell}
                  value={nomeTerreiro}
                  onChange={(e) => setNomeTerreiro(e.target.value)}
                  placeholder="Ilê Axé Exemplo"
                  required
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className={labelClass}>Seu nome (zelador)</label>
                <input
                  className={fieldShell}
                  value={nomeZelador}
                  onChange={(e) => setNomeZelador(e.target.value)}
                  placeholder="Como é conhecido na casa"
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <label className={labelClass}>WhatsApp</label>
                <input
                  className={fieldShell}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="sm:col-span-2">
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
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={cn(fieldShell, 'pr-11')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-800"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.99 }}
              style={{ background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)` }}
              className="flex h-[44px] w-full items-center justify-center gap-2 rounded-lg text-[13px] font-black uppercase tracking-[0.06em] text-black shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Criar terreiro e pagar
                </>
              )}
            </motion.button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-zinc-600">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
              Checkout EFI Bank · {LANDING_PRICE.label}/mês
            </p>
          </form>

          <p className="mt-6 text-center text-[13px] text-zinc-700">
            Já tem conta?{' '}
            <a href={ROUTES.login} className="font-bold text-amber-800 hover:text-amber-900 hover:underline">
              Fazer login
            </a>
          </p>
        </div>
      </main>
    </motion.div>
  );
}
