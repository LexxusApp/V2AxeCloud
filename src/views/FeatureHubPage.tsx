import { motion } from 'framer-motion';
import { ArrowRight, Boxes, CalendarDays, CircleDollarSign, ShieldCheck, UsersRound } from 'lucide-react';
import { FEATURE_HUB, FEATURE_PAGES, featurePagePath } from '../constants/featurePagesContent';
import { COMMERCIAL_PAGES, COMMERCIAL_ROUTES } from '../constants/commercialPagesContent';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { ROUTES } from '../lib/routes';
import { MarketingMockupFooter } from '../components/marketing/MarketingMockupFooter';
import { RegisterTrialLink } from '../components/marketing/RegisterTrialLink';

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 },
  transition: { duration: 0.5 },
} as const;

const groups = [
  {
    id: 'administracao', number: '01', title: 'Administração e sustentabilidade',
    description: 'O que mantém a rotina financeira, material e documental sob controle.',
    slugs: ['financeiro-pix-mensalidades', 'central-relatorios', 'almoxarifado-terreiro', 'patrimonio-sagrado', 'documentos-da-casa', 'loja-do-axe'],
  },
  {
    id: 'corrente', number: '02', title: 'Corrente e caminhada',
    description: 'Pessoas, presença, vínculos e desenvolvimento com contexto.',
    slugs: ['cadastro-filhos-de-santo', 'portal-filho-de-santo', 'obrigacoes-alertas', 'frequencia-check-in', 'caminhada-mediunica', 'desenvolvimento-mediunico'],
  },
  {
    id: 'ritmo', number: '03', title: 'Ritmo e comunicação',
    description: 'Datas e mensagens deixam de disputar espaço em conversas soltas.',
    slugs: ['calendario-giras', 'calendario-liturgico', 'mural-de-avisos', 'whatsapp-oficial', 'notificacoes-push', 'app-pwa-terreiro'],
  },
  {
    id: 'continuidade', number: '04', title: 'Cuidado, memória e continuidade',
    description: 'Acolhimento e acervo organizados para hoje e para quem vem depois.',
    slugs: ['galeria-fotos-terreiro', 'biblioteca-estudos-terreiro', 'atendimentos-pedidos-reza', 'consulentes-agenda', 'controle-camarinha', 'diretorio-publico-terreiros', 'painel-do-zelador'],
  },
] as const;

const quickLinks = [
  { href: '#administracao', label: 'Administração', Icon: CircleDollarSign },
  { href: '#corrente', label: 'Corrente', Icon: UsersRound },
  { href: '#ritmo', label: 'Ritmo', Icon: CalendarDays },
  { href: '#continuidade', label: 'Continuidade', Icon: Boxes },
] as const;

export default function FeatureHubPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#f5efe3] font-sans text-[#1b1813]">
      <main>
        <section className="relative overflow-hidden bg-[#0a0d09] px-5 pb-20 pt-32 text-[#f4efe3] sm:px-8 md:pb-28 md:pt-36">
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(229,174,18,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,#000,transparent_88%)]" />
          <div className="relative mx-auto grid w-full max-w-[1180px] gap-12 lg:grid-cols-[1fr_380px] lg:items-end">
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <a href={ROUTES.systemForTerreiros} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.23em] text-[#e5ae12]"><i className="h-2 w-2 rounded-full bg-[#57d9a4] shadow-[0_0_14px_#57d9a4]" /> Recursos do sistema</a>
              <h1 className="mt-7 max-w-[14ch] text-balance text-[clamp(3rem,7vw,6.6rem)] font-black leading-[.9] tracking-[-.07em]">24 módulos. Uma casa inteira.</h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-[#aaafa5] md:text-lg">{FEATURE_HUB.lead}</p>
            </motion.div>
            <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.12 }} className="rounded-3xl border border-white/10 bg-[#121610] p-6">
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#858b81]">Encontre por frente</span>
              <nav className="mt-5 grid grid-cols-2 gap-2" aria-label="Categorias de recursos">
                {quickLinks.map(({ href, label, Icon }) => (
                  <a key={href} href={href} className="group flex min-h-24 flex-col justify-between rounded-xl border border-white/10 bg-white/[.025] p-3 transition hover:border-[#e5ae12]/45">
                    <Icon className="h-5 w-5 text-[#e5ae12]" />
                    <span className="text-xs font-extrabold text-[#d9d8d0] group-hover:text-white">{label}</span>
                  </a>
                ))}
              </nav>
            </motion.aside>
          </div>
        </section>

        <section className="border-b border-[#d9cfbf] bg-[#f7f1e6] px-5 py-16 sm:px-8">
          <div className="mx-auto w-full max-w-[1180px]">
            <motion.div {...reveal} className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
              <div className="py-3">
                <span className="text-[10px] font-black uppercase tracking-[.22em] text-[#9a6d00]">Comece pela sua necessidade</span>
                <h2 className="mt-5 max-w-[10ch] text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">Três caminhos para entender o produto.</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {COMMERCIAL_PAGES.filter((page) => page.key !== 'system').map((page) => (
                  <a key={page.path} href={page.path} className="group flex min-h-64 flex-col justify-between rounded-3xl border border-[#d9cfbf] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-[#b9870c] hover:shadow-xl hover:shadow-black/5">
                    <span className="text-[9px] font-black uppercase tracking-[.2em] text-[#9a6d00]">Página especializada</span>
                    <div><h3 className="text-xl font-extrabold leading-tight tracking-[-.035em]">{page.kicker}</h3><p className="mt-3 text-sm leading-relaxed text-[#6d6559]">{page.promise}</p></div>
                    <span className="inline-flex items-center gap-2 text-xs font-extrabold text-[#1f563f]">Conhecer <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                  </a>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {groups.map((group, groupIndex) => {
          const pages = group.slugs.map((slug) => FEATURE_PAGES.find((page) => page.slug === slug)).filter(Boolean);
          return (
            <section key={group.id} id={group.id} className={groupIndex % 2 ? 'bg-[#eee6d8] px-5 py-20 sm:px-8 md:py-24' : 'bg-[#f8f3ea] px-5 py-20 sm:px-8 md:py-24'}>
              <div className="mx-auto w-full max-w-[1180px]">
                <motion.header {...reveal} className="grid gap-5 border-b border-[#d2c7b6] pb-8 md:grid-cols-[90px_1fr_1fr] md:items-end">
                  <span className="text-4xl font-black tracking-[-.06em] text-[#b88a20]">{group.number}</span>
                  <h2 className="text-3xl font-black leading-tight tracking-[-.045em] sm:text-4xl">{group.title}</h2>
                  <p className="max-w-lg text-sm leading-relaxed text-[#6b6459] md:justify-self-end">{group.description}</p>
                </motion.header>
                <ul className="mt-7 grid list-none gap-3 md:grid-cols-2 lg:grid-cols-3" role="list">
                  {pages.map((page, index) => page ? (
                    <motion.li key={page.slug} {...reveal} transition={{ ...reveal.transition, delay: Math.min(index * 0.035, 0.18) }}>
                      <a href={featurePagePath(page.slug)} className="group flex h-full min-h-52 flex-col rounded-2xl border border-[#d9cfbf] bg-[#fffdf8] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#ba870d] hover:shadow-[0_18px_46px_rgba(45,35,12,.08)]">
                        <span className="text-[9px] font-black tracking-[.18em] text-[#a77a12]">{group.number}.{String(index + 1).padStart(2, '0')}</span>
                        <h3 className="mt-7 text-lg font-extrabold leading-tight tracking-[-.03em]">{page.h1}</h3>
                        <p className="mt-3 flex-1 text-sm leading-relaxed text-[#6b6459]">{page.lead}</p>
                        <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#1f563f]">Ver detalhes <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                      </a>
                    </motion.li>
                  ) : null)}
                </ul>
              </div>
            </section>
          );
        })}

        <section className="relative overflow-hidden bg-[#0b0e0a] px-5 py-20 text-[#f4efe3] sm:px-8 md:py-28">
          <div className="mx-auto grid w-full max-w-[1180px] gap-10 rounded-[2rem] border border-white/10 bg-[#11150f] p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-[#e5ae12]"><ShieldCheck className="h-4 w-4" /> Tudo incluído</span>
              <h2 className="mt-5 text-3xl font-black tracking-[-.05em] sm:text-4xl">Não escolha um módulo. Escolha organizar a casa.</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#9ca197]">Os 24 módulos fazem parte do plano Premium e ficam disponíveis no teste. Comece pela sua necessidade mais urgente e conecte o restante no seu ritmo.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <RegisterTrialLink className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#e5ae12] px-7 text-sm font-extrabold text-[#17150e]">Testar {TRIAL_DAYS} dias <ArrowRight className="h-4 w-4" /></RegisterTrialLink>
              <a href={COMMERCIAL_ROUTES.system} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/15 px-7 text-sm font-bold">Ver visão completa</a>
            </div>
          </div>
        </section>
      </main>
      <MarketingMockupFooter />
    </div>
  );
}
