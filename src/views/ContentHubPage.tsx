import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  Library,
  Heart,
} from 'lucide-react';
import {
  ContentMarketingLayout,
  MatrizSectionTitle,
  matrizPortalCardClass,
} from '../components/marketing/ContentMarketingLayout';
import { RegisterTrialLink } from '../components/marketing/RegisterTrialLink';
import { GLOSSARY_TERMS, PORTAL_ARTICLES, contentArticlePath, getPortalGestaoDigitalArticles } from '../content/portalContent';
import { ROUTES } from '../lib/routes';
import { cn } from '../lib/utils';

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
} as const;

function ContentHeroStats() {
  return (
    <div className={cn(matrizPortalCardClass, 'p-5')}>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-[#ffc107]/14 p-4">
          <FileText className="mx-auto h-5 w-5 text-[#a87400]" aria-hidden />
          <p className="mt-2 text-2xl font-black text-[#a87400]">{PORTAL_ARTICLES.length}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Artigos</p>
        </div>
        <div className="rounded-2xl bg-[#ffc107]/14 p-4">
          <BookOpen className="mx-auto h-5 w-5 text-[#a87400]" aria-hidden />
          <p className="mt-2 text-2xl font-black text-[#a87400]">{GLOSSARY_TERMS.length}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Termos</p>
        </div>
        <div className="rounded-2xl bg-[#ffc107]/14 p-4">
          <Heart className="mx-auto h-5 w-5 text-[#a87400]" aria-hidden />
          <p className="mt-2 text-lg font-black text-[#a87400]">Axé</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Respeito</p>
        </div>
      </div>
    </div>
  );
}

export default function ContentHubPage() {
  const gestaoArticles = getPortalGestaoDigitalArticles();

  return (
    <ContentMarketingLayout
      kicker="Portal de conteúdo"
      title="Conteúdo para quem busca entender a tradição"
      summary="Artigos e glossário com linguagem respeitosa — base do portal público de terreiros de Umbanda e Candomblé."
      heroExtra={<ContentHeroStats />}
    >
      <motion.section {...fade} aria-labelledby="content-articles">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <MatrizSectionTitle id="content-articles">Artigos</MatrizSectionTitle>
            <p className="mt-2 text-sm text-[#1b1813]/65">Leituras para zeladores, filhos de santo e quem está chegando.</p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-[#e8dfd0] bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#1b1813]/55 sm:inline">
            {PORTAL_ARTICLES.length} textos
          </span>
        </div>

        <ul className="grid list-none gap-5 sm:grid-cols-2 lg:gap-6" role="list">
          {PORTAL_ARTICLES.map((article, index) => (
            <motion.li
              key={article.slug}
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.32) }}
              className="h-full"
            >
              <a href={contentArticlePath(article.slug)} className="group block h-full">
                <article
                  className={cn(
                    matrizPortalCardClass,
                    'relative flex h-full flex-col p-6 transition hover:-translate-y-1 hover:border-[#ffc107]/50 hover:shadow-xl hover:shadow-[#ffc107]/10 sm:p-7',
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#ffc107]/30 bg-[#ffc107]/12">
                      <FileText className="h-5 w-5 text-[#a87400]" strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="rounded-full bg-[#ffc107]/14 px-2.5 py-1 text-[10px] font-black tabular-nums text-[#a87400]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold leading-snug text-[#1b1813] transition-colors group-hover:text-[#a87400] sm:text-lg">
                    {article.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#1b1813]/65">{article.summary}</p>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e8dfd0] pt-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#1b1813]/45">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {article.readingMinutes} min
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#a87400] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
                      Ler
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                </article>
              </a>
            </motion.li>
          ))}
        </ul>
      </motion.section>

      <motion.section
        {...fade}
        transition={{ ...fade.transition, delay: 0.12 }}
        aria-labelledby="content-gestao-digital"
      >
        <MatrizSectionTitle id="content-gestao-digital">Gestão digital do terreiro</MatrizSectionTitle>
        <p className="mt-2 text-sm text-[#1b1813]/65">
          Software, PWA, Pix, WhatsApp e como escolher o sistema certo — com links para o comparativo.
        </p>

        <a
          href={ROUTES.home}
          className={cn(
            matrizPortalCardClass,
            'group mt-5 block p-5 transition hover:-translate-y-1 hover:border-[#ffc107]/50 sm:p-6',
          )}
        >
          <p className="text-xs font-black uppercase tracking-wider text-[#a87400]">Gestão de terreiros</p>
          <p className="mt-1 text-lg font-bold text-[#1b1813] group-hover:text-[#a87400]">
            Software AxéCloud para Umbanda, Candomblé e Jurema
          </p>
          <p className="mt-2 text-sm text-[#1b1813]/65">
            Financeiro com Pix, calendário de giras, portal do filho de santo e app PWA — tudo em um só lugar.
          </p>
        </a>

        <a
          href={ROUTES.whyAxeCloud}
          className={cn(
            matrizPortalCardClass,
            'group mt-4 block border-[#ffc107]/25 bg-[#ffc107]/8 p-5 transition hover:-translate-y-1 sm:p-6',
          )}
        >
          <p className="text-xs font-black uppercase tracking-wider text-[#a87400]">Comparativo</p>
          <p className="mt-1 text-lg font-bold text-[#1b1813] group-hover:text-[#a87400]">
            Por que AxéCloud? Tabela vs planilha e outros sistemas
          </p>
          <p className="mt-2 text-sm text-[#1b1813]/65">
            14 módulos reais, app PWA instalável e checklist objetivo — tudo em uma página.
          </p>
        </a>

        <ul className="mt-5 grid list-none gap-4 sm:grid-cols-2" role="list">
          {gestaoArticles.map((article) => (
            <li key={article.slug}>
              <a href={contentArticlePath(article.slug)} className="group block h-full">
                <article
                  className={cn(
                    matrizPortalCardClass,
                    'h-full p-5 transition hover:-translate-y-1 hover:border-[#ffc107]/50',
                  )}
                >
                  <h3 className="text-sm font-bold leading-snug text-[#1b1813] group-hover:text-[#a87400] sm:text-base">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#1b1813]/65 sm:text-sm">{article.summary}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#a87400]">
                    <Clock className="h-3 w-3" aria-hidden />
                    {article.readingMinutes} min
                  </span>
                </article>
              </a>
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.2 }} aria-labelledby="content-glossary">
        <MatrizSectionTitle id="content-glossary">Referência rápida</MatrizSectionTitle>
        <p className="mt-2 text-sm text-[#1b1813]/65">Termos fundamentais explicados com cuidado cultural.</p>

        <a href={ROUTES.glossary} className="group mt-5 block">
          <article
            className={cn(
              matrizPortalCardClass,
              'flex flex-col gap-5 p-6 transition hover:-translate-y-1 hover:border-[#ffc107]/50 sm:flex-row sm:items-center sm:justify-between sm:p-8',
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#ffc107]/30 bg-[#ffc107]/12">
                <Library className="h-6 w-6 text-[#a87400]" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-[#1b1813] transition-colors group-hover:text-[#a87400] sm:text-2xl">
                  Glossário do axé
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#1b1813]/65 sm:text-base">
                  {GLOSSARY_TERMS.length} termos sobre terreiro, filho de santo, gira, orixá, entidades e tradições
                  afro-brasileiras — para consulta e compartilhamento.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Axé', 'Gira', 'Orixá', 'Firma', 'Consulente'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#e8dfd0] bg-white/80 px-2.5 py-0.5 text-[10px] font-bold text-[#1b1813]/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#ffc107] px-5 py-3 text-sm font-bold text-[#1b1813] shadow-md shadow-[#ffc107]/20 transition group-hover:bg-[#ffcd38]">
              Abrir glossário
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </article>
        </a>
      </motion.section>

      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.25 }} aria-labelledby="content-portal-links">
        <MatrizSectionTitle id="content-portal-links">Portal público</MatrizSectionTitle>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            {
              href: ROUTES.terreiros,
              title: 'Diretório de terreiros',
              desc: 'Casas com perfil público por cidade e tradição.',
            },
            {
              href: ROUTES.eventosPublicos,
              title: 'Eventos públicos',
              desc: 'Giras e festas divulgadas pelas casas.',
            },
            {
              href: ROUTES.liturgicalCalendar,
              title: 'Calendário litúrgico',
              desc: 'Datas culturais de referência — cada casa tem o seu.',
            },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                matrizPortalCardClass,
                'block p-5 transition hover:-translate-y-1 hover:border-[#ffc107]/50',
              )}
            >
              <p className="font-bold text-[#1b1813]">{link.title}</p>
              <p className="mt-1 text-sm text-[#1b1813]/65">{link.desc}</p>
            </a>
          ))}
        </div>
      </motion.section>

      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.3 }} aria-labelledby="content-trial">
        <article className={cn(matrizPortalCardClass, 'border-[#ffc107]/25 bg-[#ffc107]/8 p-6 sm:p-8')}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <MatrizSectionTitle id="content-trial">Teste grátis</MatrizSectionTitle>
              <h3 className="mt-2 text-lg font-bold text-[#1b1813] sm:text-xl">
                Quer usar o AxéCloud no seu terreiro?
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#1b1813]/65">
                30 dias de Premium completo, sem cartão de crédito — financeiro, calendário, portal do filho e mais.
              </p>
            </div>
            <RegisterTrialLink className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#ffc107] px-6 py-3 text-sm font-bold text-[#1b1813] shadow-md shadow-[#ffc107]/20 transition hover:bg-[#ffcd38]">
              Cadastrar terreiro
              <ArrowRight className="h-4 w-4" aria-hidden />
            </RegisterTrialLink>
          </div>
        </article>
      </motion.section>
    </ContentMarketingLayout>
  );
}
