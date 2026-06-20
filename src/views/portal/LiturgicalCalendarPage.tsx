import { MarketingSubpageTopNav } from '../../components/marketing/MarketingTopNav';
import { LITURGICAL_CALENDAR_MONTHS } from '../../content/portalLiturgical';
import { ROUTES } from '../../lib/routes';

export default function LiturgicalCalendarPage() {
  return (
    <div className="landing-v3 min-h-screen">
      <MarketingSubpageTopNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <a href={ROUTES.contentHub} className="text-sm font-bold text-amber-600 hover:underline">
          ← Hub de conteúdo
        </a>
        <h1 className="mt-4 text-3xl font-black">Calendário litúrgico de referência</h1>
        <p className="mt-4 text-neutral-600">
          Datas culturais frequentemente celebradas em casas de axé no Brasil. Cada terreiro tem seu calendário
          próprio — confirme sempre com a diretoria da casa que você frequenta.
        </p>

        <div className="mt-10 space-y-8">
          {LITURGICAL_CALENDAR_MONTHS.map((month) => (
            <section key={month.month}>
              <h2 className="text-xl font-bold text-amber-600">{month.month}</h2>
              <ul className="mt-4 space-y-3">
                {month.dates.map((d) => (
                  <li
                    key={`${month.month}-${d.day}-${d.title}`}
                    className="rounded-xl border border-[#ece4d2] bg-[#0B0D11] px-4 py-3"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{d.day}</p>
                    <p className="font-semibold">{d.title}</p>
                    {d.note ? <p className="mt-1 text-sm text-neutral-600">{d.note}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
