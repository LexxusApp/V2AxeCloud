import { useEffect, useState } from 'react';
import { Calendar, Heart, Loader2, MapPin, MessageCircle } from 'lucide-react';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { landingMockupCardClass, landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { cn } from '../../lib/utils';
import { VerifiedBadge } from '../../components/portal/VerifiedBadge';
import { PortalDenunciaForm } from '../../components/portal/PortalDenunciaForm';
import { fetchPublicTerreiro, tradicaoLabel, type PublicTerreiro } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { marketingHref } from '../../lib/appHref';

function slugFromPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const idx = parts.indexOf('terreiros');
  if (idx < 0) return '';
  if (parts[idx + 1] === 'cidade') return '';
  return decodeURIComponent(parts[idx + 1] || '');
}

export default function TerreiroProfilePage() {
  const [terreiro, setTerreiro] = useState<PublicTerreiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slug = slugFromPath();

  useEffect(() => {
    if (!slug) {
      setError('Endereço inválido.');
      setLoading(false);
      return;
    }
    void fetchPublicTerreiro(slug)
      .then(setTerreiro)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não encontrado'))
      .finally(() => setLoading(false));
  }, [slug]);

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

  const location = [terreiro.bairro, terreiro.cidade, terreiro.estado].filter(Boolean).join(' · ');

  return (
    <MarketingMockupLayout>
      <main className="relative z-[1] px-4 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-lg">
          <div className={cn('overflow-hidden rounded-2xl', landingMockupCardClass)}>
            {terreiro.fotoUrl ? (
              <div className="aspect-[16/9] max-h-44 overflow-hidden bg-[#f3ebe0] sm:max-h-48">
                <img src={terreiro.fotoUrl} alt="" className="h-full w-full object-cover object-center" />
              </div>
            ) : null}
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-2">
                <h1 className="text-lg font-black leading-snug text-[#1b1813] sm:text-xl">{terreiro.nome}</h1>
                {terreiro.verificada ? <VerifiedBadge /> : null}
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#1b1813]/66">
                {tradicaoLabel(terreiro.tradicao)}
              </p>
              {location ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-[#1b1813]/65">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FFC107]" />
                  {location}
                </p>
              ) : null}
              {terreiro.descricao ? (
                <p className="mt-3 text-sm leading-relaxed text-[#1b1813]/75">{terreiro.descricao}</p>
              ) : null}
              {terreiro.mensagemPedidos ? (
                <blockquote className="mt-3 border-l-2 border-[#FFC107]/50 pl-3 text-sm italic text-[#1b1813]/65">
                  {terreiro.mensagemPedidos}
                </blockquote>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {terreiro.pedidosUrl ? (
                  <a
                    href={marketingHref(terreiro.pedidosUrl)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e11d48] px-4 py-2.5 text-sm font-black text-white"
                  >
                    <Heart className="h-4 w-4" />
                    Pedir reza
                  </a>
                ) : null}
                <a
                  href={ROUTES.eventosPublicos}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--mockup-card-border,#cfc0a8)] bg-white px-4 py-2.5 text-sm font-bold text-[#1b1813] transition hover:border-[#FFC107]/45"
                >
                  <Calendar className="h-4 w-4" />
                  Eventos públicos
                </a>
                {terreiro.whatsapp ? (
                  <a
                    href={`https://wa.me/55${terreiro.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFC107]/40 bg-[#FFC107]/10 px-4 py-2.5 text-sm font-bold text-[#1b1813] transition hover:bg-[#FFC107]/20"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                ) : null}
              </div>

              {typeof terreiro.visualizacoes === 'number' ? (
                <p className="mt-3 text-xs text-[#1b1813]/62">{terreiro.visualizacoes} visualizações no portal</p>
              ) : null}
            </div>
          </div>

          <div className={cn('mt-5 p-4 sm:p-5', landingMockupCardClass, 'rounded-2xl')}>
            <PortalDenunciaForm slug={terreiro.slug} />
          </div>
        </div>
      </main>
    </MarketingMockupLayout>
  );
}
