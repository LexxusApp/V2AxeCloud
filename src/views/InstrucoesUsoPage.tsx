import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Flame,
  KeyRound,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ROUTES } from '../lib/routes';
import { cn } from '../lib/utils';

type Audience = 'zelador' | 'membro';

const font = "[font-family:'Outfit',system-ui,sans-serif]";
const display = "[font-family:'Fraunces',Georgia,serif]";

type GuideBlock = {
  icon: LucideIcon;
  title: string;
  body: string;
  emphasis?: boolean;
};

const ZELADOR_BLOCKS: GuideBlock[] = [
  {
    icon: Users,
    title: 'Cadastre os filhos de santo',
    body: 'Nome, WhatsApp com DDD certo e os 6 dígitos da senha de acesso. Ao salvar, o AxéCloud envia o registro automaticamente pelo WhatsApp oficial da plataforma.',
  },
  {
    icon: KeyRound,
    title: 'Como o membro entra',
    body: 'Peça para abrir axecloud.com.br/entrar → escolher Membro → digitar o Registro (AXC-…) + os 6 primeiros dígitos do CPF. Não é senha de e-mail nem do WhatsApp.',
    emphasis: true,
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp — sem conectar o seu celular',
    body: 'Os avisos saem pelo canal WhatsApp Business oficial do AxéCloud (Meta). Você não escaneia QR Code nem pareia o aparelho. Em Configurações → WhatsApp, só liga as automações e confere o número de cada membro antes de disparar.',
    emphasis: true,
  },
  {
    icon: CalendarDays,
    title: 'Eventos e giras',
    body: 'Crie giras e eventos, convide convidados externos, acompanhe confirmações (RSVP) e envie avisos pelo WhatsApp da plataforma.',
  },
  {
    icon: Wallet,
    title: 'Financeiro e mensalidades',
    body: 'Controle mensalidades, registre pagamentos e envie cobranças quando precisar — sempre pelo canal oficial do AxéCloud.',
  },
  {
    icon: CircleHelp,
    title: 'Suporte',
    body: 'Se algo travar, use o menu Suporte no painel. A equipe AxéCloud responde por lá.',
  },
];

const MEMBRO_STEPS: GuideBlock[] = [
  {
    icon: Sparkles,
    title: 'Escolha Membro no login',
    body: 'Abra axecloud.com.br/entrar e toque em Membro (filho de santo). Não use a tela do Zelador — e-mail e senha são só da gestão da casa.',
  },
  {
    icon: Users,
    title: 'Digite o Registro',
    body: 'Use o código que chegou no WhatsApp da casa (formato AXC-ANO-XXXX). Pode digitar sem hífen; o sistema formata sozinho.',
  },
  {
    icon: KeyRound,
    title: 'Senha = 6 dígitos do CPF',
    body: 'Digite só os 6 primeiros números do CPF. Ex.: 123.456.789-00 → 123456. Não é a senha do WhatsApp nem de e-mail.',
  },
];

const MEMBRO_FEATURES: GuideBlock[] = [
  {
    icon: CalendarDays,
    title: 'Giras',
    body: 'Veja a agenda da casa e confirme se você vai participar.',
  },
  {
    icon: Wallet,
    title: 'Mensalidade',
    body: 'Confira pendências e pague com Pix quando a casa cobrar.',
  },
  {
    icon: Flame,
    title: 'Obrigações',
    body: 'Leia orientações e preceitos da sua caminhada.',
  },
  {
    icon: Megaphone,
    title: 'Comunicados',
    body: 'Receba recados e avisos publicados pela casa.',
  },
  {
    icon: MessageCircle,
    title: 'Conversas',
    body: 'Fale diretamente com a casa pelo chat do app.',
  },
  {
    icon: BookOpen,
    title: 'Biblioteca e loja',
    body: 'Estude materiais liberados e reserve itens da loja da casa.',
  },
];

export default function InstrucoesUsoPage({ audience = 'zelador' }: { audience?: Audience }) {
  const isMembro = audience === 'membro';

  return (
    <div className={cn('relative isolate min-h-[100dvh] overflow-x-hidden bg-[#f4efe4] text-[#1b1813] antialiased', font)}>
      {/* Atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(245,184,0,0.18),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(27,24,19,0.08),transparent_45%),linear-gradient(180deg,#faf6ec_0%,#f4efe4_42%,#ebe4d6_100%)]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:radial-gradient(rgba(120,82,0,.35)_0.55px,transparent_0.55px)] [background-size:22px_22px]" />
        <div className="absolute -left-40 top-[-10%] h-[28rem] w-[28rem] rounded-full bg-[#f0b400]/15 blur-3xl" />
        <div className="absolute -right-32 bottom-[10%] h-[26rem] w-[26rem] rounded-full bg-[#1b1813]/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
        <a
          href={ROUTES.login}
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-[#1b1813]/55 transition-colors hover:text-[#a87500]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Voltar ao login
        </a>

        {/* Hero composition */}
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-10 overflow-hidden rounded-[1.75rem] border border-[#1b1813]/10 bg-[#1b1813] text-[#faf8f4] shadow-[0_28px_80px_rgba(27,24,19,0.22)] sm:mb-12 sm:rounded-[2rem]"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-[#e5ad1a]/20" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full border border-[#e5ad1a]/10" aria-hidden />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(229,173,26,.22),transparent_42%)]" aria-hidden />
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(255,215,111,.85)_0.5px,transparent_0.5px)] [background-size:18px_18px]" aria-hidden />

          <div className="relative grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:p-12">
            <div className="space-y-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[#e5ad1a]/45 text-lg text-[#e5ad1a]">
                  ✦
                </span>
                <span className={cn('text-2xl tracking-[-0.04em]', display)}>
                  Axé<span className="text-[#e5ad1a]">Cloud</span>
                </span>
              </div>

              <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#d6a526]">
                {isMembro ? 'Guia do membro' : 'Guia do zelador'}
              </p>
              <h1
                className={cn(
                  'max-w-[14ch] text-[2.35rem] font-medium leading-[0.98] tracking-[-0.045em] sm:text-[3rem]',
                  display
                )}
              >
                {isMembro ? 'Como entrar na corrente.' : 'Como cuidar da casa no app.'}
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-white/60">
                {isMembro
                  ? 'Três passos. Sem e-mail, sem senha de WhatsApp — só o registro da casa e o início do CPF.'
                  : 'Do cadastro dos filhos aos avisos: o essencial para a casa funcionar sem confusão no primeiro acesso.'}
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={isMembro ? `${ROUTES.login}?modo=filho` : `${ROUTES.login}?modo=zelador`}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#f5b800] px-6 text-sm font-bold text-[#17130c] transition hover:-translate-y-0.5 hover:bg-[#ffc318]"
                >
                  Ir para o login
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <a
                  href={isMembro ? ROUTES.instrucoes : ROUTES.instrucoesMembro}
                  className="inline-flex h-12 items-center rounded-full border border-white/20 px-5 text-sm font-semibold text-[#f0bd36] transition hover:border-[#e5ad1a]/55 hover:bg-white/[0.04]"
                >
                  {isMembro ? 'Sou zelador' : 'Sou membro'}
                </a>
              </div>
            </div>

            <div className="flex flex-col justify-end gap-3">
              <AudienceSwitch isMembro={isMembro} />
              {!isMembro ? (
                <div className="rounded-[1.25rem] border border-[#e5ad1a]/25 bg-[#e5ad1a]/[0.08] p-4">
                  <div className="mb-2 flex items-center gap-2 text-[#e5ad1a]">
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Importante</span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/75">
                    Você <strong className="font-semibold text-white">não conecta o WhatsApp pessoal</strong> no
                    AxéCloud. Os envios saem pelo canal Business oficial da plataforma.
                  </p>
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-[#e5ad1a]/25 bg-[#e5ad1a]/[0.08] p-4">
                  <div className="mb-2 flex items-center gap-2 text-[#e5ad1a]">
                    <KeyRound className="h-4 w-4" aria-hidden />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Lembrete</span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/75">
                    Exemplo: CPF <span className="font-mono text-[#f0bd36]">123.456.789-00</span> → senha{' '}
                    <span className="font-mono font-bold text-white">123456</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.header>

        {isMembro ? <MembroGuide /> : <ZeladorGuide />}
      </div>
    </div>
  );
}

function AudienceSwitch({ isMembro }: { isMembro: boolean }) {
  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-full border border-white/15 bg-black/25 p-1"
      role="tablist"
      aria-label="Tipo de guia"
    >
      <a
        href={ROUTES.instrucoes}
        role="tab"
        aria-selected={!isMembro}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] transition',
          !isMembro ? 'bg-[#f5b800] text-[#17130c]' : 'text-white/55 hover:text-white/85'
        )}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Zelador
      </a>
      <a
        href={ROUTES.instrucoesMembro}
        role="tab"
        aria-selected={isMembro}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] transition',
          isMembro ? 'bg-[#f5b800] text-[#17130c]' : 'text-white/55 hover:text-white/85'
        )}
      >
        <Users className="h-3.5 w-3.5" aria-hidden />
        Membro
      </a>
    </div>
  );
}

function ZeladorGuide() {
  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="rounded-[1.5rem] border border-[#c48a00]/30 bg-[#fff8e8] p-6 sm:p-8"
      >
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#aa7600]">
          O que mais confunde a casa
        </p>
        <h2 className={cn('mb-3 text-[1.75rem] font-medium tracking-[-0.03em] text-[#1b1813]', display)}>
          Oriente seus membros assim
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            'Abrir /entrar e escolher Membro',
            'Digitar o Registro AXC-…',
            'Senha = 6 dígitos do CPF',
          ].map((step, i) => (
            <li
              key={step}
              className="rounded-[1.1rem] border border-[#1b1813]/08 bg-white/70 px-4 py-4"
            >
              <span className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#b47d00]">
                Passo {i + 1}
              </span>
              <p className="text-sm font-semibold leading-snug text-[#1b1813]">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-[#1b1813]/55">
          Guia completo para eles:{' '}
          <a href={ROUTES.instrucoesMembro} className="font-semibold text-[#a87500] underline-offset-2 hover:underline">
            axecloud.com.br/instrucoes/membro
          </a>
        </p>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-2">
        {ZELADOR_BLOCKS.map((block, index) => (
          <GuideTile key={block.title} block={block} index={index} />
        ))}
      </div>
    </div>
  );
}

function MembroGuide() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {MEMBRO_STEPS.map((step, index) => (
          <motion.article
            key={step.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
            className="relative overflow-hidden rounded-[1.5rem] border border-[#1b1813]/10 bg-[#fffdf8] p-6 shadow-[0_18px_50px_rgba(73,52,13,0.06)]"
          >
            <span
              className={cn(
                'mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#c48a00]/35 bg-[#f5e5b5]/40 text-xl font-medium text-[#7b5700]',
                display
              )}
            >
              {index + 1}
            </span>
            <div className="mb-3 flex items-center gap-2 text-[#b47d00]">
              <step.icon className="h-4 w-4" aria-hidden />
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1b1813]">{step.title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-[#1b1813]/70">{step.body}</p>
          </motion.article>
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4 }}
        className="rounded-[1.5rem] border border-[#c48a00]/30 bg-[#fff8e8] p-6 sm:p-8"
      >
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#aa7600]">
          Depois de entrar
        </p>
        <h2 className={cn('mb-2 text-[1.75rem] font-medium tracking-[-0.03em] text-[#1b1813]', display)}>
          O que você pode fazer no app
        </h2>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-[#1b1813]/65">
          No portal do membro: giras, mensalidade, obrigações, recados e chat com a casa — além de biblioteca e loja.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MEMBRO_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[1.1rem] border border-[#1b1813]/08 bg-white/75 px-4 py-4"
            >
              <div className="mb-2 flex items-center gap-2 text-[#b47d00]">
                <feature.icon className="h-4 w-4" aria-hidden />
                <h3 className="text-sm font-semibold text-[#1b1813]">{feature.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-[#1b1813]/70">{feature.body}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="rounded-[1.5rem] border border-[#1b1813]/10 bg-[#1b1813] p-6 text-[#faf8f4] sm:p-8"
      >
        <h2 className={cn('mb-2 text-2xl font-medium tracking-[-0.03em]', display)}>Não consegue entrar?</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-white/60">
          Confira se escolheu <strong className="text-white">Membro</strong>, se o registro está igual ao do
          WhatsApp e se os 6 dígitos estão corretos. Se ainda falhar, peça ao zelador para reenviar o acesso
          na ficha do filho.
        </p>
      </motion.section>
    </div>
  );
}

function GuideTile({ block, index }: { block: GuideBlock; index: number }) {
  const Icon = block.icon;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05, duration: 0.35 }}
      className={cn(
        'rounded-[1.35rem] border p-5 sm:p-6',
        block.emphasis
          ? 'border-[#c48a00]/40 bg-[#fff8e8]'
          : 'border-[#1b1813]/08 bg-[#fffdf8]/90'
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-full border',
            block.emphasis
              ? 'border-[#c48a00]/40 bg-[#f5e5b5]/50 text-[#7b5700]'
              : 'border-[#1b1813]/10 bg-[#f4efe4] text-[#b47d00]'
          )}
        >
          <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden />
        </span>
        <h3 className="pt-1.5 text-[1.05rem] font-semibold tracking-[-0.02em] text-[#1b1813]">
          {block.title}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-[#1b1813]/70">{block.body}</p>
    </motion.article>
  );
}
