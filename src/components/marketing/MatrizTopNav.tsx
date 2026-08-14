import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from '../../hooks/usePathname';
import { ROUTES } from '../../lib/routes';
import { LoginLink } from './LoginLink';
import { RegisterTrialLink } from './RegisterTrialLink';

const navLinks = [
  { href: '/#casa', label: 'A casa' },
  { href: '/#organizacao', label: 'O que resolve' },
  { href: '/#seguranca', label: 'Segurança' },
  { href: '/#memoria', label: 'Memória' },
  { href: '/#descobrir', label: 'Explorar' },
  { href: ROUTES.terreiros, label: 'Terreiros' },
  { href: ROUTES.eventosPublicos, label: 'Eventos' },
  { href: ROUTES.contentHub, label: 'Conteúdo' },
  { href: ROUTES.whyAxeCloud, label: 'Por quê?' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/#plano', label: 'Planos' },
] as const;

export function MatrizTopNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  return (
    <header className="fixed inset-x-0 top-[18px] z-[80] px-4 font-sans">
      <nav
        className="relative mx-auto flex h-[62px] w-full max-w-[1180px] items-center gap-4 rounded-lg border border-white/15 bg-[#0c0e0b]/95 px-3 pl-4 text-[#f4f0e4] shadow-[0_12px_40px_rgba(0,0,0,.22)] backdrop-blur-xl"
        aria-label="Navegação principal"
      >
        <a href="/" className="flex shrink-0 items-center gap-2" aria-label="AxéCloud — página inicial">
          <img src="/axecloud-trident.png" alt="" className="h-[47px] w-9 object-contain" width="36" height="47" />
          <strong className="text-[15px] font-extrabold tracking-[-.04em]">
            Axé<span className="text-[#e5ae12]">Cloud</span>
          </strong>
        </a>

        <div className="mx-auto hidden items-center justify-center gap-[17px] xl:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-[10px] font-bold text-[#aaa99f] transition hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-4 xl:flex">
          <LoginLink className="text-[11px] font-extrabold text-[#dedbd2] transition hover:text-white" />
          <RegisterTrialLink className="inline-flex h-10 items-center gap-2 rounded-md bg-[#e5ae12] px-4 text-[11px] font-extrabold text-[#17150e] transition hover:bg-[#f0bb21]">
            Testar grátis <span aria-hidden>→</span>
          </RegisterTrialLink>
        </div>

        <button
          type="button"
          className="ml-auto grid h-10 w-10 place-items-center rounded-md border border-white/15 text-white xl:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="menu-publico"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {open ? (
          <div id="menu-publico" className="absolute right-0 top-[69px] flex max-h-[calc(100dvh-105px)] w-[min(370px,calc(100vw-32px))] flex-col overflow-y-auto rounded-lg border border-white/15 bg-[#10130e] p-2 shadow-2xl xl:hidden">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="border-b border-white/[.07] px-4 py-3 text-sm font-bold text-[#d4d2c9] hover:text-white">
                {link.label}
              </a>
            ))}
            <LoginLink className="border-b border-white/[.07] px-4 py-3 text-sm font-bold text-[#e5ae12]">Entrar</LoginLink>
            <RegisterTrialLink className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-[#e5ae12] px-4 text-sm font-extrabold text-[#17150e]">
              Testar grátis
            </RegisterTrialLink>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
