import { motion } from 'framer-motion';
import { Check, Minus, X } from 'lucide-react';
import {
  COMPARISON_INTRO,
  COMPARISON_PWA,
  COMPARISON_ROWS,
  COMPARISON_VS_STATUS_QUO,
  type ComparisonCell,
} from '../constants/comparisonContent';
import { LANDING_MODULES } from '../constants/landingModules';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { LandingSection, LandingSectionHeader } from '../components/landing/LandingSection';
import { LandingIconBox, landingIconClass } from '../components/landing/landingIconAccents';
import { landingMockupCardClass, landingMockupInsetCardClass } from '../components/landing/landingMockupUi';
import { cn } from '../lib/utils';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

function CellIcon({ value }: { value: ComparisonCell }) {
  if (value === 'yes') {
    return <Check className="mx-auto h-5 w-5 text-emerald-600" strokeWidth={2.5} aria-hidden />;
  }
  if (value === 'partial' || value === 'rare') {
    return <Minus className="mx-auto h-5 w-5 text-amber-600" strokeWidth={2.5} aria-hidden />;
  }
  return <X className="mx-auto h-5 w-5 text-red-400" strokeWidth={2.5} aria-hidden />;
}

function cellLabel(value: ComparisonCell): string {
  if (value === 'yes') return 'Sim';
  if (value === 'partial') return 'Parcial';
  if (value === 'rare') return 'Raro';
  return 'Não';
}

export default function PorQueAxeCloudPage() {
  return (
    <div className="landing-v3 landing-mockup-theme min-h-dvh bg-[#fdf8f0] text-[#1b1813]">
      <main>
        <LandingSection aria-labelledby="comparativo-head">
          <div className="landing-section-inner mx-auto max-w-4xl">
            <motion.div {...fade}>
              <LandingSectionHeader
                kicker="Comparativo"
                title={COMPARISON_INTRO.title}
                titleId="comparativo-head"
                lead={COMPARISON_INTRO.lead}
              />
            </motion.div>

            <motion.div {...fade} className="relative z-10 mt-10 grid gap-4 sm:grid-cols-3">
              {COMPARISON_VS_STATUS_QUO.map((block) => (
                <article key={block.heading} className={cn('p-5 sm:p-6', landingMockupCardClass)}>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#1b1813]/70">{block.heading}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#1b1813]/75">{block.body}</p>
                </article>
              ))}
            </motion.div>
          </div>
        </LandingSection>

        <LandingSection variant="alt" aria-labelledby="tabela-head">
          <div className="landing-section-inner mx-auto max-w-5xl">
            <motion.div {...fade}>
              <LandingSectionHeader
                kicker="Tabela comparativa"
                title="AxéCloud vs planilha vs outros sistemas de terreiro"
                titleId="tabela-head"
                lead="Comparativo explícito com o que existe hoje no mercado brasileiro — sem nomes de concorrentes, só critérios objetivos."
              />
            </motion.div>

            <motion.div {...fade} className="relative z-10 mt-8 overflow-x-auto">
              <table className={cn('w-full min-w-[640px] text-left text-sm', landingMockupCardClass)}>
                <caption className="sr-only">
                  Comparativo de funcionalidades entre planilha, AxéCloud e outros softwares de terreiro
                </caption>
                <thead>
                  <tr className="border-b border-[#e8dfd0] bg-[#fdf8f0]">
                    <th scope="col" className="px-4 py-3 font-bold text-[#1b1813]">
                      Funcionalidade
                    </th>
                    <th scope="col" className="px-3 py-3 text-center font-bold text-[#1b1813]/70">
                      Planilha / WhatsApp
                    </th>
                    <th scope="col" className="px-3 py-3 text-center font-bold text-[#FFC107]">
                      AxéCloud
                    </th>
                    <th scope="col" className="px-3 py-3 text-center font-bold text-[#1b1813]/70">
                      Outros sistemas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.id} className="border-b border-[#e8dfd0]/80 last:border-0">
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-[#1b1813]">{row.feature}</span>
                        {row.note ? (
                          <p className="mt-1 text-xs text-[#1b1813]/55">{row.note}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5 text-center" aria-label={`Planilha: ${cellLabel(row.planilha)}`}>
                        <CellIcon value={row.planilha} />
                      </td>
                      <td className="bg-[#FFC107]/5 px-3 py-3.5 text-center" aria-label={`AxéCloud: ${cellLabel(row.axecloud)}`}>
                        <CellIcon value={row.axecloud} />
                      </td>
                      <td className="px-3 py-3.5 text-center" aria-label={`Outros: ${cellLabel(row.outros)}`}>
                        <CellIcon value={row.outros} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-[#1b1813]/55">
                <Check className="mr-1 inline h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Sim ·{' '}
                <Minus className="mx-1 inline h-3.5 w-3.5 text-amber-600" aria-hidden />
                Parcial ou raro no mercado ·{' '}
                <X className="mx-1 inline h-3.5 w-3.5 text-red-400" aria-hidden />
                Não
              </p>
            </motion.div>
          </div>
        </LandingSection>

        <LandingSection aria-labelledby="modulos-head">
          <div className="landing-section-inner mx-auto max-w-6xl">
            <motion.div {...fade}>
              <LandingSectionHeader
                kicker="Módulos incluídos"
                title="14 módulos ativos no plano Premium"
                titleId="modulos-head"
                lead="Lista completa do que já está no painel — financeiro, portal, WhatsApp, loja, galeria e mais."
              />
            </motion.div>

            <ul className="relative z-10 mt-10 grid list-none grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {LANDING_MODULES.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.li
                    key={item.id}
                    {...fade}
                    transition={{ ...fade.transition, delay: 0.03 * i }}
                  >
                    <article className={cn('flex h-full items-start gap-3 p-4', landingMockupInsetCardClass, 'rounded-xl')}>
                      <LandingIconBox accent={item.iconAccent} className="shrink-0">
                        <Icon className={landingIconClass(item.iconAccent, 'h-5 w-5')} strokeWidth={1.5} aria-hidden />
                      </LandingIconBox>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#1b1813]">{item.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-[#1b1813]/65">{item.description}</p>
                      </div>
                    </article>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LandingSection>

        <LandingSection variant="alt" id="pwa-head" aria-labelledby="pwa-head">
          <div className="landing-section-inner mx-auto max-w-4xl">
            <motion.div {...fade}>
              <LandingSectionHeader
                kicker="App PWA"
                title={COMPARISON_PWA.title}
                titleId="pwa-head"
                lead={COMPARISON_PWA.lead}
              />
            </motion.div>

            <ol className="relative z-10 mt-8 grid gap-4 sm:grid-cols-3" role="list">
              {COMPARISON_PWA.steps.map((step, i) => (
                <motion.li key={step.title} {...fade} transition={{ ...fade.transition, delay: 0.06 * i }}>
                  <article className={cn('h-full p-5', landingMockupCardClass)}>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FFC107]/25 text-xs font-black">
                      {i + 1}
                    </span>
                    <h3 className="mt-3 text-sm font-bold">{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#1b1813]/70">{step.body}</p>
                  </article>
                </motion.li>
              ))}
            </ol>

            <ul className="relative z-10 mt-6 grid gap-2 sm:grid-cols-2" role="list">
              {COMPARISON_PWA.benefits.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-[#1b1813]/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC107]" strokeWidth={2.5} aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </LandingSection>

        <LandingSection aria-label="Cadastro">
          <div className="landing-section-inner mx-auto max-w-2xl text-center">
            <motion.div {...fade} className={cn('p-8 sm:p-10', landingMockupCardClass)}>
              <h2 className="font-display text-2xl font-black text-[#1b1813]">Teste tudo por {TRIAL_DAYS} dias</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#1b1813]/70">
                Sem cartão de crédito. Acesse todos os módulos, instale o PWA no celular e veja se o AxéCloud serve à sua casa.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={appHref(ROUTES.register)}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#FFC107] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-[#1b1813] transition hover:bg-[#ffcd38] sm:w-auto"
                >
                  Cadastrar — {TRIAL_DAYS} dias grátis
                </a>
                <a
                  href={`${ROUTES.home}#demonstracao`}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-[#e8dfd0] px-6 py-3.5 text-sm font-bold text-[#1b1813] transition hover:border-[#FFC107]/50 sm:w-auto"
                >
                  Ver demo interativa
                </a>
              </div>
            </motion.div>
          </div>
        </LandingSection>
      </main>
    </div>
  );
}
