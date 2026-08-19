import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Compass,
  ExternalLink,
  Instagram,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { MatrizEditorialLayout } from '../../components/marketing/MatrizEditorialLayout';
import { fetchDiretorioTerreiro, type DiretorioTerreiro } from '../../lib/diretorioPublic';
import { formatTelefoneBr, telefoneHref } from '../../lib/formatTelefone';
import { applyCustomPageSeo } from '../../lib/seo';
import { ROUTES } from '../../lib/routes';
import { useDiretorioTerreiroJsonLd } from '../../lib/diretorioJsonLd';
import { trackConversionEvent } from '../../lib/trackConversion';
import { VerifiedBadge } from '../../components/portal/VerifiedBadge';

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('terreiro');
  return decodeURIComponent(parts[idx + 1] || '');
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-[#cfc1ab]/60 py-5 first:border-t-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-7 sm:py-6">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.17em] text-[#8a6200]">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </p>
      <div className="min-w-0 text-base font-semibold leading-relaxed text-[#1b1813]/80 sm:text-lg">{children}</div>
    </div>
  );
}

function TerreiroPortrait({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const mostrarFoto = Boolean(fotoUrl) && !fotoFalhou;

  return (
    <div className="relative min-h-[22rem] overflow-hidden bg-[#102117] lg:min-h-full">
      {mostrarFoto ? (
        <img
          src={fotoUrl!}
          alt={`Fachada ou imagem pública de ${nome}`}
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
          onError={() => setFotoFalhou(true)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center overflow-hidden">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(229,174,18,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.13)_1px,transparent_1px)] [background-size:54px_54px]" />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-[#e5ae12]/25" />
          <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-[#e5ae12]/20" />
          <div className="relative flex max-w-sm flex-col items-center px-8 text-center">
            <img src="/axecloud-trident.png" alt="" className="h-28 w-20 object-contain" />
            <span className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/50">Casa presente no diretório AxéCloud</span>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07110b]/85 via-transparent to-black/15" aria-hidden />
      <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-4 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/62 sm:bottom-7 sm:left-7 sm:right-7">
        <span>Perfil público</span><span className="h-px flex-1 bg-white/25" aria-hidden /><span>AxéCloud</span>
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
      <MatrizEditorialLayout showFooter={false}>
        <div className="relative z-[1] grid min-h-dvh place-items-center pt-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#b98500]" />
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#1b1813]/45">Abrindo o perfil da casa</p>
          </div>
        </div>
      </MatrizEditorialLayout>
    );
  }

  if (error || !terreiro) {
    return (
      <MatrizEditorialLayout>
        <main className="relative z-[1] mx-auto grid min-h-[72vh] w-full max-w-[1180px] place-items-center px-5 pb-24 pt-36 text-center sm:px-7 lg:px-8">
          <div className="max-w-xl rounded-[2rem] border border-[#d9ccb7] bg-[#fffaf1]/90 p-8 shadow-[0_25px_80px_rgba(54,42,24,.12)] sm:p-12">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">Diretório AxéCloud</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#1b1813]">{error || 'Terreiro não encontrado'}</h1>
            <a href={ROUTES.terreiros} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#172018] px-6 py-3 text-sm font-extrabold text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden />Voltar ao diretório
            </a>
          </div>
        </main>
      </MatrizEditorialLayout>
    );
  }

  const mapHref = ROUTES.terreiros;
  const localidade = [terreiro.cidade, terreiro.estado].filter(Boolean).join(' · ');
  const claimHref = `https://wa.me/5511920033501?text=${encodeURIComponent(`Olá! Sou responsável pela casa ${terreiro.nome}${localidade ? `, em ${localidade}` : ''}, e quero reivindicar este perfil no AxéCloud.`)}`;
  const instagramUrl = (terreiro as DiretorioTerreiro & { instagramUrl?: string | null }).instagramUrl;

  return (
    <MatrizEditorialLayout>
      <main className="relative z-[1] mx-auto w-full max-w-[1260px] px-4 pb-24 pt-28 sm:px-7 sm:pt-32 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
          <a href={mapHref} className="inline-flex items-center gap-2 text-sm font-extrabold text-[#1b1813]/58 transition hover:text-[#8a6200]">
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Voltar para o Mapa
          </a>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#1b1813]/38">Informações públicas · confira antes de visitar</p>
        </div>

        <article className="overflow-hidden rounded-[2rem] border border-[#2a342c]/25 bg-[#f8efe1] shadow-[0_35px_110px_rgba(45,37,25,.18)]">
          <div className="grid lg:min-h-[37rem] lg:grid-cols-[1.08fr_.92fr]">
            <header className="relative flex flex-col justify-between overflow-hidden px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
              <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(83,65,34,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(83,65,34,.08)_1px,transparent_1px)] [background-size:72px_72px]" aria-hidden />
              <div className="pointer-events-none absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full border border-[#b98500]/15" aria-hidden />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-[#8a6200]">Diretório AxéCloud · casa mapeada</p>
                  {terreiro.verificada ? <VerifiedBadge /> : null}
                </div>
                <h1 className="mt-6 max-w-[15ch] text-balance text-[clamp(2.5rem,6.3vw,5.4rem)] font-extrabold leading-[0.94] tracking-[-0.065em] text-[#181a16]">{terreiro.nome}</h1>
                {localidade ? <p className="mt-7 flex items-center gap-2.5 text-sm font-bold text-[#1b1813]/58 sm:text-base"><MapPin className="h-4 w-4 shrink-0 text-[#a67300]" aria-hidden />{localidade}</p> : null}
              </div>

              <div className="relative mt-14 grid grid-cols-2 border-y border-[#cbbb9f]/65 sm:grid-cols-3">
                <div className="py-4 pr-4 sm:py-5"><span className="block text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#1b1813]/38">Tipo de página</span><strong className="mt-1.5 block text-sm text-[#1b1813]">Perfil público</strong></div>
                <div className="border-l border-[#cbbb9f]/65 px-4 py-4 sm:py-5"><span className="block text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#1b1813]/38">Localidade</span><strong className="mt-1.5 block truncate text-sm text-[#1b1813]">{terreiro.estado || 'Brasil'}</strong></div>
                <div className="col-span-2 border-t border-[#cbbb9f]/65 py-4 sm:col-span-1 sm:border-l sm:border-t-0 sm:px-4 sm:py-5"><span className="block text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#1b1813]/38">Situação</span><strong className="mt-1.5 flex items-center gap-1.5 text-sm text-[#1b1813]"><span className="h-2 w-2 rounded-full bg-emerald-600" />Listado</strong></div>
              </div>
            </header>

            <TerreiroPortrait fotoUrl={terreiro.fotoUrl} nome={terreiro.nome} />
          </div>
        </article>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <section className="rounded-[2rem] border border-[#d8cbb5] bg-[#fffaf1]/92 px-6 py-7 shadow-[0_22px_65px_rgba(63,49,27,.08)] sm:px-9 sm:py-9" aria-labelledby="visit-heading">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">Dados disponíveis</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <h2 id="visit-heading" className="text-3xl font-extrabold tracking-[-0.045em] text-[#1b1813] sm:text-4xl">Planeje sua visita.</h2>
              <span className="text-xs font-semibold text-[#1b1813]/42">Confirme diretamente com a casa</span>
            </div>

            <div className="mt-6 border-y border-[#cfc1ab]/60">
              <InfoRow icon={MapPin} label="Endereço">{terreiro.endereco || <span className="font-medium text-[#1b1813]/45">Endereço não informado</span>}</InfoRow>
              <InfoRow icon={Phone} label="Telefone">
                {terreiro.telefone ? <a href={telefoneHref(terreiro.telefone)} className="underline decoration-[#b98500]/35 underline-offset-4 transition hover:text-[#8a6200]">{formatTelefoneBr(terreiro.telefone)}</a> : <span className="font-medium text-[#1b1813]/45">Telefone não informado</span>}
              </InfoRow>
              {instagramUrl ? (
                <InfoRow icon={Instagram} label="Instagram">
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void trackConversionEvent('cta_click', { ctaId: 'directory-profile-instagram', ctaLabel: 'Abrir Instagram da casa', metadata: { slug: terreiro.slug } })}
                    className="inline-flex items-center gap-2 underline decoration-[#b98500]/35 underline-offset-4 transition hover:text-[#8a6200]"
                  >
                    Abrir Instagram da casa
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  </a>
                </InfoRow>
              ) : null}
            </div>

            {terreiro.linkMaps ? (
              <a
                href={terreiro.linkMaps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void trackConversionEvent('cta_click', { ctaId: 'directory-profile-map', ctaLabel: 'Traçar rota no Google Maps', metadata: { slug: terreiro.slug } })}
                className="mt-7 inline-flex w-full items-center justify-between gap-3 rounded-xl bg-[#e5ae12] px-5 py-4 text-sm font-extrabold text-[#11150f] shadow-[0_14px_35px_rgba(181,132,0,.18)] transition hover:bg-[#efb91e] sm:w-auto sm:min-w-72"
              >
                <span className="flex items-center gap-2"><Compass className="h-4 w-4" aria-hidden />Traçar rota no Google Maps</span><ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              </a>
            ) : null}
          </section>

          <aside className="overflow-hidden rounded-[2rem] border border-[#233328] bg-[#102117] text-white shadow-[0_25px_75px_rgba(16,33,23,.2)] lg:sticky lg:top-28">
            <div className="relative p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(229,174,18,.17)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.17)_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden />
              <div className="relative">
                <Compass className="h-7 w-7 text-[#e5ae12]" aria-hidden />
                <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#e5ae12]">Antes de ir</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">A visita começa pelo respeito.</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/62">Datas, horários e regras de entrada podem mudar. Entre em contato com a casa antes de se deslocar.</p>
              </div>
            </div>
            <a href={mapHref} className="flex items-center justify-between gap-4 border-t border-white/12 px-6 py-5 text-sm font-extrabold text-white transition hover:bg-white/[0.05] sm:px-7">Voltar para o Mapa<ArrowRight className="h-4 w-4 text-[#e5ae12]" aria-hidden /></a>
          </aside>
        </div>

        <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-[#c9b990] bg-[#eadfbf]/70 px-6 py-8 sm:px-9 sm:py-10" aria-labelledby="management-title">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border border-[#9b6a00]/15" aria-hidden />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-3xl gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#172018] text-[#e5ae12]"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#8a6200]">Para dirigentes e zeladores</p>
                <h2 id="management-title" className="mt-1.5 text-2xl font-extrabold tracking-[-0.035em] text-[#1b1813] sm:text-3xl">Organize a casa sem expor o fundamento.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#1b1813]/62">Financeiro, filhos de santo, giras, comunicação e memória reunidos em um ambiente privado.</p>
              </div>
            </div>
            <a href="/conteudo/gestao-de-terreiros" onClick={() => void trackConversionEvent('cta_click', { ctaId: 'directory-profile-management', ctaLabel: 'Conhecer o AxéCloud' })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#172018] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#28372d]">Conhecer o AxéCloud<ArrowRight className="h-4 w-4 text-[#e5ae12]" aria-hidden /></a>
          </div>
        </section>

        <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-[#2b251d] bg-[#0c120e] p-6 text-white shadow-[0_25px_70px_rgba(20,25,18,.18)] sm:p-9" aria-labelledby="claim-house-title">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(229,174,18,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.14)_1px,transparent_1px)] [background-size:64px_64px]" aria-hidden />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e5ae12] text-[#1b1813]"><BadgeCheck className="h-5 w-5" aria-hidden /></span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#e5ae12]">Responsáveis pela casa</p>
                <h2 id="claim-house-title" className="mt-1 text-xl font-extrabold sm:text-2xl">Esta é sua casa?</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/62">Reivindique o perfil para corrigir os dados públicos e identificar oficialmente a casa no diretório.</p>
              </div>
            </div>
            {terreiro.verificada ? (
              <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-6 py-3.5 text-sm font-extrabold text-emerald-200"><BadgeCheck className="h-4 w-4" aria-hidden />Perfil verificado</span>
            ) : (
              <a
                href={claimHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void trackConversionEvent('cta_click', { ctaId: 'directory-profile-claim', ctaLabel: 'Reivindicar esta casa', metadata: { slug: terreiro.slug } })}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e5ae12] px-6 py-3.5 text-sm font-extrabold text-[#1b1813] transition hover:bg-[#ffcd38]"
              >
                <BadgeCheck className="h-4 w-4" aria-hidden />
                Reivindicar esta casa
              </a>
            )}
          </div>
        </section>
      </main>
    </MatrizEditorialLayout>
  );
}
