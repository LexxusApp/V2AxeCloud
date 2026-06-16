import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  Library,
  Sparkles,
} from 'lucide-react';
import { ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
import { LandingIconBox, landingIconClass, type LandingIconAccent } from '../components/landing/landingIconAccents';
import { GLOSSARY_TERMS, PORTAL_ARTICLES, contentArticlePath } from '../content/portalContent';
import { ROUTES } from '../lib/routes';

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
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Artigos</p>
          <p className="text-base font-bold text-white">{PORTAL_ARTICLES.length} publicados</p>
        </div>
      </div>
      <div className="landing-mystic-card flex items-center gap-3 px-4 py-3 sm:min-w-[10rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-400">
          <BookOpen className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Glossário</p>
          <p className="text-base font-bold text-white">{GLOSSARY_TERMS.length} termos</p>
        </div>
      </div>
      <div className="landing-mystic-card flex items-center gap-3 px-4 py-3 sm:min-w-[10rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Tom</p>
          <p className="text-base font-bold text-white">Respeitoso</p>
        </div>
      </div>
    </div>
  );
}

export default function ContentHubPage() {
  return (
    <ContentMarketingLayout
      kicker="Portal AxéCloud"
      title="Conteúdo para quem busca entender a tradição"
      summary="Artigos e glossário com linguagem respeitosa — base do portal público que estamos construindo junto com as casas fundadoras de Umbanda e Candomblé."
      heroExtra={<ContentHeroStats />}
    >
      <motion.section {...fade} aria-labelledby="content-articles">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="content-articles" className="text-sm font-black uppercase tracking-wider text-primary">
              Artigos
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">Leituras para zeladores, filhos de santo e quem está chegando.</p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-[#1E242B] bg-[#12161A] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] sm:inline">
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
                  <article className="landing-resource-card relative flex h-full flex-col p-6 sm:p-7">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <LandingIconBox accent={accent}>
                        <FileText
                          className={landingIconClass(accent, 'h-5 w-5')}
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </LandingIconBox>
                      <span className="rounded-full border border-[#1E242B] bg-[#12161A] px-2.5 py-1 text-[10px] font-bold tabular-nums text-[#64748B]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="text-base font-bold leading-snug text-[#F1F5F9] transition-colors group-hover:text-primary sm:text-lg">
                      {article.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#94A3B8]">{article.summary}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#1E242B] pt-4">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {article.readingMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
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
        className="mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25 }}
        aria-labelledby="content-glossary"
      >
        <h2 id="content-glossary" className="text-sm font-black uppercase tracking-wider text-primary">
          Referência rápida
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">Termos fundamentais explicados com cuidado cultural.</p>

        <a href={ROUTES.glossary} className="group mt-5 block">
          <article className="landing-mystic-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <LandingIconBox accent="violet" size="lg">
                <Library className={landingIconClass('violet', 'h-6 w-6')} strokeWidth={1.5} aria-hidden />
              </LandingIconBox>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-[#F1F5F9] transition-colors group-hover:text-primary sm:text-2xl">
                  Glossário do axé
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#94A3B8] sm:text-base">
                  {GLOSSARY_TERMS.length} termos sobre terreiro, filho de santo, gira, orixá, entidades e tradições
                  afro-brasileiras — para consulta e compartilhamento.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Axé', 'Gira', 'Orixá', 'Firma', 'Consulente'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-[#1E242B] bg-[#12161A] px-2 py-0.5 text-[10px] font-bold text-[#94A3B8]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-5 py-3 text-sm font-bold text-primary transition group-hover:border-primary/40 group-hover:bg-primary/15">
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
        <h2 id="content-portal-links" className="text-sm font-black uppercase tracking-wider text-primary">
          Portal público
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <a href={ROUTES.terreiros} className="landing-mystic-card block p-5 transition hover:border-primary/30">
            <p className="font-bold text-white">Diretório de terreiros</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Casas com perfil público por cidade e tradição.</p>
          </a>
          <a href={ROUTES.eventosPublicos} className="landing-mystic-card block p-5 transition hover:border-primary/30">
            <p className="font-bold text-white">Eventos públicos</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Giras e festas divulgadas pelas casas.</p>
          </a>
          <a href={ROUTES.liturgicalCalendar} className="landing-mystic-card block p-5 transition hover:border-primary/30">
            <p className="font-bold text-white">Calendário litúrgico</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Datas culturais de referência — cada casa tem o seu.</p>
          </a>
        </div>
      </motion.section>

      <motion.section
        className="mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.35 }}
        aria-labelledby="content-founder"
      >
        <article className="landing-mystic-card border-primary/20 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p id="content-founder" className="text-xs font-bold uppercase tracking-wider text-primary">
                Programa Fundador
              </p>
              <h3 className="mt-2 text-lg font-bold text-[#F1F5F9] sm:text-xl">
                Sua casa quer usar o AxéCloud e aparecer no portal?
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#94A3B8]">
                12 meses gratuitos, onboarding personalizado e prioridade quando o diretório público estiver no ar.
              </p>
            </div>
            <a
              href={ROUTES.founderProgram}
              className="landing-btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-6 py-3 text-sm font-bold"
            >
              Conhecer o programa
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </article>
      </motion.section>
    </ContentMarketingLayout>
  );
}
