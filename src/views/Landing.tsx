import { useCallback, useEffect, useState } from 'react';
import { ArrowUp, Instagram, MessageCircle } from 'lucide-react';
import { TikTokIcon } from '../components/icons/TikTokIcon';
import { LandingTopNav, LogoMark } from '../components/marketing/MarketingTopNav';
import { PortalHomeHub } from '../components/landing/PortalHomeHub';
import { SOCIAL_LINKS } from '../constants/socialLinks';
import { cn } from '../lib/utils';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';

const WA_COMERCIAL = 'https://wa.me/5511912276156';
const CNPJ = '66.335.964/0001-07';

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 360);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="Voltar ao topo"
      className={cn(
        'fixed bottom-6 right-4 z-[80] grid h-12 w-12 touch-manipulation place-items-center rounded-full border border-primary/50 bg-primary text-[#080A0D] shadow-[0_0_28px_rgba(250,204,21,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 sm:bottom-8 sm:right-6',
        visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

export default function Landing() {
  return (
    <div className="landing-v3 axecloud-landing-enter relative min-h-dvh overflow-x-hidden bg-[#080A0D] text-[#F1F5F9]">
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 -z-10 h-[650px] bg-gradient-to-b from-[#0D0F12] to-[#080A0D]"
        aria-hidden
      />

      <span id="top" className="sr-only" aria-hidden />

      <LandingTopNav />

      <main className="relative z-[1] selection:bg-[#1E293B] selection:text-white">
        <PortalHomeHub />
      </main>

      <footer className="relative z-[1] border-t border-[#13171D] bg-[#07090C] py-16 text-[#94A3B8]" role="contentinfo">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:px-8">
          <div className="space-y-4">
            <LogoMark compact />
            <p className="text-xs leading-relaxed">
              Portal e software para terreiros de Umbanda, Candomblé e Jurema — casas, eventos públicos, pedidos de reza
              e gestão da casa.
            </p>
            <ul className="flex items-center gap-2" aria-label="Redes sociais oficiais">
              {SOCIAL_LINKS.map(({ id, href, label, rel }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel={rel}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#1E242B] text-[#94A3B8] transition hover:border-primary/30 hover:text-primary"
                    aria-label={`${label} @axecloudoficial`}
                  >
                    {id === 'instagram' ? <Instagram className="h-4 w-4" /> : <TikTokIcon className="h-4 w-4" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Portal</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a href={ROUTES.terreiros} className="hover:text-[#F1F5F9]">
                  Terreiros
                </a>
              </li>
              <li>
                <a href={ROUTES.eventosPublicos} className="hover:text-[#F1F5F9]">
                  Eventos públicos
                </a>
              </li>
              <li>
                <a href={ROUTES.espacoDoFiel} className="hover:text-[#F1F5F9]">
                  Pedir reza
                </a>
              </li>
              <li>
                <a href={ROUTES.liturgicalCalendar} className="hover:text-[#F1F5F9]">
                  Calendário litúrgico
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Conta</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a href={appHref(ROUTES.login)} className="hover:text-[#F1F5F9]">
                  Entrar
                </a>
              </li>
              <li>
                <a href={appHref(ROUTES.register)} className="hover:text-[#F1F5F9]">
                  Cadastrar terreiro
                </a>
              </li>
              <li>
                <a href={ROUTES.founderProgram} className="hover:text-[#F1F5F9]">
                  Programa Fundador
                </a>
              </li>
              <li>
                <a href={ROUTES.contentHub} className="hover:text-[#F1F5F9]">
                  Conteúdo
                </a>
              </li>
              <li>
                <a href={ROUTES.glossary} className="hover:text-[#F1F5F9]">
                  Glossário do axé
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Comercial</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={WA_COMERCIAL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#F1F5F9]"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  WhatsApp comercial
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Legal</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a href={ROUTES.terms} className="hover:text-[#F1F5F9]">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href={ROUTES.privacy} className="hover:text-[#F1F5F9]">
                  Política de Privacidade
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-[#13171D] px-4 pt-6 text-center text-xs sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} AxéCloud — CNPJ: {CNPJ}</p>
          <p className="italic">Axé — com respeito às tradições de matriz africana.</p>
        </div>
      </footer>

      <ScrollToTopButton />
    </div>
  );
}
