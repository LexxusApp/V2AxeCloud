import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Landmark,
  Network,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import type { CommercialPageContent } from '../constants/commercialPagesContent';
import { COMMERCIAL_PAGES, COMMERCIAL_ROUTES } from '../constants/commercialPagesContent';
import { MarketingMockupFooter } from '../components/marketing/MarketingMockupFooter';
import { RegisterTrialLink } from '../components/marketing/RegisterTrialLink';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { ROUTES } from '../lib/routes';

const pageIcons = {
  system: Network,
  financial: Landmark,
  dues: CircleDollarSign,
  members: UsersRound,
} as const;

const pageAccent = {
  system: '#e5ae12',
  financial: '#53b58a',
  dues: '#d99a2b',
  members: '#b75b45',
} as const;

const relatedByPage: Record<CommercialPageContent['key'], readonly string[]> = {
  system: [COMMERCIAL_ROUTES.financial, COMMERCIAL_ROUTES.dues, COMMERCIAL_ROUTES.members],
  financial: [COMMERCIAL_ROUTES.dues, COMMERCIAL_ROUTES.system, '/recursos/financeiro-pix-mensalidades'],
  dues: [COMMERCIAL_ROUTES.financial, COMMERCIAL_ROUTES.members, '/recursos/whatsapp-oficial'],
  members: [COMMERCIAL_ROUTES.system, COMMERCIAL_ROUTES.dues, '/recursos/portal-filho-de-santo'],
};

const resourceNames: Record<string, { title: string; description: string }> = {
  '/recursos/financeiro-pix-mensalidades': {
    title: 'Financeiro, Pix e mensalidades',
    description: 'Veja o funcionamento específico do módulo financeiro.',
  },
  '/recursos/whatsapp-oficial': {
    title: 'WhatsApp oficial',
    description: 'Comunicação privada e rastreável para a rotina da casa.',
  },
  '/recursos/portal-filho-de-santo': {
    title: 'Portal do filho de santo',
    description: 'O acesso individual e separado do painel administrativo.',
  },
};

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.16 },
  transition: { duration: 0.58, ease: [0.22, 1, 0.36, 1] },
} as const;

function ManagementMap({ page }: { page: CommercialPageContent }) {
  const Icon = pageIcons[page.key];
  const accent = pageAccent[page.key];
  const labels = page.capabilities.map((item) => item.title);

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#11150f] p-5 shadow-[0_40px_90px_rgba(0,0,0,.34)] sm:p-7" aria-label={`Mapa conceitual: ${page.kicker}`}>
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(229,174,18,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.09)_1px,transparent_1px)] [background-size:54px_54px]" aria-hidden />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/10 shadow-[0_0_0_55px_rgba(255,255,255,.018),0_0_0_110px_rgba(255,255,255,.012)]" aria-hidden />

      <div className="relative flex items-center justify-between border-b border-white/10 pb-4">
        <span className="text-[10px] font-black uppercase tracking-[.22em] text-[#8f948a]">Fluxo da gestão</span>
        <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[.18em] text-[#58d9a5]">
          <i className="h-2 w-2 rounded-full bg-current shadow-[0_0_14px_currentColor]" /> conectado
        </span>
      </div>

      <div className="relative mt-7 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] sm:grid-rows-2">
        {labels.map((label, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.16 + index * 0.08, duration: 0.45 }}
            className={`min-h-28 rounded-xl border border-white/10 bg-[#161b14]/90 p-4 ${
              index === 0
                ? 'sm:col-start-1 sm:row-start-1'
                : index === 1
                  ? 'sm:col-start-3 sm:row-start-1'
                  : index === 2
                    ? 'sm:col-start-1 sm:row-start-2'
                    : 'sm:col-start-3 sm:row-start-2'
            }`}
          >
            <span className="text-[9px] font-black tracking-[.15em] text-[#72776f]">0{index + 1}</span>
            <p className="mt-7 max-w-[12rem] text-sm font-extrabold leading-tight text-[#f3eee2]">{label}</p>
          </motion.div>
        ))}
        <div className="relative z-10 hidden h-28 w-28 place-items-center self-center rounded-2xl border border-[#e5ae12]/45 bg-[#090b08] shadow-[0_18px_50px_rgba(0,0,0,.55)] sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:grid">
          <span className="absolute inset-3 rounded-xl border border-white/[.07]" />
          <Icon className="h-9 w-9" style={{ color: accent }} strokeWidth={1.7} aria-hidden />
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between text-[9px] font-black uppercase tracking-[.18em] text-[#737970]">
        <span>Uma base</span>
        <span style={{ color: accent }}>Uma direção</span>
      </div>
    </div>
  );
}

function RelatedLink({ href }: { href: string }) {
  const commercial = COMMERCIAL_PAGES.find((item) => item.path === href);
  const title = commercial?.kicker || resourceNames[href]?.title || 'Conheça o AxéCloud';
  const description = commercial?.promise || resourceNames[href]?.description || 'Veja como a gestão se conecta.';

  return (
    <a href={href} className="group flex min-h-48 flex-col justify-between rounded-2xl border border-[#d9d0c0] bg-[#fffdf8] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#b9870c] hover:shadow-[0_20px_50px_rgba(53,43,20,.1)]">
      <div>
        <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#9a6d00]">Próximo caminho</span>
        <h3 className="mt-4 text-xl font-extrabold leading-tight tracking-[-.03em] text-[#1b1813]">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[#665f53]">{description}</p>
      </div>
      <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#1f563f]">Abrir página <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
    </a>
  );
}

export default function CommercialAcquisitionPage({ page }: { page: CommercialPageContent }) {
  const accent = pageAccent[page.key];

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#0a0d09] font-sans text-[#f4efe3]">
      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-32 sm:px-8 md:pb-28 md:pt-36">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(229,174,18,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,#000,transparent_92%)]" aria-hidden />
          <div className="pointer-events-none absolute left-[-15rem] top-10 h-[44rem] w-[44rem] rounded-full bg-[radial-gradient(circle,rgba(38,92,68,.24),transparent_68%)]" aria-hidden />

          <div className="relative mx-auto grid w-full max-w-[1180px] items-center gap-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,.98fr)]">
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}>
              <a href={ROUTES.recursos} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.23em] text-[#e5ae12] transition hover:text-[#f2c33e]">
                <span className="h-2 w-2 rounded-full bg-[#57d9a4] shadow-[0_0_14px_#57d9a4]" /> {page.kicker}
              </a>
              <h1 className="mt-7 max-w-[14ch] text-balance text-[clamp(2.8rem,6vw,5.6rem)] font-black leading-[.92] tracking-[-.065em] text-[#f7f1e5]">{page.h1}</h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-[#b7b7ae] md:text-lg">{page.lead}</p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <RegisterTrialLink className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#e5ae12] px-6 text-sm font-extrabold text-[#17150e] shadow-[0_16px_36px_rgba(229,174,18,.18)] transition hover:bg-[#f0bd25]">
                  Testar {TRIAL_DAYS} dias grátis <ArrowRight className="h-4 w-4" />
                </RegisterTrialLink>
                <a href="#como-funciona" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border border-white/15 px-6 text-sm font-bold text-[#f4efe3] transition hover:border-[#e5ae12]/55 hover:bg-white/[.04]">
                  Entender como funciona
                </a>
              </div>

              <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#7f857b]"><ShieldCheck className="h-4 w-4 text-[#58d9a5]" /> Sem cartão · ambiente privado · suporte humano</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.76, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}>
              <ManagementMap page={page} />
            </motion.div>
          </div>

          <div className="relative mx-auto mt-16 grid w-full max-w-[1180px] divide-y divide-white/10 border-y border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {page.proof.map((item) => (
              <div key={item.label} className="px-5 py-5 sm:px-7">
                <strong className="block text-xl font-black tracking-[-.04em]" style={{ color: accent }}>{item.value}</strong>
                <span className="mt-1 block text-xs text-[#8f948b]">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="relative bg-[#f5efe3] px-5 py-20 text-[#1b1813] sm:px-8 md:py-28">
          <div className="mx-auto w-full max-w-[1180px]">
            <motion.div {...reveal} className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]">Antes e depois da organização</span>
                <h2 className="mt-5 max-w-[12ch] text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">{page.promise}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-[#d9d0c0] bg-[#ebe3d5] p-6 sm:p-7">
                  <h3 className="text-sm font-extrabold text-[#665f53]">{page.contrast.beforeTitle}</h3>
                  <ul className="mt-6 space-y-4">
                    {page.contrast.before.map((item) => <li key={item} className="flex gap-3 text-sm text-[#6b6459]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ad4b39]" />{item}</li>)}
                  </ul>
                </div>
                <div className="rounded-3xl border border-[#1e5b43]/25 bg-[#1e5b43] p-6 text-white shadow-[0_22px_50px_rgba(30,91,67,.16)] sm:p-7">
                  <h3 className="text-sm font-extrabold text-[#dff6e9]">{page.contrast.afterTitle}</h3>
                  <ul className="mt-6 space-y-4">
                    {page.contrast.after.map((item) => <li key={item} className="flex gap-3 text-sm text-[#e7f1eb]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#f0bc27]" />{item}</li>)}
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="como-funciona" className="relative bg-[#fcfaf5] px-5 py-20 text-[#1b1813] sm:px-8 md:py-28">
          <div className="mx-auto w-full max-w-[1180px]">
            <motion.div {...reveal} className="max-w-3xl">
              <span className="text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]">Como funciona</span>
              <h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">{page.workflowTitle}</h2>
              <p className="mt-5 text-base leading-relaxed text-[#665f53]">{page.workflowLead}</p>
            </motion.div>

            <div className="relative mt-12 grid gap-4 lg:grid-cols-3">
              <div className="absolute left-8 right-8 top-12 hidden h-px bg-[#d7cbb8] lg:block" aria-hidden />
              {page.workflow.map((step) => (
                <motion.article key={step.number} {...reveal} className="relative rounded-3xl border border-[#ded5c6] bg-white p-7 shadow-[0_16px_44px_rgba(50,40,20,.055)]">
                  <span className="relative z-10 grid h-11 w-11 place-items-center rounded-full border border-[#c58e0b]/30 bg-[#fff8e6] text-xs font-black text-[#966900]">{step.number}</span>
                  <h3 className="mt-9 text-xl font-extrabold tracking-[-.03em]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#6a6358]">{step.body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#10140f] px-5 py-20 sm:px-8 md:py-28">
          <div className="mx-auto w-full max-w-[1180px]">
            <motion.div {...reveal} className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[.22em] text-[#e5ae12]">O que essa página resolve</span>
                <h2 className="mt-5 max-w-2xl text-4xl font-black leading-[.98] tracking-[-.055em] text-[#f4efe3] sm:text-5xl">Recursos que trabalham como uma só gestão.</h2>
              </div>
              <a href={ROUTES.recursos} className="inline-flex items-center gap-2 text-sm font-extrabold text-[#e5ae12]">Ver os 24 módulos <ArrowRight className="h-4 w-4" /></a>
            </motion.div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2">
              {page.capabilities.map((item, index) => (
                <motion.article key={item.title} {...reveal} className="relative min-h-56 bg-[#131812] p-7 sm:p-8">
                  <span className="text-[9px] font-black uppercase tracking-[.2em] text-[#e5ae12]">{item.tag}</span>
                  <h3 className="mt-8 text-2xl font-extrabold tracking-[-.035em] text-[#f4efe3]">{item.title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-[#9da298]">{item.body}</p>
                  <span className="absolute right-6 top-6 text-[10px] font-black text-white/20">0{index + 1}</span>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f5efe3] px-5 py-20 text-[#1b1813] sm:px-8 md:py-28">
          <div className="mx-auto w-full max-w-[1180px]">
            <motion.div {...reveal} className="grid gap-12 lg:grid-cols-[.78fr_1.22fr]">
              <div>
                <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]"><BadgeCheck className="h-4 w-4" /> Respostas diretas</span>
                <h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">Antes de levar o sistema para a casa.</h2>
                <p className="mt-5 text-sm leading-relaxed text-[#6a6358]">Dúvidas comuns de quem está comparando planilhas, mensagens e sistemas de gestão.</p>
              </div>
              <dl className="divide-y divide-[#d7ccbb] border-y border-[#d7ccbb]">
                {page.faq.map((item, index) => (
                  <div key={item.q} className="grid gap-3 py-6 sm:grid-cols-[44px_1fr]">
                    <span className="text-xs font-black text-[#a4770b]">0{index + 1}</span>
                    <div><dt className="text-base font-extrabold">{item.q}</dt><dd className="mt-2 text-sm leading-relaxed text-[#685f53]">{item.a}</dd></div>
                  </div>
                ))}
              </dl>
            </motion.div>

            <div className="mt-20">
              <span className="text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]">Continue entendendo</span>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {relatedByPage[page.key].map((href) => <RelatedLink key={href} href={href} />)}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#0a0d09] px-5 py-20 sm:px-8 md:py-28">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(229,174,18,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.09)_1px,transparent_1px)] [background-size:72px_72px]" aria-hidden />
          <motion.div {...reveal} className="relative mx-auto flex w-full max-w-[1180px] flex-col items-start justify-between gap-8 rounded-[2rem] border border-white/10 bg-[#11150f]/95 p-8 sm:p-10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-[#e5ae12]"><Sparkles className="h-4 w-4" /> Conheça com a rotina real</span>
              <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-.05em] text-[#f4efe3] sm:text-4xl">Abra o ambiente da sua casa e teste antes de decidir.</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#9da298]">Todos os módulos ficam disponíveis durante o período de teste. Sem cartão e sem precisar montar uma apresentação para começar.</p>
            </div>
            <RegisterTrialLink className="inline-flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-xl bg-[#e5ae12] px-7 text-sm font-extrabold text-[#17150e] transition hover:bg-[#f0bd25]">
              Começar teste grátis <ArrowRight className="h-4 w-4" />
            </RegisterTrialLink>
          </motion.div>
        </section>
      </main>
      <MarketingMockupFooter />
    </div>
  );
}
