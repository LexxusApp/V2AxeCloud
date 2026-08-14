import { ROUTES } from '../../lib/routes';

const CNPJ = '66.335.964/0001-07';

const footerLinks = [
  { href: '/#casa', label: 'Recursos' },
  { href: ROUTES.terreiros, label: 'Terreiros' },
  { href: ROUTES.eventosPublicos, label: 'Eventos' },
  { href: ROUTES.contentHub, label: 'Conteúdo' },
  { href: ROUTES.privacy, label: 'Privacidade' },
  { href: ROUTES.terms, label: 'Termos' },
] as const;

export function MarketingMockupFooter() {
  return (
    <footer className="relative z-20 border-t border-white/10 bg-[#090b08] px-[max(5vw,24px)] pb-6 pt-11 font-sans text-[#8e9188]" role="contentinfo">
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-7 md:grid-cols-[auto_minmax(240px,1fr)] lg:grid-cols-[auto_minmax(240px,1fr)_auto]">
        <a href="/" className="flex items-center gap-2 text-[#f2eee3]" aria-label="AxéCloud — página inicial">
          <img src="/axecloud-trident.png" alt="" className="h-[49px] w-[38px] object-contain" width="38" height="49" />
          <strong className="text-[15px] font-extrabold tracking-[-.04em]">
            Axé<span className="text-[#e5ae12]">Cloud</span>
          </strong>
        </a>
        <p className="max-w-md text-xs leading-relaxed">Gestão profissional para casas de Umbanda, Candomblé e Jurema.</p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-3 lg:justify-end" aria-label="Links do rodapé">
          {footerLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-[11px] font-bold transition hover:text-[#f2eee3]">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-7 flex w-full max-w-[1180px] flex-col gap-3 border-t border-white/[.08] pt-5 text-[10px] text-[#5f625a] sm:flex-row sm:flex-wrap sm:justify-between">
        <span>© {new Date().getFullYear()} AxéCloud · CNPJ {CNPJ}</span>
        <span>Com respeito às tradições de matriz africana.</span>
        <a href="/" className="text-[#8e9188] transition hover:text-white">Voltar ao início ↑</a>
      </div>
    </footer>
  );
}
