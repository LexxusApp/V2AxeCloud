import { ROUTES } from '../../lib/routes';

const CNPJ = '66.335.964/0001-07';

const footerLinks = [
  { href: ROUTES.systemForTerreiros, label: 'Sistema' },
  { href: ROUTES.financialForTerreiros, label: 'Financeiro' },
  { href: ROUTES.duesForTerreiros, label: 'Mensalidades' },
  { href: ROUTES.membersForTerreiros, label: 'Filhos de santo' },
  { href: ROUTES.recursos, label: 'Recursos' },
  { href: ROUTES.terreiros, label: 'Terreiros' },
  { href: ROUTES.contentHub, label: 'Conteúdo' },
  { href: ROUTES.privacy, label: 'Privacidade' },
  { href: ROUTES.terms, label: 'Termos' },
] as const;

export function MarketingMockupFooter() {
  return (
    <footer className="relative z-20 border-t border-white/10 bg-[#090b08] px-[max(5vw,24px)] pb-6 pt-11 font-display text-[#8e9188]" role="contentinfo">
      <div className="mx-auto grid w-full max-w-[1180px] xl:max-w-[1340px] 2xl:max-w-[1540px] min-[1920px]:max-w-[1700px] grid-cols-1 items-center gap-7 md:grid-cols-[auto_minmax(240px,1fr)] lg:grid-cols-[auto_minmax(240px,1fr)_auto]">
        <a href="/" className="flex items-center gap-2 text-[#f2eee3]" aria-label="AxéCloud — página inicial">
          <img src="/axecloud-trident.png" alt="" className="h-[49px] 2xl:h-[54px] w-[38px] 2xl:w-[42px] object-contain" width="38" height="49" />
          <strong className="text-[15px] 2xl:text-[18px] font-extrabold tracking-[-.04em]">
            Axé<span className="text-[#e5ae12]">Cloud</span>
          </strong>
        </a>
        <p className="max-w-md text-xs 2xl:text-sm leading-relaxed">Gestão profissional para casas de Umbanda, Candomblé e Jurema.</p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-3 2xl:gap-x-6 2xl:gap-y-4 lg:justify-end" aria-label="Links do rodapé">
          {footerLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-[11px] xl:text-[12px] 2xl:text-[14px] font-bold transition hover:text-[#f2eee3]">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-7 flex w-full max-w-[1180px] xl:max-w-[1340px] 2xl:max-w-[1540px] min-[1920px]:max-w-[1700px] flex-col gap-3 border-t border-white/[.08] pt-5 text-[10px] xl:text-[11px] 2xl:text-xs text-[#5f625a] sm:flex-row sm:flex-wrap sm:justify-between">
        <span>© {new Date().getFullYear()} AxéCloud · CNPJ {CNPJ}</span>
        <span>Com respeito às tradições de matriz africana.</span>
        <a href="/" className="text-[#8e9188] transition hover:text-white">Voltar ao início ↑</a>
      </div>
    </footer>
  );
}
