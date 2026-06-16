import { useEffect, useState } from 'react';
import { Calendar, Heart, Loader2, MapPin, MessageCircle } from 'lucide-react';
import { MarketingSubpageTopNav } from '../../components/marketing/MarketingTopNav';
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
      <div className="grid min-h-screen place-items-center bg-[#080A0D]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FBBC00]" />
      </div>
    );
  }

  if (error || !terreiro) {
    return (
      <div className="min-h-screen bg-[#080A0D] px-4 py-20 text-center">
        <p className="text-lg font-bold text-white">{error || 'Terreiro não encontrado'}</p>
        <a href={ROUTES.terreiros} className="mt-4 inline-block text-sm font-bold text-[#FBBC00] hover:underline">
          Voltar ao diretório
        </a>
      </div>
    );
  }

  const location = [terreiro.bairro, terreiro.cidade, terreiro.estado].filter(Boolean).join(' · ');

  return (
    <div className="landing-v3 min-h-screen bg-[#080A0D] text-[#F1F5F9]">
      <MarketingSubpageTopNav />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-[#1E242B] bg-[#0B0D11]">
          {terreiro.fotoUrl ? (
            <div className="aspect-[21/9] bg-[#12161A]">
              <img src={terreiro.fotoUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="text-2xl font-black sm:text-3xl">{terreiro.nome}</h1>
              {terreiro.verificada ? <VerifiedBadge /> : null}
            </div>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-[#64748B]">
              {tradicaoLabel(terreiro.tradicao)}
            </p>
            {location ? (
              <p className="mt-3 flex items-center gap-2 text-[#94A3B8]">
                <MapPin className="h-4 w-4 text-[#FBBC00]" />
                {location}
              </p>
            ) : null}
            {terreiro.descricao ? <p className="mt-6 leading-relaxed text-[#CBD5E1]">{terreiro.descricao}</p> : null}
            {terreiro.mensagemPedidos ? (
              <blockquote className="mt-6 border-l-2 border-[#FBBC00]/50 pl-4 text-sm italic text-[#94A3B8]">
                {terreiro.mensagemPedidos}
              </blockquote>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              {terreiro.pedidosUrl ? (
                <a
                  href={marketingHref(terreiro.pedidosUrl)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#e11d48] px-5 py-3 text-sm font-black text-white"
                >
                  <Heart className="h-4 w-4" />
                  Pedir reza
                </a>
              ) : null}
              <a
                href={ROUTES.eventosPublicos}
                className="inline-flex items-center gap-2 rounded-xl border border-[#1E242B] px-5 py-3 text-sm font-bold text-[#F1F5F9]"
              >
                <Calendar className="h-4 w-4" />
                Eventos públicos
              </a>
              {terreiro.whatsapp ? (
                <a
                  href={`https://wa.me/55${terreiro.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 px-5 py-3 text-sm font-bold text-emerald-400"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : null}
            </div>

            {typeof terreiro.visualizacoes === 'number' ? (
              <p className="mt-6 text-xs text-[#64748B]">{terreiro.visualizacoes} visualizações no portal</p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-[#1E242B] bg-[#0B0D11] p-6">
          <PortalDenunciaForm slug={terreiro.slug} />
        </div>
      </main>
    </div>
  );
}
