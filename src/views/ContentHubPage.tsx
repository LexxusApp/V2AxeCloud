import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  Library,
  Heart,
} from 'lucide-react';
import { ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
import { landingMockupCardClass, landingMockupKickerClass } from '../components/landing/landingMockupUi';
import { LandingIconBox, landingIconClass, type LandingIconAccent } from '../components/landing/landingIconAccents';
import { GLOSSARY_TERMS, PORTAL_ARTICLES, contentArticlePath, getPortalGestaoDigitalArticles } from '../content/portalContent';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { cn } from '../lib/utils';
import { TRIAL_DAYS } from '../../lib/planPricing';

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const ARTICLE_ACCENTS: LandingIconAccent[] = ['gold', 'emerald', 'sky', 'violet', 'amber'];

function ContentHeroStats() {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="landing-mystic-card flex items-center gap-3 px-4 py-3 sm:min-w-[10rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/40 bg-amber-50 text-amber-600">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Artigos</p>
          <p className="text-base font-bold text-[#1b1813]">{PORTAL_ARTICLES.length} publicados</p>
        </div>
      </div>
      <div className="landing-mystic-card flex items-center gap-3 px-4 py-3 sm:min-w-[10rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-400">
          <BookOpen className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1b1813]/65">Glossário</p>
          <p className="text-base font-bold text-[#1b1813]">{GLOSSARY_TERMS.length} termos</p>
        </div>
      </div>
      <div className="landing-mystic-card flex items-center gap-3 px-4 py-3 sm:min-w-[10rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
          <Heart className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1b1813]/65">Tom</p>
          <p className="text-base font-bold text-[#1b1813]">Respeitoso</p>
        </div>
      </div>
    </div>
  );
}

export default function ContentHubPage() {
  const gestaoArticles = getPortalGestaoDigitalArticles();

  return (
    <ContentMarketingLayout
      kicker="Portal de Gestão AxéCloud"
      title="Conteúdo para quem busca entender a tradição"
      summary="Artigos e glossário com linguagem respeitosa — base do portal público de terreiros de Umbanda e Candomblé."
      heroExtra={<ContentHeroStats />}
    >
      <motion.section {...fade} aria-labelledby="content-articles">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="content-articles" className={landingMockupKickerClass}>
              Artigos
            </h2>
            <p className="mt-1 text-sm text-[#1b1813]/65">Leituras para zeladores, filhos de santo e quem está chegando.</p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-[var(--mockup-card-border,#cfc0a8)] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1b1813]/70 sm:inline">
            {PORTAL_ARTICLES.length} textos
          </span>
        </div>

        <ul className="grid list-none gap-5 sm:grid-cols-2 lg:gap-6" role="list">
          {PORTAL_ARTICLES.map((article, index) => {
            const accent = ARTICLE_ACCENTS[index % ARTICLE_ACCENTS.length];
            return (
              <motion.li
                key={article.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.06 * index }}
                className="h-full"
              >
                <a href={contentArticlePath(article.slug)} className="group block h-full">
                  <article className={cn('relative flex h-full flex-col p-6 sm:p-7', landingMockupCardClass, 'rounded-[1.75rem]')}>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <LandingIconBox accent={accent}>
                        <FileText
                          className={landingIconClass(accent, 'h-5 w-5')}
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </LandingIconBox>
                      <span className="rounded-full border border-[#ece4d2] bg-white px-2.5 py-1 text-[10px] font-bold tabular-nums text-[#1b1813]/65">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="text-base font-bold leading-snug text-[#1b1813] transition-colors group-hover:text-amber-700 sm:text-lg">
                      {article.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#1b1813]/72">{article.summary}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#ece4d2] pt-4">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#1b1813]/65">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {article.readingMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
                        Ler
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                  </article>
                </a>
              </motion.li>
            );
          })}
        </ul>
      </motion.section>

      <motion.section
        {...fade}
        transition={{ ...fade.transition, delay: 0.12 }}
        aria-labelledby="content-gestao-digital"
      >
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="content-gestao-digital" className={landingMockupKickerClass}>
              Gestão digital do terreiro
            </h2>
            <p className="mt-1 text-sm text-[#1b1813]/65">
              Software, PWA, Pix, WhatsApp e como escolher o sistema certo — com links para o comparativo.
            </p>
          </div>
        </div>

        <a
          href={ROUTES.home}
          className={cn('group mb-4 block p-5 sm:p-6', landingMockupCardClass, 'rounded-2xl')}
        >
          <p className="text-xs font-black uppercase tracking-wider text-amber-700">Gestão de terreiros</p>
          <p className="mt-1 text-lg font-bold text-[#1b1813] group-hover:text-amber-800">
            Software AxéCloud para Umbanda, Candomblé e Jurema
          </p>
          <p className="mt-2 text-sm text-[#1b1813]/70">
            Financeiro com Pix, calendário de giras, portal do filho de santo e app PWA — tudo em um só lugar.
          </p>
        </a>

        <a
          href={ROUTES.whyAxeCloud}
          className={cn('group mb-5 block p-5 sm:p-6', landingMockupCardClass, 'rounded-2xl border-amber-300/30 bg-amber-50/40')}
        >
          <p className="text-xs font-black uppercase tracking-wider text-amber-700">Comparativo</p>
          <p className="mt-1 text-lg font-bold text-[#1b1813] group-hover:text-amber-800">
            Por que AxéCloud? Tabela vs planilha e outros sistemas
          </p>
          <p className="mt-2 text-sm text-[#1b1813]/70">
            14 módulos reais, app PWA instalável e checklist objetivo — tudo em uma página.
          </p>
        </a>

        <ul className="grid list-none gap-4 sm:grid-cols-2" role="list">
          {gestaoArticles.map((article) => (
            <li key={article.slug}>
              <a href={contentArticlePath(article.slug)} className="group block h-full">
                <article className={cn('h-full p-5', landingMockupCardClass, 'rounded-xl')}>
                  <h3 className="text-sm font-bold leading-snug text-[#1b1813] group-hover:text-amber-700 sm:text-base">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#1b1813]/68 sm:text-sm">{article.summary}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                    <Clock className="h-3 w-3" aria-hidden />
                    {article.readingMinutes} min
                  </span>
                </article>
              </a>
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.section
        className="mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25 }}
        aria-labelledby="content-glossary"
      >
        <h2 id="content-glossary" className={landingMockupKickerClass}>
          Referência rápida
        </h2>
        <p className="mt-1 text-sm text-[#1b1813]/65">Termos fundamentais explicados com cuidado cultural.</p>

        <a href={ROUTES.glossary} className="group mt-5 block">
          <article className="landing-mystic-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <LandingIconBox accent="violet" size="lg">
                <Library className={landingIconClass('violet', 'h-6 w-6')} strokeWidth={1.5} aria-hidden />
              </LandingIconBox>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-[#1b1813] transition-colors group-hover:text-amber-700 sm:text-2xl">
                  Glossário do axé
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#1b1813]/72 sm:text-base">
                  {GLOSSARY_TERMS.length} termos sobre terreiro, filho de santo, gira, orixá, entidades e tradições
                  afro-brasileiras — para consulta e compartilhamento.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Axé', 'Gira', 'Orixá', 'Firma', 'Consulente'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-[#ece4d2] bg-white px-2 py-0.5 text-[10px] font-bold text-[#1b1813]/72"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-600 transition group-hover:border-amber-400/40 group-hover:bg-amber-100">
              Abrir glossário
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </article>
        </a>
      </motion.section>

      <motion.section
        className="mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25 }}
        aria-labelledby="content-portal-links"
      >
        <h2 id="content-portal-links" className={landingMockupKickerClass}>
          Portal público
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <a href={ROUTES.terreiros} className={cn('block p-5 transition hover:-translate-y-0.5', landingMockupCardClass, 'rounded-2xl')}>
            <p className="font-bold text-[#1b1813]">Diretório de terreiros</p>
            <p className="mt-1 text-sm text-[#1b1813]/65">Casas com perfil público por cidade e tradição.</p>
          </a>
          <a href={ROUTES.eventosPublicos} className={cn('block p-5 transition hover:-translate-y-0.5', landingMockupCardClass, 'rounded-2xl')}>
            <p className="font-bold text-[#1b1813]">Eventos públicos</p>
            <p className="mt-1 text-sm text-[#1b1813]/65">Giras e festas divulgadas pelas casas.</p>
          </a>
          <a href={ROUTES.liturgicalCalendar} className={cn('block p-5 transition hover:-translate-y-0.5', landingMockupCardClass, 'rounded-2xl')}>
            <p className="font-bold text-[#1b1813]">Calendário litúrgico</p>
            <p className="mt-1 text-sm text-[#1b1813]/65">Datas culturais de referência — cada casa tem o seu.</p>
          </a>
        </div>
      </motion.section>

      <motion.section
        className="mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.35 }}
        aria-labelledby="content-trial"
      >
        <article className={cn('border-amber-300/20 p-6 sm:p-8', landingMockupCardClass, 'rounded-2xl')}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p id="content-trial" className={landingMockupKickerClass}>
                Teste grátis
              </p>
              <h3 className="mt-2 text-lg font-bold text-[#1b1813] sm:text-xl">
                Quer usar o AxéCloud no seu terreiro?
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#1b1813]/65">
                {TRIAL_DAYS} dias de Premium completo, sem cartão de crédito — financeiro, calendário, portal do filho e
                mais.
              </p>
            </div>
            <a
              href={appHref(ROUTES.register)}
              className="landing-btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-6 py-3 text-sm font-bold"
            >
              Cadastrar terreiro
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </article>
      </motion.section>
    </ContentMarketingLayout>
  );
}
