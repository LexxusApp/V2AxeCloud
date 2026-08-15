import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BadgeCheck, ExternalLink, Loader2, MapPin, MessageCircle, Phone } from 'lucide-react';
import { MatrizEditorialLayout } from '../../components/marketing/MatrizEditorialLayout';
import { fetchDiretorioTerreiro, type DiretorioTerreiro } from '../../lib/diretorioPublic';
import { formatTelefoneBr, telefoneHref } from '../../lib/formatTelefone';
import { applyCustomPageSeo } from '../../lib/seo';
import { ROUTES } from '../../lib/routes';
import { useDiretorioTerreiroJsonLd } from '../../lib/diretorioJsonLd';
import { commercialWhatsAppUrl } from '../../constants/commercialContact';
import { trackConversionEvent } from '../../lib/trackConversion';
import { DirectoryManagementCta } from '../../components/portal/DirectoryManagementCta';

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
    <div className="flex gap-4 border-b border-[#d8cdbb]/55 py-5 last:border-b-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c99a12]/30 bg-[#e5ae12]/10">
        <Icon className="h-[18px] w-[18px] text-[#8a6200]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1b1813]/45">{label}</p>
        <div className="mt-1.5 text-sm font-semibold leading-relaxed text-[#1b1813]/82 sm:text-base">{children}</div>
      </div>
    </div>
  );
}

function TerreiroHeroImage({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const mostrarFoto = Boolean(fotoUrl) && !fotoFalhou;

  return (
    <div className="relative min-h-[17rem] overflow-hidden bg-gradient-to-br from-[#142219] to-[#07100a] sm:min-h-[24rem]">
      {mostrarFoto ? (
        <img
          src={fotoUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-80"
          loading="eager"
          onError={() => setFotoFalhou(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[#e5ae12]">
          <img src="/axecloud-trident.png" alt="" className="h-20 w-16 object-contain opacity-90" />
          <span className="max-w-md px-6 text-center text-xs font-extrabold uppercase tracking-[0.22em] text-white/48">{nome}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07100a] via-transparent to-black/20" aria-hidden />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(229,174,18,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.14)_1px,transparent_1px)] [background-size:76px_76px]" aria-hidden />
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
      <MatrizEditorialLayout showFooter={false}>
        <div className="relative z-[1] grid min-h-dvh place-items-center pt-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFC107]" />
        </div>
      </MatrizEditorialLayout>
    );
  }

  if (error || !terreiro) {
    return (
      <MatrizEditorialLayout>
        <div className="relative z-[1] mx-auto w-full max-w-[1180px] px-5 pb-24 pt-36 text-center sm:px-7 lg:px-8">
          <p className="text-lg font-bold text-[#1b1813]">{error || 'Terreiro não encontrado'}</p>
          <a href={ROUTES.terreiros} className="mt-4 inline-block text-sm font-bold text-[#1b1813] hover:text-[#FFC107]">
            Voltar ao diretório
          </a>
        </div>
      </MatrizEditorialLayout>
    );
  }

  const cityHref = terreiro.cidadeUrl || ROUTES.terreiros;
  const localidade = [terreiro.cidade, terreiro.estado].filter(Boolean).join(' · ');

  return (
    <MatrizEditorialLayout>
      <main className="relative z-[1] mx-auto w-full max-w-[1180px] px-5 pb-24 pt-32 sm:px-7 md:pt-36 lg:px-8">
        <a
          href={cityHref}
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#1b1813]/60 transition hover:text-[#9b6a00]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Voltar
        </a>

        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-[#1c2b20]/20 bg-[#0d140f] shadow-[0_30px_90px_rgba(20,25,18,.2)]">
          <TerreiroHeroImage fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} />
          <header className="relative border-t border-white/10 px-6 py-7 text-[#f7f1e5] sm:px-9 sm:py-9 lg:px-12">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#e5ae12]">Diretório AxéCloud · dados públicos</p>
            <h1 className="mt-4 max-w-4xl text-balance text-[clamp(2rem,6vw,4.75rem)] font-extrabold leading-[.96] tracking-[-0.05em]">{terreiro.nome}</h1>
            {localidade ? <p className="mt-5 flex items-center gap-2 text-sm font-bold text-white/55 sm:text-base"><MapPin className="h-4 w-4 text-[#e5ae12]" aria-hidden />{localidade}</p> : null}
          </header>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-[1.5rem] border border-[#d8cdbb]/65 bg-[#fffaf1]/90 p-6 shadow-[0_22px_60px_rgba(63,49,27,.08)] sm:p-8" aria-labelledby="contato-heading">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">Informações públicas</p>
          <h2 id="contato-heading" className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#1b1813]">Contato e localização</h2>

          <div className="mt-4">
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
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-5 py-3.5 text-sm font-extrabold text-[#11150f] transition hover:bg-[#f0bd25] sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Abrir no Google Maps — como chegar
            </a>
          ) : null}
        </section>

        <div className="lg:sticky lg:top-28">
          <DirectoryManagementCta source="profile" />
        </div>
        </div>

        <section
          className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-[#2b251d] bg-[#0d140f] p-6 text-white shadow-[0_25px_70px_rgba(20,25,18,.18)] sm:p-9"
          aria-labelledby="claim-house-title"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e5ae12] text-[#1b1813]">
                <BadgeCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#e5ae12]">Responsáveis pela casa</p>
                <h2 id="claim-house-title" className="mt-1 text-xl font-extrabold sm:text-2xl">Esta é sua casa?</h2>
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
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-6 py-3.5 text-sm font-extrabold text-[#1b1813] transition hover:bg-[#ffcd38]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Reivindicar esta casa
            </a>
          </div>
        </section>
      </main>
    </MatrizEditorialLayout>
  );
}
