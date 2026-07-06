import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';

export function MatrizPageBackground() {
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
    let my = 0.55;
    let embers: Array<{ x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number }> = [];

    const spawn = () => {
      embers.push({
        x: Math.random() * w,
        y: h + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.45 + Math.random() * 1.05),
        size: 2 + Math.random() * 4.2,
        life: 0,
        maxLife: 130 + Math.random() * 110,
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
      for (let i = 0; i < 54; i += 1) spawn();
    };

    const tick = () => {
      time += 1;
      wrap.style.setProperty('--beat', String(0.9 + (0.5 + 0.5 * Math.sin(time * 0.075)) * 0.12));
      ctx.clearRect(0, 0, w, h);

      if (embers.length < 76 && time % 6 === 0) spawn();

      for (const ember of embers) {
        ember.life += 1;
        ember.x += ember.vx + Math.sin(time * 0.018 + ember.y * 0.012) * 0.14;
        ember.y += ember.vy;
        const remaining = 1 - ember.life / ember.maxLife;
        const alpha = remaining * remaining * 0.68;
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

      const glow = ctx.createRadialGradient(mx * w, my * h, 0, mx * w, my * h, w * 0.34);
      glow.addColorStop(0, 'rgba(255, 193, 7, 0.16)');
      glow.addColorStop(1, 'rgba(255, 193, 7, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      mx = event.clientX / Math.max(w, 1);
      my = event.clientY / Math.max(h, 1);
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
      style={{ '--mx': '50%', '--my': '55%', '--beat': '1' } as CSSProperties}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#fdf8f0]" />
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: 'calc(var(--beat) * 0.95)',
          background: `
            radial-gradient(ellipse 74% 46% at var(--mx) var(--my), rgba(255,193,7,0.24) 0%, transparent 52%),
            radial-gradient(ellipse 60% 35% at 50% 100%, rgba(180,83,9,0.16) 0%, transparent 45%),
            linear-gradient(180deg, #fdf8f0 0%, #faf3e6 52%, #f3e8d4 100%)
          `,
        }}
      />
      <div className="matriz-bg-smoke absolute bottom-[-12%] left-[4%] h-[42vh] w-[42vw] min-w-80 rounded-full opacity-50" />
      <div className="matriz-bg-smoke matriz-bg-smoke--slow absolute bottom-[-15%] right-[2%] h-[48vh] w-[46vw] min-w-80 rounded-full opacity-45" />
      <div className="matriz-bg-orb absolute left-[8%] top-[18%] h-44 w-44 rounded-full bg-[#ffc107]/22 blur-3xl" />
      <div className="matriz-bg-orb matriz-bg-orb--alt absolute right-[10%] top-[28%] h-56 w-56 rounded-full bg-[#b45309]/16 blur-3xl" />
      <div className="matriz-pattern-kente matriz-animate-kente-drift absolute inset-0 opacity-[0.42]" />
      <div className="matriz-pattern-grain absolute inset-0 opacity-35" />
      <canvas ref={canvasRef} className="absolute inset-0 mix-blend-multiply opacity-100" />
    </div>
  );
}
