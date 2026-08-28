import { motion } from 'framer-motion';
import { ArrowRight, Check, CircleDot, ShieldCheck } from 'lucide-react';
import type { FeaturePageContent } from '../constants/featurePagesContent';
import { FEATURE_PAGES, featurePagePath } from '../constants/featurePagesContent';
import { COMMERCIAL_ROUTES } from '../constants/commercialPagesContent';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { ROUTES } from '../lib/routes';
import { linkifyAxecloudArticleBody } from '../lib/seoLinkify';
import { RegisterTrialLink } from '../components/marketing/RegisterTrialLink';
import { MarketingMockupFooter } from '../components/marketing/MarketingMockupFooter';

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.48 },
} as const;

const financialSlugs = new Set(['financeiro-pix-mensalidades', 'central-relatorios']);
const memberSlugs = new Set(['cadastro-filhos-de-santo', 'portal-filho-de-santo', 'obrigacoes-alertas', 'frequencia-check-in', 'caminhada-mediunica', 'desenvolvimento-mediunico']);

function pillarFor(page: FeaturePageContent) {
  if (financialSlugs.has(page.slug)) return { href: COMMERCIAL_ROUTES.financial, label: 'Financeiro para terreiros' };
  if (memberSlugs.has(page.slug)) return { href: COMMERCIAL_ROUTES.members, label: 'Gestão de filhos de santo' };
  if (page.slug === 'whatsapp-oficial') return { href: COMMERCIAL_ROUTES.dues, label: 'Mensalidades para terreiros' };
  return { href: COMMERCIAL_ROUTES.system, label: 'Sistema de gestão para terreiros' };
}

function relatedFeatures(page: FeaturePageContent) {
  const currentIndex = FEATURE_PAGES.findIndex((item) => item.slug === page.slug);
  return [1, 2, 3]
    .map((offset) => FEATURE_PAGES[(currentIndex + offset) % FEATURE_PAGES.length])
    .filter((item) => item.slug !== page.slug);
}

export default function FeaturePage({ page }: { page: FeaturePageContent }) {
  const pillar = pillarFor(page);
  const related = relatedFeatures(page);
  const position = FEATURE_PAGES.findIndex((item) => item.slug === page.slug) + 1;

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#f6f0e5] font-sans text-[#1b1813]">
      <main>
        <section className="relative overflow-hidden bg-[#0a0d09] px-5 pb-20 pt-32 text-[#f4efe3] sm:px-8 md:pb-24 md:pt-36">
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(229,174,18,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,#000,transparent_90%)]" />
          <div className="relative mx-auto grid w-full max-w-[1180px] gap-12 lg:grid-cols-[1fr_410px] lg:items-center">
            <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.68 }}>
              <nav className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.19em] text-[#8f948a]" aria-label="Breadcrumb">
                <a href={ROUTES.recursos} className="transition hover:text-[#e5ae12]">Recursos</a><span>/</span><a href={pillar.href} className="transition hover:text-[#e5ae12]">{pillar.label}</a>
              </nav>
              <span className="mt-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.23em] text-[#e5ae12]"><i className="h-2 w-2 rounded-full bg-[#57d9a4] shadow-[0_0_14px_#57d9a4]" /> Módulo {String(position).padStart(2, '0')} de 24</span>
              <h1 className="mt-6 max-w-[15ch] text-balance text-[clamp(2.7rem,6vw,5.5rem)] font-black leading-[.92] tracking-[-.065em]">{page.h1}</h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-[#aaafa5] md:text-lg">{page.lead}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <RegisterTrialLink className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#e5ae12] px-6 text-sm font-extrabold text-[#17150e]">Testar {TRIAL_DAYS} dias <ArrowRight className="h-4 w-4" /></RegisterTrialLink>
                <a href={pillar.href} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/15 px-6 text-sm font-bold">Ver solução completa</a>
              </div>
            </motion.div>

            <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.68, delay: 0.1 }} className="relative min-h-[390px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#121610] p-6">
              <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(229,174,18,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.09)_1px,transparent_1px)] [background-size:48px_48px]" />
              <div className="relative flex items-center justify-between border-b border-white/10 pb-4"><span className="text-[9px] font-black uppercase tracking-[.2em] text-[#858b81]">Dentro da rotina</span><CircleDot className="h-4 w-4 text-[#58d9a5]" /></div>
              <div className="relative mt-6 space-y-3">
                {page.sections.slice(0, 3).map((section, index) => (
                  <div key={section.heading} className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#161b14] p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e5ae12]/25 text-[10px] font-black text-[#e5ae12]">0{index + 1}</span>
                    <span className="text-sm font-extrabold leading-tight text-[#f2ede1]">{section.heading}</span>
                  </div>
                ))}
              </div>
              <div className="relative mt-7 border-t border-white/10 pt-5 text-xs leading-relaxed text-[#8f948a]"><ShieldCheck className="mr-2 inline h-4 w-4 text-[#58d9a5]" /> Integrado aos demais dados da casa.</div>
            </motion.aside>
          </div>
        </section>

        <section className="bg-[#f6f0e5] px-5 py-20 sm:px-8 md:py-28">
          <div className="mx-auto w-full max-w-[1180px]">
            <motion.header {...reveal} className="grid gap-6 border-b border-[#d6cbb9] pb-9 md:grid-cols-[.75fr_1.25fr] md:items-end">
              <div><span className="text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]">Na prática</span><h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">O que muda na rotina.</h2></div>
              <p className="max-w-2xl text-sm leading-relaxed text-[#696156] md:justify-self-end">Este módulo não funciona como uma ferramenta solta. Ele compartilha a base da casa e reduz o retrabalho entre cadastro, agenda, financeiro e comunicação.</p>
            </motion.header>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {page.sections.map((section, index) => (
                <motion.section key={section.heading} {...reveal} className="min-h-60 rounded-3xl border border-[#d9cfbf] bg-[#fffdf8] p-7 shadow-[0_15px_40px_rgba(45,35,12,.045)] sm:p-8">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-black tracking-[.18em] text-[#a4770b]">0{index + 1}</span><Check className="h-4 w-4 text-[#1f6b4d]" /></div>
                  <h2 className="mt-9 text-2xl font-extrabold leading-tight tracking-[-.04em]">{section.heading}</h2>
                  <p className="mt-4 text-sm leading-relaxed text-[#686055] [&_a]:font-bold [&_a]:text-[#1f6b4d] [&_a]:underline" dangerouslySetInnerHTML={{ __html: linkifyAxecloudArticleBody(section.body) }} />
                </motion.section>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eee5d7] px-5 py-20 sm:px-8 md:py-24">
          <motion.div {...reveal} className="mx-auto grid w-full max-w-[1180px] gap-12 lg:grid-cols-[.7fr_1.3fr]">
            <div><span className="text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]">Perguntas frequentes</span><h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.055em]">Antes de experimentar.</h2></div>
            <dl className="divide-y divide-[#d1c5b3] border-y border-[#d1c5b3]">
              {page.faq.map((item, index) => (
                <div key={item.q} className="grid gap-3 py-6 sm:grid-cols-[44px_1fr]"><span className="text-xs font-black text-[#9a6d00]">0{index + 1}</span><div><dt className="font-extrabold">{item.q}</dt><dd className="mt-2 text-sm leading-relaxed text-[#686055]">{item.a}</dd></div></div>
              ))}
            </dl>
          </motion.div>
        </section>

        <section className="bg-[#fcfaf5] px-5 py-20 sm:px-8 md:py-24">
          <div className="mx-auto w-full max-w-[1180px]">
            <motion.div {...reveal} className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]">Recursos conectados</span><h2 className="mt-4 text-3xl font-black tracking-[-.05em]">Continue pela rotina da casa.</h2></div><a href={ROUTES.recursos} className="inline-flex items-center gap-2 text-sm font-extrabold text-[#1f6b4d]">Todos os recursos <ArrowRight className="h-4 w-4" /></a></motion.div>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {related.map((item) => (
                <a key={item.slug} href={featurePagePath(item.slug)} className="group flex min-h-48 flex-col justify-between rounded-2xl border border-[#d9cfbf] bg-white p-6 transition hover:-translate-y-1 hover:border-[#b9870c]">
                  <div><h3 className="text-lg font-extrabold leading-tight">{item.h1}</h3><p className="mt-3 text-sm leading-relaxed text-[#686055]">{item.lead}</p></div>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#1f6b4d]">Ver módulo <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0a0d09] px-5 py-20 text-[#f4efe3] sm:px-8 md:py-24">
          <motion.div {...reveal} className="mx-auto grid w-full max-w-[1180px] gap-8 rounded-[2rem] border border-white/10 bg-[#11150f] p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl"><span className="text-[10px] font-black uppercase tracking-[.22em] text-[#e5ae12]">Todos os módulos liberados</span><h2 className="mt-5 text-3xl font-black tracking-[-.05em] sm:text-4xl">Teste este recurso com os dados da sua própria rotina.</h2><p className="mt-4 text-sm leading-relaxed text-[#9da298]">Sem cartão durante o período de teste e sem cobrança separada por funcionalidade.</p></div>
            <RegisterTrialLink className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#e5ae12] px-7 text-sm font-extrabold text-[#17150e]">Começar agora <ArrowRight className="h-4 w-4" /></RegisterTrialLink>
          </motion.div>
        </section>
      </main>
      <MarketingMockupFooter />
    </div>
  );
}
