import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { landingBrandLogo } from '../../constants/landingScreenshots';
import { usePathname } from '../../hooks/usePathname';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { LoginLink } from './LoginLink';
import { RegisterTrialLink } from './RegisterTrialLink';

const navLinks = [
  { href: ROUTES.terreiros, label: 'Terreiros' },
  { href: ROUTES.eventosPublicos, label: 'Eventos' },
  { href: ROUTES.espacoDoFiel, label: 'Pedir reza' },
  { href: ROUTES.recursos, label: 'Recursos' },
  { href: ROUTES.contentHub, label: 'Conteúdo' },
  { href: `${ROUTES.home}#mensalidade`, label: 'Mensalidade' },
  { href: ROUTES.whyAxeCloud, label: 'Por que AxéCloud' },
] as const;

export function MatrizTopNav() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    let last = window.scrollY > 24;
    setScrolled(last);

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = window.scrollY > 24;
        if (next !== last) {
          last = next;
          setScrolled(next);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-x-0 top-3 z-[60] px-3 sm:top-4 sm:px-4"
      style={{ transform: 'translateZ(0)' }}
    >
      <nav
        className={cn(
          'mx-auto flex w-full max-w-6xl min-w-0 items-center justify-between gap-2 rounded-full border px-2 py-1.5 shadow-xl backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 sm:gap-3 sm:px-3 sm:py-2',
          scrolled
            ? 'border-[#ffc107]/25 bg-[#fdf8f0]/92 shadow-[#ffc107]/10'
            : 'border-[#e8dfd0]/80 bg-white/72 shadow-black/5',
        )}
      >
        <a href={ROUTES.home} className="flex min-w-0 shrink items-center gap-2 rounded-full pr-1 sm:gap-2.5 sm:pr-3" aria-label="AxéCloud — início">
          <img
            src={landingBrandLogo()}
            alt=""
            aria-hidden
            className="h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11"
            decoding="async"
          />
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block text-sm font-black tracking-tight text-[#1b1813]">AxéCloud</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#a87400]">
              Gestão de terreiros
            </span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-4 py-2 text-xs font-bold text-[#1b1813]/62 transition-colors hover:bg-[#ffc107]/12 hover:text-[#a87400]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <LoginLink className="rounded-full px-4 py-2.5 text-xs font-bold text-[#1b1813]/65 transition-colors hover:bg-white/70 hover:text-[#a87400]" />
          <RegisterTrialLink className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffc107] px-5 py-2.5 text-xs font-bold text-[#1b1813] shadow-md shadow-[#ffc107]/15 transition-colors hover:bg-[#ffcd38]" />
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[#e8dfd0] bg-white text-[#1b1813] md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-3 w-[calc(100vw-1.5rem)] max-w-md rounded-3xl border border-[#e8dfd0] bg-[#fdf8f0]/95 p-4 shadow-2xl shadow-black/10 backdrop-blur-md md:hidden"
        >
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded-2xl px-4 py-3 font-bold text-[#1b1813]/75 hover:bg-[#ffc107]/10"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <LoginLink
                className="block rounded-2xl px-4 py-3 font-bold text-[#1b1813]/75 hover:bg-[#ffc107]/10"
                onNavigate={() => setOpen(false)}
              />
            </li>
            <li className="pt-2">
              <RegisterTrialLink
                className="inline-flex w-full items-center justify-center rounded-full bg-[#ffc107] px-5 py-3 text-sm font-bold text-[#1b1813]"
                onNavigate={() => setOpen(false)}
              />
            </li>
          </ul>
        </motion.div>
      ) : null}
    </motion.header>
  );
}
