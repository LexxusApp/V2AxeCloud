import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { MarketingSubpageTopNav } from '../../components/marketing/MarketingTopNav';
import { TerreiroCard } from '../../components/portal/TerreiroCard';
import { TerreirosMapSummary } from '../../components/portal/TerreirosMapSummary';
import { PortalNewsletterForm } from '../../components/portal/PortalNewsletterForm';
import { fetchPublicCidades, fetchPublicTerreiros, type PublicTerreiro } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';

export default function TerreirosDirectoryPage() {
  const [items, setItems] = useState<PublicTerreiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tradicao, setTradicao] = useState('todas');
  const [cidades, setCidades] = useState<Awaited<ReturnType<typeof fetchPublicCidades>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPublicCidades()
      .then(setCidades)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchPublicTerreiros({ q: q || undefined, tradicao: tradicao !== 'todas' ? tradicao : undefined })
      .then((res) => setItems(res.items))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [q, tradicao]);

  const totalLabel = useMemo(() => `${items.length} casa${items.length === 1 ? '' : 's'}`, [items.length]);

  return (
    <div className="landing-v3 relative min-h-screen overflow-x-hidden font-sans antialiased">
      <MarketingSubpageTopNav />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Portal AxéCloud</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Diretório de terreiros</h1>
          <p className="mt-4 text-neutral-600">
            Casas de Umbanda, Candomblé e tradições afins que optaram por perfil público — com respeito, privacidade e
            moderação.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-lg font-bold">Por cidade</h2>
          <div className="mt-4">
            <TerreirosMapSummary cidades={cidades} />
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold">{totalLabel}</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome ou cidade…"
                  className="w-full rounded-xl border border-[#ece4d2] bg-white py-2.5 pl-10 pr-4 text-sm outline-none sm:w-64"
                />
              </div>
              <select
                value={tradicao}
                onChange={(e) => setTradicao(e.target.value)}
                className="rounded-xl border border-[#ece4d2] bg-white px-3 py-2.5 text-sm"
              >
                <option value="todas">Todas as tradições</option>
                <option value="umbanda">Umbanda</option>
                <option value="candomble">Candomblé</option>
                <option value="jurema">Jurema</option>
                <option value="mista">Mista</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-red-400">{error}</p>
          ) : items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#ece4d2] px-6 py-12 text-center">
              <p className="text-neutral-600">Nenhum terreiro encontrado com estes filtros.</p>
              <a href={ROUTES.founderProgram} className="mt-4 inline-block text-sm font-bold text-amber-600 hover:underline">
                Inscrever minha casa no Programa Fundador
              </a>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <TerreiroCard key={t.slug} terreiro={t} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-16 rounded-2xl border border-[#ece4d2] bg-[#0B0D11] p-6 sm:p-8">
          <h2 className="text-lg font-bold">Agenda da semana por e-mail</h2>
          <p className="mt-2 text-sm text-neutral-600">Giras e festas públicas na sua região — sem spam, só o essencial.</p>
          <div className="mt-4">
            <PortalNewsletterForm />
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-neutral-500">
          <a href={ROUTES.eventosPublicos} className="font-semibold text-amber-600 hover:underline">
            Ver agenda de eventos públicos
          </a>
        </p>
      </main>
    </div>
  );
}
