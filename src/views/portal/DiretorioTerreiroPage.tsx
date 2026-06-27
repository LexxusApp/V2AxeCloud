import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ExternalLink, Loader2, MapPin, Phone } from 'lucide-react';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { landingMockupCardClass, landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { fetchDiretorioTerreiro, type DiretorioTerreiro } from '../../lib/diretorioPublic';
import { formatTelefoneBr, telefoneHref } from '../../lib/formatTelefone';
import { appHref } from '../../lib/appHref';
import { applyCustomPageSeo } from '../../lib/seo';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { PLAN_PRICE_STANDARD_LABEL, TRIAL_DAYS } from '../../../lib/planPricing';
import { useDiretorioTerreiroJsonLd } from '../../lib/diretorioJsonLd';

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('terreiro');
  return decodeURIComponent(parts[idx + 1] || '');
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3 border-b border-[#ece4d2]/80 py-4 last:border-0 last:pb-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFC107]/15">
        <Icon className="h-4 w-4 text-[#1b1813]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1b1813]/50">{label}</p>
        <div className="mt-1 text-sm leading-relaxed text-[#1b1813]/85">{children}</div>
      </div>
    </div>
  );
}

export default function DiretorioTerreiroPage() {
  const slug = slugFromPath();
  const [terreiro, setTerreiro] = useState<DiretorioTerreiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Endereço inválido.');
      setLoading(false);
      return;
    }

    void fetchDiretorioTerreiro(slug)
      .then((t) => {
        setTerreiro(t);
        const loc = [t.cidade, t.estado].filter(Boolean).join(', ');
        applyCustomPageSeo({
          title: `${t.nome}${loc ? ` — ${loc}` : ''} | Diretório AxéCloud`,
          description: `Informações de ${t.nome}${loc ? ` em ${loc}` : ''}: endereço${t.telefone ? ', telefone' : ''} e como chegar pelo Google Maps.`,
          canonicalPath: `/terreiro/${t.slug}`,
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não encontrado'))
      .finally(() => setLoading(false));
  }, [slug]);

  useDiretorioTerreiroJsonLd(terreiro);

  if (loading) {
    return (
      <MarketingMockupLayout showFooter={false}>
        <div className="relative z-[1] grid min-h-[50vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFC107]" />
        </div>
      </MarketingMockupLayout>
    );
  }

  if (error || !terreiro) {
    return (
      <MarketingMockupLayout>
        <div className={cn('relative z-[1] px-4 py-20 text-center', landingMockupShellClass)}>
          <p className="text-lg font-bold text-[#1b1813]">{error || 'Terreiro não encontrado'}</p>
          <a href={ROUTES.terreiros} className="mt-4 inline-block text-sm font-bold text-[#1b1813] hover:text-[#FFC107]">
            Voltar ao diretório
          </a>
        </div>
      </MarketingMockupLayout>
    );
  }

  const cityHref = terreiro.cidadeUrl || ROUTES.terreiros;

  return (
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-8 sm:py-10', landingMockupShellClass, 'max-w-3xl')}>
        <a
          href={cityHref}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#1b1813]/66 transition hover:text-[#FFC107]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Voltar
        </a>

        <section
          className={cn(
            'relative mt-6 overflow-hidden rounded-2xl border border-[#FFC107]/35 bg-[#1b1813] p-5 text-white shadow-lg sm:p-6',
          )}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#FFC107]/10 blur-2xl"
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFC107]">
              Você administra este terreiro?
            </p>
            <h2 className="mt-2 font-display text-lg font-black leading-snug text-white sm:text-xl">
              O AxéCloud é o sistema de gestão online do seu terreiro
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/78">
              Esta página foi gerada automaticamente a partir do Google Maps. Se você faz parte da diretoria ou
              zeladoria de <span className="font-semibold text-white">{terreiro.nome}</span>, pode reivindicá-la no
              AxéCloud e transformá-la no cartão oficial da casa — com dados corretos e visibilidade para quem busca
              um terreiro na região.
            </p>

            <ul className="mt-4 space-y-2.5 text-sm text-white/88">
              {[
                'Atualize foto, endereço e telefone oficiais da casa',
                'Apareça no diretório público do portal AxéCloud',
                'Gerencie filhos de santo, giras, mural e financeiro num só lugar',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC107]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <a
              href={appHref(ROUTES.register)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#FFC107] px-5 py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#e6ac00] sm:w-auto"
            >
              Assumir este perfil — {TRIAL_DAYS} dias grátis
            </a>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              Sem cartão de crédito · teste o plano completo por {TRIAL_DAYS} dias · depois{' '}
              {PLAN_PRICE_STANDARD_LABEL} via PIX
            </p>
          </div>
        </section>

        <article className={cn('mt-6 overflow-hidden rounded-2xl', landingMockupCardClass)}>
          <div className="relative aspect-[21/9] max-h-52 overflow-hidden bg-gradient-to-br from-[#f3ebe0] to-[#e8dcc8] sm:max-h-60">
            {terreiro.fotoUrl ? (
              <img
                src={terreiro.fotoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl text-[#1b1813]/20" aria-hidden>
                ☀
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-5 pb-4 pt-12">
              <h1 className="font-display text-xl font-black leading-tight text-white sm:text-2xl">{terreiro.nome}</h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                {terreiro.cidade}
                {terreiro.estado ? ` · ${terreiro.estado}` : ''}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#1b1813]/45">Informações de contato</h2>

            <div className="mt-2">
              {terreiro.endereco ? (
                <InfoRow icon={MapPin} label="Endereço">
                  {terreiro.endereco}
                </InfoRow>
              ) : null}

              {terreiro.telefone ? (
                <InfoRow icon={Phone} label="Telefone">
                  <a href={telefoneHref(terreiro.telefone)} className="font-semibold text-[#1b1813] hover:text-[#FFC107]">
                    {formatTelefoneBr(terreiro.telefone)}
                  </a>
                </InfoRow>
              ) : (
                <InfoRow icon={Phone} label="Telefone">
                  <span className="text-[#1b1813]/50">Não informado no Google Maps</span>
                </InfoRow>
              )}
            </div>

            {terreiro.linkMaps ? (
              <a
                href={terreiro.linkMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFC107] px-4 py-3.5 text-sm font-black text-[#1b1813] transition hover:bg-[#e6ac00] sm:w-auto"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir no Google Maps — como chegar
              </a>
            ) : null}
          </div>
        </article>
      </main>
    </MarketingMockupLayout>
  );
}
