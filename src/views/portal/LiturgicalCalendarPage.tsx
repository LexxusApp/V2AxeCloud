import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { MarketingMockupPageHeader } from '../../components/marketing/MarketingMockupPageHeader';
import { landingMockupCardClass, landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { LITURGICAL_CALENDAR_MONTHS } from '../../content/portalLiturgical';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

export default function LiturgicalCalendarPage() {
  return (
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-10 sm:py-14', landingMockupShellClass, 'max-w-3xl')}>
        <a href={ROUTES.contentHub} className="text-sm font-bold text-[#1b1813]/66 transition hover:text-[#FFC107]">
          ← Hub de conteúdo
        </a>

        <MarketingMockupPageHeader
          kicker="Cultura & tradição"
          title="Calendário litúrgico de referência"
          summary="Datas culturais frequentemente celebradas em casas de axé no Brasil. Cada terreiro tem seu calendário próprio — confirme sempre com a diretoria da casa que você frequenta."
          className="mt-4"
        />

        <div className="mt-10 space-y-8">
          {LITURGICAL_CALENDAR_MONTHS.map((month) => (
            <section key={month.month}>
              <h2 className="text-xl font-bold text-[#FFC107]">{month.month}</h2>
              <ul className="mt-4 space-y-3">
                {month.dates.map((d) => (
                  <li key={`${month.month}-${d.day}-${d.title}`} className={cn('px-4 py-3', landingMockupCardClass, 'rounded-xl')}>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#1b1813]/62">{d.day}</p>
                    <p className="font-semibold text-[#1b1813]">{d.title}</p>
                    {d.note ? <p className="mt-1 text-sm text-[#1b1813]/65">{d.note}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </MarketingMockupLayout>
  );
}
