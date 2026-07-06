import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { landingBrandLogo } from '../../constants/landingScreenshots';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { LoginLink } from './LoginLink';
import { RegisterTrialLink } from './RegisterTrialLink';

const navLinks = [
  { href: ROUTES.terreiros, label: 'Terreiros' },
  { href: ROUTES.eventosPublicos, label: 'Eventos' },
  { href: `${ROUTES.home}#agenda`, label: 'Agenda' },
  { href: `${ROUTES.home}#umbanda-candomble`, label: 'Umbanda & Candomblé' },
  { href: ROUTES.contentHub, label: 'Conteúdo' },
] as const;

export function MatrizTopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-x-0 top-4 z-[60] px-4 transition-all duration-300"
    >
      <nav
        className={cn(
          'mx-auto flex w-full max-w-6xl items-center justify-between rounded-full border px-3 py-2 shadow-xl backdrop-blur-xl transition-all duration-300',
          scrolled
            ? 'border-[#ffc107]/25 bg-[#fdf8f0]/88 shadow-[#ffc107]/10'
            : 'border-[#e8dfd0]/80 bg-white/68 shadow-black/5',
        )}
      >
        <a href={ROUTES.home} className="flex shrink-0 items-center gap-2.5 rounded-full pr-3" aria-label="AxéCloud — início">
          <img
            src={landingBrandLogo()}
            alt="AxéCloud — Gestão de Terreiros"
            className="h-10 w-10 object-contain drop-shadow-sm sm:h-11 sm:w-11"
          />
          <span className="hidden leading-tight sm:block">
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
                className="rounded-full px-4 py-2 text-xs font-bold text-[#1b1813]/62 transition hover:bg-[#ffc107]/12 hover:text-[#a87400]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <LoginLink className="rounded-full px-4 py-2.5 text-xs font-bold text-[#1b1813]/65 transition hover:bg-white/70 hover:text-[#a87400]" />
          <RegisterTrialLink className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffc107] px-5 py-2.5 text-xs font-bold text-[#1b1813] shadow-md shadow-[#ffc107]/15 transition hover:bg-[#ffcd38]" />
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
          className="mx-auto mt-3 max-w-sm rounded-3xl border border-[#e8dfd0] bg-[#fdf8f0]/95 p-4 shadow-2xl shadow-black/10 backdrop-blur-xl md:hidden"
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
