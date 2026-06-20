import { Instagram } from 'lucide-react';
import { TikTokIcon } from '../icons/TikTokIcon';
import { landingMockupShellClass } from '../landing/landingMockupUi';
import { SOCIAL_LINKS } from '../../constants/socialLinks';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { LandingMockupLogo } from './MarketingTopNav';

const CNPJ = '66.335.964/0001-07';

export function MarketingMockupFooter() {
  return (
    <footer className="relative z-[1] border-t border-white/10 bg-black py-16 text-white/60" role="contentinfo">
      <div className={`grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 ${landingMockupShellClass}`}>
        <div className="space-y-4">
          <LandingMockupLogo variant="footer" />
          <p className="text-xs leading-relaxed">
            Portal e software para terreiros de Umbanda, Candomblé e Jurema — casas, eventos públicos, pedidos de reza e
            gestão da casa.
          </p>
          <ul className="flex items-center gap-2" aria-label="Redes sociais oficiais">
            {SOCIAL_LINKS.map(({ id, href, label, rel }) => (
              <li key={id}>
                <a
                  href={href}
                  target="_blank"
                  rel={rel}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 text-white/70 transition hover:border-[#FFC107]/40 hover:text-[#FFC107]"
                  aria-label={`${label} @axecloudoficial`}
                >
                  {id === 'instagram' ? <Instagram className="h-4 w-4" /> : <TikTokIcon className="h-4 w-4" />}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">Portal</h6>
          <ul className="space-y-2 text-xs">
            <li>
              <a href={ROUTES.terreiros} className="text-white/60 transition hover:text-[#FFC107]">
                Terreiros
              </a>
            </li>
            <li>
              <a href={ROUTES.eventosPublicos} className="text-white/60 transition hover:text-[#FFC107]">
                Eventos públicos
              </a>
            </li>
            <li>
              <a href={ROUTES.espacoDoFiel} className="text-white/60 transition hover:text-[#FFC107]">
                Pedir reza
              </a>
            </li>
            <li>
              <a href={ROUTES.liturgicalCalendar} className="text-white/60 transition hover:text-[#FFC107]">
                Calendário litúrgico
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">Plataforma</h6>
          <ul className="space-y-2 text-xs">
            <li>
              <a href={`${ROUTES.home}#recursos`} className="text-white/60 transition hover:text-[#FFC107]">
                Recursos
              </a>
            </li>
            <li>
              <a href={`${ROUTES.home}#demonstracao`} className="text-white/60 transition hover:text-[#FFC107]">
                Demo interativa
              </a>
            </li>
            <li>
              <a href={ROUTES.founderProgram} className="text-white/60 transition hover:text-[#FFC107]">
                Programa Fundador
              </a>
            </li>
            <li>
              <a href={`${ROUTES.home}#mensalidade`} className="text-white/60 transition hover:text-[#FFC107]">
                Planos
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">Conta</h6>
          <ul className="space-y-2 text-xs">
            <li>
              <a href={appHref(ROUTES.login)} className="text-white/60 transition hover:text-[#FFC107]">
                Entrar
              </a>
            </li>
            <li>
              <a href={appHref(ROUTES.register)} className="text-white/60 transition hover:text-[#FFC107]">
                Cadastrar terreiro
              </a>
            </li>
            <li>
              <a href={ROUTES.contentHub} className="text-white/60 transition hover:text-[#FFC107]">
                Conteúdo
              </a>
            </li>
            <li>
              <a href={ROUTES.glossary} className="text-white/60 transition hover:text-[#FFC107]">
                Glossário do axé
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">Legal</h6>
          <ul className="space-y-2 text-xs">
            <li>
              <a href={`${ROUTES.home}#seguranca`} className="text-white/60 transition hover:text-[#FFC107]">
                Segurança e LGPD
              </a>
            </li>
            <li>
              <a href={ROUTES.terms} className="text-white/60 transition hover:text-[#FFC107]">
                Termos de Uso
              </a>
            </li>
            <li>
              <a href={ROUTES.privacy} className="text-white/60 transition hover:text-[#FFC107]">
                Política de Privacidade
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div
        className={`mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/15 pt-6 text-center text-xs sm:flex-row ${landingMockupShellClass}`}
      >
        <p>© {new Date().getFullYear()} Ilê Asé — CNPJ: {CNPJ}</p>
        <p className="italic">Axé — com respeito às tradições de matriz africana.</p>
      </div>
    </footer>
  );
}
