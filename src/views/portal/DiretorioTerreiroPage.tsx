import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BadgeCheck, ExternalLink, Loader2, MapPin, MessageCircle, Phone } from 'lucide-react';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { MarketingMockupPageHeader } from '../../components/marketing/MarketingMockupPageHeader';
import { landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { fetchDiretorioTerreiro, type DiretorioTerreiro } from '../../lib/diretorioPublic';
import { formatTelefoneBr, telefoneHref } from '../../lib/formatTelefone';
import { applyCustomPageSeo } from '../../lib/seo';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { useDiretorioTerreiroJsonLd } from '../../lib/diretorioJsonLd';
import { commercialWhatsAppUrl } from '../../constants/commercialContact';
import { trackConversionEvent } from '../../lib/trackConversion';

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
    <div className="flex gap-3 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFC107]/15">
        <Icon className="h-4 w-4 text-[#1b1813]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1b1813]/50">{label}</p>
        <div className="mt-1 text-sm leading-relaxed text-[#1b1813]/85 sm:text-base">{children}</div>
      </div>
    </div>
  );
}

function TerreiroHeroImage({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const mostrarFoto = Boolean(fotoUrl) && !fotoFalhou;

  return (
    <div className="relative mt-6 aspect-[16/9] max-h-[14rem] overflow-hidden bg-gradient-to-br from-[#f3ebe0] to-[#e8dcc8] sm:aspect-[21/9] sm:max-h-[22rem] lg:max-h-[26rem]">
      {mostrarFoto ? (
        <img
          src={fotoUrl!}
          alt=""
          className="h-full w-full object-cover object-center"
          loading="eager"
          onError={() => setFotoFalhou(true)}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-[#1b1813]/25">
          <span className="text-5xl" aria-hidden>
            ☀
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">{nome}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#fdf8f0]/80 to-transparent" aria-hidden />
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
  const localidade = [terreiro.cidade, terreiro.estado].filter(Boolean).join(' · ');

  return (
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-10 sm:py-14', landingMockupShellClass, 'max-w-5xl')}>
        <a
          href={cityHref}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#1b1813]/66 transition hover:text-[#FFC107]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Voltar
        </a>

        <TerreiroHeroImage fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} />

        <header className="mt-6 border-b border-[#cfc0a8]/40 pb-6">
          <MarketingMockupPageHeader
            kicker="Diretório AxéCloud"
            title={terreiro.nome}
            summary={localidade || undefined}
            className="max-w-none"
          />
        </header>

        <section className="mt-8" aria-labelledby="contato-heading">
          <h2 id="contato-heading" className="text-xs font-bold uppercase tracking-widest text-[#1b1813]/45">
            Informações de contato
          </h2>

          <div className="mt-4 grid gap-x-10 sm:grid-cols-2">
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
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFC107] px-5 py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#e6ac00] sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Abrir no Google Maps — como chegar
            </a>
          ) : null}
        </section>

        <section
          className="mt-10 overflow-hidden rounded-2xl border border-[#2b251d] bg-[#17130e] p-6 text-white shadow-xl shadow-black/15 sm:p-8"
          aria-labelledby="claim-house-title"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffc107] text-[#1b1813]">
                <BadgeCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="claim-house-title" className="text-xl font-black">Esta é sua casa?</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
                  Reivindique este perfil sem custo para corrigir dados, identificar a casa e conhecer o sistema completo por 30 dias.
                </p>
              </div>
            </div>
            <a
              href={commercialWhatsAppUrl(
                `Olá! Sou responsável pela casa ${terreiro.nome}, em ${[terreiro.cidade, terreiro.estado].filter(Boolean).join('/')}, e quero reivindicar este perfil no AxéCloud.`,
              )}
              target="_blank"
              rel="noreferrer"
              onClick={() => void trackConversionEvent('cta_click', {
                ctaId: 'directory-profile-claim',
                ctaLabel: 'Reivindicar esta casa',
                metadata: { slug: terreiro.slug },
              })}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#ffc107] px-6 py-3.5 text-sm font-black text-[#1b1813] transition hover:bg-[#ffcd38]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Reivindicar esta casa
            </a>
          </div>
        </section>
      </main>
    </MarketingMockupLayout>
  );
}
