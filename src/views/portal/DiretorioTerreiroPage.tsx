import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Loader2, MapPin, Phone } from 'lucide-react';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { landingMockupCardClass, landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { fetchDiretorioTerreiro, type DiretorioTerreiro } from '../../lib/diretorioPublic';
import { formatTelefoneBr, telefoneHref } from '../../lib/formatTelefone';
import { applyCustomPageSeo } from '../../lib/seo';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
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
      <main className="relative z-[1] px-4 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-sm">
          <a
            href={cityHref}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#1b1813]/66 transition hover:text-[#FFC107]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Voltar
          </a>

          <article className={cn('mt-5 overflow-hidden rounded-2xl', landingMockupCardClass)}>
            {terreiro.fotoUrl ? (
              <div className="flex h-48 items-center justify-center overflow-hidden bg-[#f3ebe0]">
                <img
                  src={terreiro.fotoUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-[#f3ebe0] to-[#e8dcc8] text-4xl text-[#1b1813]/20" aria-hidden>
                ☀
              </div>
            )}

            <div className="p-5">
              <h1 className="font-display text-lg font-black leading-snug text-[#1b1813]">
                {terreiro.nome}
              </h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#1b1813]/55">
                {terreiro.cidade}
                {terreiro.estado ? ` · ${terreiro.estado}` : ''}
              </p>

              <h2 className="mt-5 text-xs font-bold uppercase tracking-widest text-[#1b1813]/45">
                Informações de contato
              </h2>

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
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFC107] px-4 py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#e6ac00]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir no Google Maps — como chegar
                </a>
              ) : null}
            </div>
          </article>
        </div>
      </main>
    </MarketingMockupLayout>
  );
}
