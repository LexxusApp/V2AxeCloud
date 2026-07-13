import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Crown,
  Flame,
  Flower2,
  Heart,
  Images,
  Leaf,
  Lock,
  MessageCircle,
  Package,
  HardDrive,
  Database,
  Server,
  Shield,
  ShoppingBag,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { landingScreenshot } from '../../constants/landingScreenshots';
import { commercialWhatsAppUrl } from '../../constants/commercialContact';
import { MatrizTopNav } from '../marketing/MatrizTopNav';
import { RegisterTrialLink } from '../marketing/RegisterTrialLink';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { TRIAL_DAYS } from '../../../lib/planPricing';

type GlowStyle = CSSProperties & Record<`--${string}`, string | number>;

const glowStyles = `
  @media (hover: hover) and (pointer: fine) {
  [data-matriz-glow]::before,
  [data-matriz-glow]::after {
    pointer-events: none;
    content: "";
    position: absolute;
    inset: calc(var(--border-size) * -1);
    border: var(--border-size) solid transparent;
    border-radius: calc(var(--radius) * 1px);
    background-attachment: scroll;
    background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
    background-repeat: no-repeat;
    background-position: 50% 50%;
    mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
    mask-clip: padding-box, border-box;
    mask-composite: intersect;
  }

  [data-matriz-glow]::before {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
      calc(var(--x, 0) * 1px)
      calc(var(--y, 0) * 1px),
      hsl(var(--hue, 42) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 56) * 1%) / var(--border-spot-opacity, 1)), transparent 100%
    );
    filter: brightness(2);
  }

  [data-matriz-glow]::after {
    background-image: radial-gradient(
      calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
      calc(var(--x, 0) * 1px)
      calc(var(--y, 0) * 1px),
      hsl(0 100% 100% / var(--border-light-opacity, 0.72)), transparent 100%
    );
  }

  [data-matriz-glow] [data-matriz-glow] {
    position: absolute;
    inset: 0;
    will-change: filter;
    opacity: var(--outer, 1);
    border-radius: calc(var(--radius) * 1px);
    border-width: calc(var(--border-size) * 20);
    filter: blur(calc(var(--border-size) * 10));
    background: none;
    pointer-events: none;
    border: none;
  }

  [data-matriz-glow] > [data-matriz-glow]::before {
    inset: -10px;
    border-width: 10px;
  }
  }
`;

const traditions = ['Umbanda', 'Candomblé', 'Jurema', 'Casa mista'] as const;

const heroHighlights = [
  { icon: Wallet, label: 'Financeiro + Pix' },
  { icon: CalendarDays, label: 'Calendário de giras' },
  { icon: Users, label: 'Portal do filho' },
  { icon: Shield, label: 'Dados protegidos' },
] as const;

const heroTrust = ['30 dias grátis', 'Sem cartão', 'Suporte humano', 'Dados privados'] as const;

const HERO_COMMERCIAL_URL = commercialWhatsAppUrl(
  'Olá! Quero conhecer o AxéCloud e entender como implantar na minha casa de axé.',
);

const routine = [
  { step: '01', title: 'Mensalidade Pix', desc: 'Filho paga, diretoria acompanha em tempo real.' },
  { step: '02', title: 'Gira no calendário', desc: 'Escala, presença e avisos no mural.' },
  { step: '03', title: 'Memória da casa', desc: 'Galeria de festas, obrigações e momentos.' },
  { step: '04', title: 'Portal do filho', desc: 'Biblioteca, estudos e comunicação da corrente.' },
] as const;

const agendaFeatures = [
  { icon: CalendarDays, label: 'Giras e festas no calendário da casa' },
  { icon: Sparkles, label: 'Obrigações e compromissos litúrgicos' },
  { icon: CheckCircle2, label: 'Convites com confirmação de presença' },
  { icon: UserCheck, label: 'Filhos veem a agenda; diretoria gerencia' },
  { icon: Bell, label: 'Lembretes para a comunidade' },
] as const;

const philosophyPillars = [
  {
    icon: Lock,
    title: 'Privacidade Silenciosa',
    body: 'Ambiente fechado da casa religiosa. Ficha de desenvolvimento espiritual, batismo e feitura do médium protegidos sob sigilo canônico.',
  },
  {
    icon: Leaf,
    title: 'Respeito Litúrgico',
    body: 'Termos reais: Amaci do Médium, Orixá de Cabeça, Guia de Frente, Adoxado, Ogãs, Cambones, Coroa de Santo e Obrigações de Anos.',
  },
  {
    icon: Users,
    title: 'Conexão na Corrente',
    body: 'Avisos, escala de giras, aniversariantes e formações aproximam o terreiro dos filhos sem perder a essência da casa.',
  },
] as const;

const securityStats = [
  { value: '100%', label: 'HTTPS criptografado', tone: 'text-emerald-400' },
  { value: '24/7', label: 'Monitoramento ativo', tone: 'text-sky-400' },
  { value: 'LGPD', label: 'Conformidade legal', tone: 'text-[#ffc107]' },
  { value: '1 casa', label: 'Isolamento por terreiro', tone: 'text-violet-400' },
] as const;

const securityPoints = [
  {
    icon: Shield,
    title: 'Servidores dedicados',
    body: 'Infraestrutura própria em VPS dedicado na Europa — sem dividir máquina com sites genéricos. Performance e controle total do ambiente AxéCloud.',
  },
  {
    icon: Lock,
    title: 'Dados sob sigilo',
    body: 'Fichas litúrgicas, obrigações e financeiro da casa ficam em ambiente fechado. Sem anúncios, sem venda de dados e sem indexação em buscadores.',
  },
  {
    icon: Database,
    title: 'Isolamento multi-tenant',
    body: 'Cada terreiro acessa somente o que é seu: regras na API, políticas no banco e sessão autenticada em camadas — defesa em profundidade.',
  },
  {
    icon: HardDrive,
    title: 'Backup e continuidade',
    body: 'Cópias automáticas na nuvem, redundância e rotina de recuperação para a história da sua casa não depender de um único disco.',
  },
] as const;

const modules: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Wallet,
    title: 'Financeiro + Pix',
    description: 'Mensalidades, doações e despesas com histórico transparente para a diretoria.',
  },
  {
    icon: CalendarDays,
    title: 'Calendário de giras',
    description: 'Giras, festas e obrigações: filhos veem a agenda, zelador gerencia presença.',
  },
  {
    icon: Users,
    title: 'Filhos de santo',
    description: 'Cadastro litúrgico, guias, desenvolvimento espiritual e portal próprio.',
  },
  {
    icon: Images,
    title: 'Galeria da casa',
    description: 'Memória do terreiro: festas, giras e momentos da comunidade organizados.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Meta',
    description: 'Lembretes de mensalidade e avisos de gira com comunicação respeitosa.',
  },
  {
    icon: BookOpen,
    title: 'Biblioteca de estudos',
    description: 'Material formativo para filhos de santo, controlado pela diretoria.',
  },
  {
    icon: ShoppingBag,
    title: 'Loja do axé',
    description: 'Artigos da casa integrados ao financeiro do terreiro.',
  },
  {
    icon: Package,
    title: 'Almoxarifado',
    description: 'Velas, ervas e insumos litúrgicos sob controle.',
  },
];

const traditionCards = [
  {
    name: 'Umbanda',
    icon: Flower2,
    color: 'border-violet-300/50 bg-violet-50 text-violet-800',
    headline: 'Giras, pontos cantados e guias',
    items: ['Calendário de giras', 'Mural para avisos', 'Guia de frente e linha', 'Galeria de festas'],
  },
  {
    name: 'Candomblé',
    icon: Flame,
    color: 'border-amber-300/50 bg-amber-50 text-amber-900',
    headline: 'Obrigações, toques e nação',
    items: ['Obrigações de anos', 'Orixá de cabeça', 'Ogãs e escalas', 'Financeiro com Pix'],
  },
  {
    name: 'Jurema & mistas',
    icon: Sparkles,
    color: 'border-emerald-300/50 bg-emerald-50 text-emerald-900',
    headline: 'Flexível à sua linha',
    items: ['Termos personalizáveis', 'Portal do filho', 'Diretório público', 'App instalável PWA'],
  },
] as const;

const audience = [
  {
    icon: Crown,
    role: 'Zeladores e diretoria',
    text: 'Painel completo: financeiro, filhos, giras, galeria e mural, sem planilha no WhatsApp.',
  },
  {
    icon: Heart,
    role: 'Filhos de santo',
    text: 'Portal com biblioteca, calendário, mensalidades e avisos da casa.',
  },
  {
    icon: Sparkles,
    role: 'Comunidade',
    text: 'Diretório de terreiros, eventos públicos e pedido de reza online.',
  },
] as const;

function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 md:px-8', className)}>{children}</div>;
}

function AtabaqueIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 64" fill="none" className={className} aria-hidden>
      <path
        d="M14 8h20c2 0 4 2 4 4v44c0 2-2 4-4 4H14c-2 0-4-2-4-4V12c0-2 2-4 4-4z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <ellipse cx="24" cy="12" rx="12" ry="4" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="24" cy="52" rx="12" ry="4" stroke="currentColor" strokeWidth="2" />
      <path d="M10 22h28M10 32h28M10 42h28" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M24 4v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GuiasPattern({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 24" className={className} preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: 20 }).map((_, i) => (
        <circle
          key={i}
          cx={10 + i * 10}
          cy="12"
          r="3.5"
          fill={i % 3 === 0 ? '#ffc107' : i % 3 === 1 ? '#b45309' : '#166534'}
          fillOpacity="0.55"
        />
      ))}
    </svg>
  );
}

function TerreiroDivider() {
  return (
    <div className="relative z-10 flex items-center justify-center gap-4 py-6" aria-hidden>
      <div className="h-px flex-1 bg-[#e8dfd0]" />
      <AtabaqueIcon className="h-8 w-6 text-[#a87400]/70" />
      <div className="h-px flex-1 bg-[#e8dfd0]" />
    </div>
  );
}

function AtabaqueDivider() {
  return (
    <div className="relative z-10 flex items-center justify-center gap-4 py-8" aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e8dfd0] to-[#ffc107]/40" />
      <div className="matriz-atabaque-pulse relative">
        <div className="matriz-atabaque-glow absolute inset-0 rounded-full bg-[#ffc107]/20 blur-md" />
        <AtabaqueIcon className="relative h-9 w-7 text-[#a87400]" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#e8dfd0] to-[#ffc107]/40" />
    </div>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return <motion.div className="fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-[#ffc107]" style={{ scaleX: scrollYProgress }} aria-hidden />;
}

function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]',
        dark ? 'border border-[#ffc107]/35 bg-[#ffc107]/12 text-[#ffc107]' : 'bg-[#ffc107] text-[#1b1813]',
      )}
    >
      {children}
    </span>
  );
}

function Reveal({
  children,
  className,
  delay = 0,
  direction = 'up',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
}) {
  const offset = direction === 'left' ? { x: 44 } : direction === 'right' ? { x: -44 } : { y: 44 };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, filter: 'blur(10px)', ...offset }}
      whileInView={{ opacity: 1, filter: 'blur(0px)', x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function TextReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.span
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.055, delayChildren: delay } },
      }}
    >
      {text.split(' ').map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden"
          variants={{
            hidden: { opacity: 0, y: '110%', rotate: 2 },
            visible: {
              opacity: 1,
              y: 0,
              rotate: 0,
              transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          <span className="inline-block">{word}&nbsp;</span>
        </motion.span>
      ))}
    </motion.span>
  );
}

function usePointerGlowEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return enabled;
}

const staticModuleCardClass =
  'relative grid h-full grid-rows-[1fr_auto] gap-4 overflow-hidden rounded-2xl border border-white/10 bg-[#14110d] p-5 shadow-[0_1rem_2rem_-1rem_black]';

function GlowCard({ children, className }: { children: ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowEnabled = usePointerGlowEnabled();

  useEffect(() => {
    if (!glowEnabled) return;
    const syncPointer = (e: PointerEvent) => {
      if (!cardRef.current) return;
      const { clientX: x, clientY: y } = e;
      cardRef.current.style.setProperty('--x', x.toFixed(2));
      cardRef.current.style.setProperty('--xp', (x / window.innerWidth).toFixed(2));
      cardRef.current.style.setProperty('--y', y.toFixed(2));
      cardRef.current.style.setProperty('--yp', (y / window.innerHeight).toFixed(2));
    };
    document.addEventListener('pointermove', syncPointer, { passive: true });
    return () => document.removeEventListener('pointermove', syncPointer);
  }, [glowEnabled]);

  if (!glowEnabled) {
    return <div className={cn(staticModuleCardClass, className)}>{children}</div>;
  }

  const style: GlowStyle = {
    '--base': 42,
    '--spread': 18,
    '--radius': '16',
    '--border': '1.5',
    '--backdrop': 'hsl(0 0% 10% / 1)',
    '--backup-border': 'hsl(0 0% 23% / 1)',
    '--size': '260',
    '--outer': '1',
    '--bg-spot-opacity': '0.16',
    '--border-spot-opacity': '1',
    '--border-light-opacity': '0.75',
    '--saturation': '100',
    '--lightness': '56',
    '--border-size': 'calc(var(--border, 2) * 1px)',
    '--spotlight-size': 'calc(var(--size, 150) * 1px)',
    '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px)
      calc(var(--y, 0) * 1px),
      hsl(var(--hue, 42) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 56) * 1%) / var(--bg-spot-opacity, 0.12)), transparent
    )`,
    backgroundColor: 'var(--backdrop, transparent)',
    backgroundSize: 'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
    backgroundPosition: '50% 50%',
    backgroundAttachment: 'scroll',
    border: 'var(--border-size) solid var(--backup-border)',
    position: 'relative',
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: glowStyles }} />
      <div
        ref={cardRef}
        data-matriz-glow
        style={style}
        className={cn(
          'relative grid h-full grid-rows-[1fr_auto] gap-4 overflow-hidden rounded-2xl p-5 shadow-[0_1rem_2rem_-1rem_black]',
          className,
        )}
      >
        <div data-matriz-glow />
        {children}
      </div>
    </>
  );
}

function MatrizBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let time = 0;
    let mx = 0.5;
    let my = 0.75;
    let embers: Array<{ x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number }> = [];

    const spawn = () => {
      embers.push({
        x: Math.random() * w,
        y: h + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.4 + Math.random() * 0.9),
        size: 1.5 + Math.random() * 3,
        life: 0,
        maxLife: 120 + Math.random() * 100,
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      embers = [];
      for (let i = 0; i < 45; i += 1) spawn();
    };

    const tick = () => {
      try {
        time += 1;
        wrap.style.setProperty('--beat', String(0.85 + (0.5 + 0.5 * Math.sin(time * 0.09)) * 0.15));
        ctx.clearRect(0, 0, w, h);

        if (embers.length < 55 && time % 8 === 0) spawn();

        for (const ember of embers) {
          ember.life += 1;
          ember.x += ember.vx + Math.sin(time * 0.02 + ember.y * 0.01) * 0.15;
          ember.y += ember.vy;
          const remaining = 1 - ember.life / ember.maxLife;
          const alpha = remaining * remaining * 0.5;
          if (alpha <= 0) continue;

          const gradient = ctx.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, ember.size * 3);
          gradient.addColorStop(0, `rgba(255, 193, 7, ${alpha})`);
          gradient.addColorStop(1, 'rgba(255, 193, 7, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(ember.x, ember.y, ember.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        embers = embers.filter((ember) => ember.life < ember.maxLife);

        const glow = ctx.createRadialGradient(mx * w, my * h, 0, mx * w, my * h, w * 0.35);
        glow.addColorStop(0, 'rgba(255, 193, 7, 0.07)');
        glow.addColorStop(1, 'rgba(255, 193, 7, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      } catch {
        // Background animation must never break the landing page.
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      mx = e.clientX / w;
      my = e.clientY / h;
      wrap.style.setProperty('--mx', `${mx * 100}%`);
      wrap.style.setProperty('--my', `${my * 100}%`);
    };

    resize();
    tick();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ '--mx': '50%', '--my': '75%', '--beat': '1' } as CSSProperties}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#fdf8f0]" />
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: 'calc(var(--beat) * 0.95)',
          background: `
            radial-gradient(ellipse 80% 50% at var(--mx) var(--my), rgba(255,193,7,0.16) 0%, transparent 50%),
            radial-gradient(ellipse 60% 35% at 50% 100%, rgba(180,83,9,0.1) 0%, transparent 45%),
            linear-gradient(180deg, #fdf8f0 0%, #faf3e6 50%, #f3e8d4 100%)
          `,
        }}
      />
      <div className="matriz-pattern-kente matriz-animate-kente-drift absolute inset-0 opacity-[0.35]" />
      <div className="matriz-pattern-grain absolute inset-0 opacity-35" />
      <canvas ref={canvasRef} className="absolute inset-0 mix-blend-multiply opacity-80" />
    </div>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.32]);

  return (
    <section ref={ref} id="plataforma" className="relative z-10 overflow-x-clip pb-16 pt-28 md:pb-24 md:pt-36">
      <Shell>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div style={{ y: copyY, opacity }}>
            <Reveal>
              <span className="matriz-kicker-pulse inline-flex max-w-full rounded-full bg-[#ffc107] px-3.5 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.16em] text-[#1b1813] sm:text-left sm:text-[10px]">
                Gestão de Terreiros de Umbanda e Candomblé
              </span>
            </Reveal>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-[#1b1813] sm:text-5xl md:text-[3.25rem]">
              <TextReveal text="O software da sua" delay={0.1} />
              <br />
              <TextReveal text="casa de axé" delay={0.35} className="text-[#a87400]" />
            </h1>

            <Reveal delay={0.2}>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-[#1b1813]/65 md:text-lg">
                Mensalidade Pix, giras, mural, galeria, diretório público e portal do filho de santo,
                feito para organizar a casa sem perder o respeito ao sagrado.
              </p>
            </Reveal>

            <Reveal delay={0.28}>
              <div className="mt-4 flex flex-wrap gap-2">
                {traditions.map((tradition) => (
                  <span
                    key={tradition}
                    className="rounded-full border border-[#e8dfd0] bg-white px-3 py-1 text-xs font-bold text-[#1b1813]/70"
                  >
                    {tradition}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.31}>
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Condições para começar">
                {heroTrust.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-xs font-bold text-[#1b1813]/62">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.34}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <RegisterTrialLink className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffc107] px-7 py-3.5 text-sm font-bold text-[#1b1813] shadow-md shadow-[#ffc107]/25 transition hover:bg-[#ffcd38]">
                  Teste grátis {TRIAL_DAYS} dias
                  <ArrowRight className="h-4 w-4" />
                </RegisterTrialLink>
                <motion.a
                  href={HERO_COMMERCIAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e8dfd0] bg-white px-7 py-3.5 text-sm font-bold text-[#1b1813] transition hover:border-[#ffc107]/50 hover:text-[#a87400]"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden />
                  Falar com uma pessoa
                </motion.a>
              </div>
              <a
                href={ROUTES.terreiros}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#a87400] transition hover:text-[#1b1813]"
              >
                Explorar o diretório público
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Reveal>

            <Reveal delay={0.4}>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
                {heroHighlights.map((highlight, i) => (
                  <motion.li
                    key={highlight.label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.07 }}
                    className="flex items-center gap-2 text-sm font-semibold text-[#1b1813]/55"
                  >
                    <highlight.icon className="h-4 w-4 text-[#a87400]" aria-hidden />
                    {highlight.label}
                  </motion.li>
                ))}
              </ul>
            </Reveal>
          </motion.div>

          <Reveal direction="left" delay={0.15} className="relative">
            <motion.div style={{ y: imgY, scale: imgScale }} className="relative">
              <motion.div
                className="overflow-hidden rounded-2xl border border-[#e8dfd0] bg-white p-2 shadow-lg shadow-[#ffc107]/15"
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <img
                  src={landingScreenshot('painel-dashboard-landing.png')}
                  alt="Dashboard do AxéCloud — painel real de gestão do terreiro"
                  className="w-full rounded-xl"
                  loading="eager"
                />
              </motion.div>
            </motion.div>
            <div className="matriz-drift-x mt-6">
              <GuiasPattern className="h-4 w-full opacity-80" />
            </div>
          </Reveal>
        </div>
      </Shell>
    </section>
  );
}

const liturgyTerms = [
  'Axé',
  'Gira',
  'Obrigação',
  'Ogã',
  'Cambone',
  'Coroa de Santo',
  'Filho de Santo',
  'Barracão',
  'Toque',
  'Mensalidade',
  'Guia de Frente',
  'Orixá de Cabeça',
  'Umbanda',
  'Candomblé',
  'Terreiro',
] as const;

function MarqueeRow({ reverse = false }: { reverse?: boolean }) {
  const items = [...liturgyTerms, ...liturgyTerms];
  return (
    <div className="flex overflow-hidden">
      <div
        className={cn(
          'flex shrink-0 gap-8 whitespace-nowrap px-4',
          reverse ? 'matriz-marquee-row matriz-marquee-row--reverse' : 'matriz-marquee-row',
        )}
      >
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-8 text-sm font-bold uppercase tracking-[0.2em] text-[#a87400]/45"
          >
            {item}
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffc107]/60" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}

function LiturgyMarquee() {
  return (
    <div className="relative z-10 border-y border-[#e8dfd0] bg-white/70 py-4 backdrop-blur-sm" aria-hidden>
      <MarqueeRow />
      <div className="mt-3">
        <MarqueeRow reverse />
      </div>
    </div>
  );
}

function RoutineSection() {
  return (
    <section className="relative z-10 overflow-x-clip py-16 md:py-20">
      <Shell className="mb-8">
        <Reveal>
          <Kicker>Rotina do terreiro</Kicker>
          <h2 className="mt-4 text-2xl font-extrabold text-[#1b1813] md:text-3xl">
            Do Pix a gira, tudo no mesmo fluxo
          </h2>
        </Reveal>
      </Shell>

      <motion.div
        className="mx-auto grid max-w-6xl grid-flow-col auto-cols-[min(85vw,320px)] gap-5 overflow-x-auto px-5 pb-4 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid-flow-row md:grid-cols-2 md:overflow-visible md:px-8 lg:grid-cols-4"
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7 }}
      >
        {routine.map((item, i) => (
          <motion.article
            key={item.step}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.1, duration: 0.55 }}
            className="h-full overflow-hidden rounded-2xl border border-[#e8dfd0] bg-white p-6 shadow-sm md:p-7"
          >
            <span className="font-mono text-3xl font-black text-[#ffc107]/45">{item.step}</span>
            <h3 className="mt-3 text-lg font-bold text-[#1b1813]">{item.title}</h3>
            <p className="mt-2 text-sm text-[#1b1813]/55">{item.desc}</p>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[#e8dfd0]">
              <motion.div
                className="h-full bg-[#ffc107]"
                initial={{ width: '0%' }}
                whileInView={{ width: '100%' }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.12, duration: 0.9 }}
              />
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

function AgendaSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.97, 1, 0.97]);
  const copyY = useTransform(scrollYProgress, [0, 1], [16, -16]);

  return (
    <section ref={ref} id="agenda" className="relative z-10 bg-[#fdf8f0] py-20 md:py-28">
      <AtabaqueDivider />
      <Shell>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal direction="right" delay={0.1} className="relative order-2 lg:order-1">
            <motion.div style={{ y: imgY, scale: imgScale }} className="relative">
              <motion.div
                className="overflow-hidden rounded-2xl border border-[#e8dfd0] bg-white p-2 shadow-lg shadow-rose-200/25"
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <img
                  src={landingScreenshot('painel-inicio.png')}
                  alt="Painel do zelador com calendário de giras e eventos do terreiro"
                  className="w-full rounded-xl"
                  loading="lazy"
                />
              </motion.div>
            </motion.div>
            <div className="matriz-drift-x mt-6">
              <GuiasPattern className="h-4 w-full opacity-80" />
            </div>
          </Reveal>

          <motion.div style={{ y: copyY }} className="order-1 lg:order-2">
            <Reveal>
              <span className="matriz-kicker-pulse inline-flex rounded-full bg-rose-100 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-rose-800">
                Agenda da casa
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-[#1b1813] md:text-4xl">
                Calendário de giras, festas e obrigações
              </h2>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-[#1b1813]/65">
                Giras, festas, obrigações e eventos. Convites com confirmação de presença e lembretes para a
                comunidade.
              </p>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#1b1813]/55">
                Giras, compromissos e a agenda alinhada à casa — tudo visível para a diretoria e acessível aos
                filhos de santo.
              </p>
            </Reveal>

            <motion.ul
              className="mt-8 space-y-3"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
            >
              {agendaFeatures.map((feature) => (
                <motion.li
                  key={feature.label}
                  variants={{ hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } }}
                  className="flex items-center gap-3 rounded-2xl border border-[#e8dfd0] bg-white px-4 py-3 shadow-sm"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-[#ffc107]/10">
                    <feature.icon className="h-4 w-4 text-rose-600" aria-hidden />
                  </div>
                  <span className="text-sm font-semibold text-[#1b1813]/75">{feature.label}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </Shell>
    </section>
  );
}

function PhilosophySection() {
  return (
    <section id="tradição" className="relative z-10 bg-white py-20 md:py-28">
      <TerreiroDivider />
      <Shell>
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a87400]">
              Nossa filosofia
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#1b1813] md:text-4xl">
              Ungido com <span className="text-[#a87400]">respeito e tradição</span>
            </h2>
            <div className="mt-4 h-1 w-10 rounded-full bg-[#ffc107]" />
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#1b1813]/65">
              Diferente de ERP de escritório, o AxéCloud foi esculpido com zeladores, mães e pais de santo,
              ogãs e médiuns, porque gestão de terreiro tem ritmo, liturgia e sigilo.
            </p>
          </Reveal>

          <motion.div
            className="space-y-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.12 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {philosophyPillars.map((pillar, i) => (
              <motion.article
                key={pillar.title}
                className="flex gap-5 overflow-hidden rounded-2xl border border-[#e8dfd0] bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#ffc107]/35 hover:shadow-md hover:shadow-[#ffc107]/10 sm:p-7"
                variants={{
                  hidden: { opacity: 0, y: 28, filter: 'blur(8px)' },
                  visible: {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
              >
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#ffc107]/30 bg-[#ffc107]/12">
                    <pillar.icon className="h-5 w-5 text-[#a87400]" />
                  </div>
                  <span className="text-xs font-black text-[#1b1813]/20">0{i + 1}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1b1813]">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/60">{pillar.body}</p>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </Shell>
    </section>
  );
}

function MatrizServerRack() {
  const units = [
    { leds: ['#34d399', '#38bdf8', '#fbbf24', '#34d399', '#f87171'] },
    { leds: ['#38bdf8', '#34d399', '#a78bfa', '#38bdf8', '#34d399'] },
    { leds: ['#fbbf24', '#34d399', '#38bdf8', '#f87171', '#a78bfa'] },
    { leds: ['#34d399', '#a78bfa', '#fbbf24', '#38bdf8', '#34d399'] },
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <motion.div
        className="absolute -inset-6 rounded-[2rem] bg-[#ffc107]/12 blur-3xl"
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.96, 1.04, 0.96] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[#ffc107]/25 bg-gradient-to-b from-[#1f1a14] to-[#0b0906] p-5 shadow-2xl shadow-black/40">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-[#ffc107]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffc107]/90">Rack dedicado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="matriz-server-led inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">Online</span>
          </div>
        </div>

        <div className="space-y-3">
          {units.map((unit, unitIndex) => (
            <div
              key={unitIndex}
              className="rounded-xl border border-white/10 bg-gradient-to-r from-[#14110d] via-[#17130f] to-[#12100c] p-3 shadow-inner"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/35">
                  NODE-0{unitIndex + 1}
                </span>
                <div className="matriz-server-fan flex gap-0.5 opacity-60">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className="h-3 w-0.5 rounded-full bg-white/25" />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {unit.leds.map((color, ledIndex) => (
                  <span
                    key={ledIndex}
                    className={cn(
                      'matriz-server-led h-2 rounded-full shadow-[0_0_12px_currentColor]',
                      ledIndex % 3 === 0 && 'matriz-server-led--delay-1',
                      ledIndex % 3 === 1 && 'matriz-server-led--delay-2',
                      ledIndex % 3 === 2 && 'matriz-server-led--delay-3',
                    )}
                    style={{ backgroundColor: color, color }}
                  />
                ))}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#ffc107]/20 via-[#ffc107] to-[#ffc107]/20"
                  animate={{ x: ['-100%', '220%'] }}
                  transition={{ duration: 2.2 + unitIndex * 0.35, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[9px] text-white/45">
          <div className="rounded-lg border border-white/8 bg-white/5 px-2 py-1.5">
            <span className="block text-emerald-400">CPU</span>
            <span className="matriz-server-led--delay-2 text-white/70">12% load</span>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/5 px-2 py-1.5">
            <span className="block text-sky-400">RAM</span>
            <span className="matriz-server-led--delay-1 text-white/70">estável</span>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/5 px-2 py-1.5">
            <span className="block text-[#ffc107]">I/O</span>
            <span className="matriz-server-led--delay-3 text-white/70">ativo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [32, -32]);

  return (
    <section ref={ref} id="seguranca" className="relative z-10 bg-[#1b1813] py-20 text-[#fdf8f0] md:py-28">
      <Shell>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <Reveal className="max-w-2xl">
              <Kicker dark>Segurança & confiança</Kicker>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight md:text-4xl">
                Seus dados em servidores dedicados, com sigilo de casa
              </h2>
              <p className="mt-4 text-[#fdf8f0]/60">
                O AxéCloud não é rede social aberta: é gestão profissional com infraestrutura própria, criptografia,
                isolamento por terreiro e políticas alinhadas à LGPD para dados religiosos sensíveis.
              </p>
            </Reveal>

            <motion.div
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
            >
              {securityStats.map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-4 text-center backdrop-blur-sm"
                >
                  <p className={cn('text-xl font-black', stat.tone)}>{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#fdf8f0]/45">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-8 space-y-3">
              {securityPoints.map((point, i) => (
                <Reveal key={point.title} delay={0.05 * i}>
                  <article className="flex gap-4 rounded-2xl border border-[#ffc107]/15 bg-white/[0.04] p-4 backdrop-blur-sm">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#ffc107]/25 bg-[#ffc107]/10">
                      <point.icon className="h-5 w-5 text-[#ffc107]" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#ffc107]">{point.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[#fdf8f0]/62">{point.body}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>

          <motion.div style={{ y }} className="relative">
            <MatrizServerRack />
            <p className="mt-5 text-center text-xs text-[#fdf8f0]/40">
              Infraestrutura monitorada em tempo real — ambiente exclusivo AxéCloud, sem hospedagem compartilhada.
            </p>
          </motion.div>
        </div>
      </Shell>
    </section>
  );
}

function TraditionsSection() {
  return (
    <section id="umbanda-candomble" className="relative z-10 py-20 md:py-28">
      <Shell>
        <Reveal className="text-center">
          <Kicker>Para cada casa</Kicker>
          <h2 className="mt-5 text-3xl font-extrabold text-[#1b1813] md:text-4xl">
            Umbanda, Candomblé e Jurema no mesmo sistema
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[#1b1813]/60">
            Não é app genérico: é gestão pensada para barracão, gira, obrigação, comunidade e privacidade da casa.
          </p>
        </Reveal>

        <motion.div
          className="mt-14 grid gap-5 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        >
          {traditionCards.map((tradition) => (
            <motion.article
              key={tradition.name}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8dfd0] bg-white p-6 shadow-sm"
              variants={{
                hidden: { opacity: 0, y: 28, scale: 0.9 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55 } },
              }}
            >
              <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${tradition.color}`}>
                <tradition.icon className="h-3.5 w-3.5" aria-hidden />
                {tradition.name}
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#1b1813]">{tradition.headline}</h3>
              <ul className="mt-4 flex-1 space-y-2.5">
                {tradition.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-[#1b1813]/65">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a87400]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </motion.div>
      </Shell>
    </section>
  );
}

function ModulesSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [48, -48]);
  const lineScale = useTransform(scrollYProgress, [0.05, 0.45], [0.25, 1]);

  return (
    <section ref={ref} id="recursos" className="relative z-10 overflow-hidden bg-[#0b0906] py-20 text-[#fff8ea] md:py-28">
      <span id="módulos" className="sr-only" aria-hidden />
      <motion.div
        style={{ y: bgY }}
        className="pointer-events-none absolute inset-x-0 top-8 mx-auto h-72 max-w-5xl rounded-full bg-[#ffc107]/18 blur-3xl"
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px origin-top bg-gradient-to-b from-[#ffc107]/70 via-white/15 to-transparent"
        style={{ scaleY: lineScale }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,193,7,0.08),transparent_36%),linear-gradient(180deg,#0b0906_0%,#110d08_100%)]" />
      <div className="matriz-pattern-terreiro pointer-events-none absolute inset-0 opacity-[0.08]" />

      <Shell className="relative">
        <Reveal className="text-center">
          <Kicker dark>14 módulos reais</Kicker>
          <h2 className="mt-4 text-3xl font-extrabold text-white md:text-4xl">
            Do barracão ao celular do filho
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/58">
            Painel do zelador, portal público, diretório de terreiros e PWA instalável, tudo no plano Premium.
          </p>
          <div className="matriz-drift-x-slow mx-auto mt-7 max-w-2xl" aria-hidden>
            <GuiasPattern className="h-4 w-full opacity-75" />
          </div>
        </Reveal>

        <motion.div
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {modules.map((module, i) => (
            <motion.div
              key={module.title}
              variants={{
                hidden: { opacity: 0, y: 28, filter: 'blur(8px)' },
                visible: {
                  opacity: 1,
                  y: 0,
                  filter: 'blur(0px)',
                  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              className="h-full"
            >
              <GlowCard>
                <div className="relative">
                  <div
                    className="matriz-wiggle mb-3 inline-flex rounded-xl border border-[#ffc107]/30 bg-[#ffc107]/12 p-2.5 text-[#ffc107]"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  >
                    <module.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="font-bold text-white">{module.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/58">{module.description}</p>
                </div>
                <motion.div
                  className="absolute inset-x-5 bottom-4 h-px origin-left bg-gradient-to-r from-[#ffc107] via-[#ffc107]/40 to-transparent"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.7 }}
                  aria-hidden
                />
              </GlowCard>
            </motion.div>
          ))}
        </motion.div>
      </Shell>
    </section>
  );
}

function CommunitySection() {
  return (
    <section id="comunidade" className="relative z-10 py-20 md:py-28">
      <Shell>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a87400]">Para toda a corrente</span>
            <h2 className="mt-4 text-3xl font-extrabold text-[#1b1813] md:text-4xl">
              Zelador, filho e consulente, cada um no seu lugar
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#1b1813]/60">
              O AxéCloud separa o que é da diretoria do que é do filho de santo, com privacidade,
              portal público e termos litúrgicos para Umbanda, Candomblé e Jurema.
            </p>
            <div className="mt-8 inline-block rounded-2xl border border-[#ffc107]/35 bg-[#ffc107]/12 px-6 py-4">
              <p className="text-3xl font-extrabold text-[#a87400]">{TRIAL_DAYS} dias</p>
              <p className="text-xs font-bold uppercase tracking-widest text-[#1b1813]/50">grátis, sem cartão</p>
            </div>
          </Reveal>

          <div className="space-y-4">
            {audience.map((item, i) => (
              <Reveal key={item.role} delay={i * 0.08} direction="left">
                <article className="flex gap-4 overflow-hidden rounded-2xl border border-[#e8dfd0] bg-white p-5 shadow-sm">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffc107]/15">
                    <item.icon className="h-5 w-5 text-[#a87400]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1b1813]">{item.role}</h3>
                    <p className="mt-1 text-sm text-[#1b1813]/55">{item.text}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
        <GuiasPattern className="mt-12 h-4 w-full opacity-70" />
      </Shell>
    </section>
  );
}

export function MatrizLandingExperience() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#1b1813]">
      <ScrollProgress />
      <MatrizBackground />
      <MatrizTopNav />
      <Hero />
      <LiturgyMarquee />
      <AtabaqueDivider />
      <AgendaSection />
      <SecuritySection />
      <ModulesSection />
    </div>
  );
}
