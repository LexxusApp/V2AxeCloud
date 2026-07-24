/* ═══════════════════════════════════════════════════════════
   AxéCloud — Protótipo Cinematográfico
   Animações (GSAP + Lenis), brasas em canvas e dados reais
   puxados da API do sistema via /api.
   ═══════════════════════════════════════════════════════════ */

/* Fonte versionada para o build de produção. */
gsap.registerPlugin(ScrollTrigger);

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Scroll suave (Lenis) ─────────────────────────────────── */
const lenis = reduzMovimento
  ? { scrollTo: (alvo) => alvo?.scrollIntoView?.({ behavior: "auto", block: "start" }) }
  : new Lenis({ duration: 1.15, smoothWheel: true });
if (!reduzMovimento) {
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  /* lagSmoothing padrão ajuda a recuperar FPS sem “pular” o visual de uma vez */
  gsap.ticker.lagSmoothing(500, 33);
}
ScrollTrigger.config({ ignoreMobileResize: true });

/* ── Brasas (escuro) / pó de pemba dourado (claro) ────────── */
(function brasas() {
  const canvas = $("#embers");
  if (!canvas) return;

  const temaClaro = document.body.classList.contains("tema-claro");
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  let W = 0, H = 0, dpr = 1, particulas = [];
  let rodando = true;
  let sprites = null;

  function fazSprite(quente) {
    const s = document.createElement("canvas");
    const size = 32;
    s.width = size;
    s.height = size;
    const c = s.getContext("2d");
    const mid = size / 2;
    const g = c.createRadialGradient(mid, mid, 0, mid, mid, mid);
    if (temaClaro) {
      if (quente) {
        g.addColorStop(0, "rgba(180, 120, 20, 0.55)");
        g.addColorStop(0.35, "rgba(255, 193, 7, 0.28)");
        g.addColorStop(1, "rgba(255, 193, 7, 0)");
      } else {
        g.addColorStop(0, "rgba(212, 160, 40, 0.42)");
        g.addColorStop(0.4, "rgba(212, 160, 40, 0.18)");
        g.addColorStop(1, "rgba(212, 160, 40, 0)");
      }
    } else if (quente) {
      g.addColorStop(0, "rgba(255, 170, 60, 0.95)");
      g.addColorStop(0.25, "rgba(255, 100, 25, 0.55)");
      g.addColorStop(1, "rgba(255, 80, 20, 0)");
    } else {
      g.addColorStop(0, "rgba(255, 220, 120, 0.9)");
      g.addColorStop(0.3, "rgba(255, 195, 70, 0.45)");
      g.addColorStop(1, "rgba(255, 195, 70, 0)");
    }
    c.fillStyle = g;
    c.beginPath();
    c.arc(mid, mid, mid, 0, Math.PI * 2);
    c.fill();
    return s;
  }

  function dimensiona() {
    dpr = Math.min(window.devicePixelRatio || 1, temaClaro ? 1.25 : 1.5);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.max(1, Math.floor(W * dpr));
    canvas.height = Math.max(1, Math.floor(H * dpr));
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  dimensiona();
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(dimensiona, 120);
  });
  document.addEventListener("visibilitychange", () => {
    rodando = document.visibilityState === "visible";
  });

  sprites = { quente: fazSprite(true), frio: fazSprite(false) };

  // Escuro: fagulhas da fogueira. Claro: pó dourado flutuando (pemba).
  function acende(p, inicio = false) {
    if (temaClaro) {
      p.x = Math.random() * W;
      p.y = inicio ? Math.random() * H : H + 8 + Math.random() * 30;
      p.r = 0.6 + Math.random() * 1.8;
      p.vy = 0.12 + Math.random() * 0.38;
      p.vx = (Math.random() - 0.5) * 0.22;
      p.fase = Math.random() * Math.PI * 2;
      p.vida = 0.55 + Math.random() * 0.45;
      p.gasta = 0.0007 + Math.random() * 0.0012;
      p.quente = Math.random() < 0.35;
      return p;
    }
    p.x = W * 0.5 + (Math.random() - 0.5) * W * 0.96;
    p.y = inicio ? H * (0.55 + Math.random() * 0.45) : H + 6 + Math.random() * 40;
    p.r = 0.8 + Math.random() * 2.1;
    p.vy = 0.45 + Math.random() * 1.05;
    p.vx = (Math.random() - 0.5) * 0.3;
    p.fase = Math.random() * Math.PI * 2;
    p.vida = 1;
    p.quente = Math.random() < 0.6;
    p.gasta = 0.0016 + Math.random() * 0.0026;
    return p;
  }

  const QTD = reduzMovimento
    ? 0
    : temaClaro
      ? Math.min(55, Math.floor(innerWidth / 24))
      : Math.min(70, Math.floor(innerWidth / 20));
  if (QTD === 0) {
    ctx.clearRect(0, 0, W, H);
    return;
  }
  for (let i = 0; i < QTD; i++) particulas.push(acende({}, true));

  function desenha(t) {
    if (!rodando) {
      requestAnimationFrame(desenha);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    for (const p of particulas) {
      p.y -= p.vy;
      p.x += p.vx + Math.sin(t / 700 + p.fase) * (temaClaro ? 0.35 : 0.55);
      p.vida -= p.gasta;
      if (p.vida <= 0 || p.y < (temaClaro ? -10 : H * 0.12)) acende(p);

      const alfa = temaClaro
        ? Math.max(0, p.vida) * (p.quente ? 0.95 : 0.75)
        : Math.max(0, p.vida) * (0.55 + 0.9 * (p.y / H));
      const raio = p.r * (temaClaro ? (0.6 + 0.5 * p.vida) : (0.5 + 0.5 * p.vida)) * 4.2;
      const spr = p.quente ? sprites.quente : sprites.frio;
      ctx.globalAlpha = Math.min(1, alfa);
      ctx.drawImage(spr, p.x - raio, p.y - raio, raio * 2, raio * 2);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(desenha);
  }
  requestAnimationFrame(desenha);
})();

/* ── Pontos riscados subindo na defumação ─────────────────── */
(function pontosNaFumaca() {
  if (reduzMovimento) return;
  const palco = $("#pontos-fumaca");
  if (!palco) return;
  const temaClaro = document.body.classList.contains("tema-claro");

  // Ferramentas e símbolos dos orixás e entidades (viewBox 0 0 100 100)
  const SIMBOLOS = [
    // Ofá de Oxóssi — arco e flecha
    `<path d="M28 12 Q78 50 28 88"/><path d="M28 12 L28 88"/><path d="M12 50 L86 50"/><path d="M74 42 L88 50 L74 58"/><path d="M12 50 L20 42 M12 50 L20 58"/>`,
    // Oxê de Xangô — machado de duas lâminas
    `<path d="M50 16 L50 88"/><path d="M50 20 C34 13 22 24 26 40 C34 33 42 31 50 34 Z"/><path d="M50 20 C66 13 78 24 74 40 C66 33 58 31 50 34 Z"/><path d="M43 88 L57 88"/>`,
    // Iemanjá — lua crescente e estrela sobre as ondas do mar
    `<path d="M60 14 A24 24 0 1 0 82 44 A18 18 0 0 1 60 14 Z"/><path d="M27 20 L30 29 L39 29 L32 34 L35 43 L27 38 L19 43 L22 34 L15 29 L24 29 Z"/><path d="M10 72 Q20 62 30 72 T50 72 T70 72 T90 72"/><path d="M10 84 Q20 74 30 84 T50 84 T70 84 T90 84"/>`,
    // Abebé de Oxum — espelho em forma de coração
    `<path d="M50 26 C38 10 18 20 22 38 C26 52 38 60 50 68 C62 60 74 52 78 38 C82 20 62 10 50 26 Z"/><circle cx="50" cy="38" r="7"/><path d="M50 68 L50 90"/><path d="M42 84 L58 84"/>`,
    // Raio de Iansã
    `<path d="M58 6 L32 50 L48 50 L38 94 L72 42 L54 42 Z"/>`,
    // Ogum — espada e escudo
    `<circle cx="50" cy="50" r="26"/><path d="M50 6 L50 88"/><path d="M36 70 L64 70"/><path d="M44 14 L50 4 L56 14"/>`,
    // Tridente de Exu — guardião das encruzilhadas
    `<path d="M50 92 L50 34"/><path d="M50 34 L50 12 M44 18 L50 10 L56 18"/><path d="M50 36 C36 36 28 26 30 12 M26 18 L30 10 L36 16"/><path d="M50 36 C64 36 72 26 70 12 M64 16 L70 10 L74 18"/>`,
    // Cachimbo do Preto Velho, com a fumaça subindo
    `<path d="M26 60 L26 70 C26 79 40 79 40 70 L40 60 Z"/><path d="M40 62 L82 46"/><path d="M31 52 Q26 44 33 38 Q39 32 34 24"/>`,
  ];

  const QTD = temaClaro
    ? Math.min(5, Math.max(3, Math.floor(innerWidth / 360)))
    : Math.min(6, Math.max(3, Math.floor(innerWidth / 320)));
  const picoOpacidade = temaClaro ? 0.11 : 0.13;

  function sobe(el, primeira = false) {
    const tam = 90 + Math.random() * 150;
    el.style.width = tam + "px";
    el.style.height = tam + "px";
    el.innerHTML = `<svg viewBox="0 0 100 100">${SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)]}</svg>`;

    const x = 4 + Math.random() * 88; // vw
    const dur = 34 + Math.random() * 26;
    const partida = primeira ? Math.random() * 0.7 : 0; // já no meio do caminho na 1ª leva
    el.style.left = x + "vw";

    // Só transform/opacity (GPU) — evita layout thrash de top/left
    const tl = gsap.timeline({ onComplete: () => sobe(el) });
    tl.fromTo(el,
      { y: "104vh", x: 0, rotate: (Math.random() - 0.5) * 14, force3D: true },
      {
        y: "-18vh",
        rotate: "+=" + (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8),
        duration: dur,
        ease: "none",
        force3D: true,
      }, 0)
      .fromTo(el, { opacity: 0 }, { opacity: picoOpacidade, duration: dur * 0.3, ease: "sine.inOut" }, 0)
      .to(el, { opacity: picoOpacidade * 0.75, duration: dur * 0.4, ease: "none" }, dur * 0.3)
      .to(el, { opacity: 0, duration: dur * 0.3, ease: "sine.inOut" }, dur * 0.7)
      .to(el, {
        x: (Math.random() - 0.5) * 90,
        duration: dur / 2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 1,
        force3D: true,
      }, 0);
    tl.progress(partida);
  }

  for (let i = 0; i < QTD; i++) {
    const el = document.createElement("div");
    el.className = "ponto-fumaca";
    palco.appendChild(el);
    sobe(el, true);
  }
})();

/* ── Cursor vagalume ──────────────────────────────────────── */
(function cursor() {
  const dot = $("#cursor-vagalume");
  if (!dot || !matchMedia("(pointer: fine)").matches) return;
  if (document.body.classList.contains("tema-claro")) return;
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  let preciso = false;
  gsap.set(dot, { xPercent: -50, yPercent: -50, x, y, force3D: true });
  addEventListener("mousemove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
    preciso = true;
  }, { passive: true });
  gsap.ticker.add(() => {
    if (!preciso && document.visibilityState !== "visible") return;
    x += (tx - x) * 0.16;
    y += (ty - y) * 0.16;
    gsap.set(dot, { x, y, force3D: true });
  });
  addEventListener("mouseover", (e) => {
    dot.classList.toggle("pousado", Boolean(e.target.closest("a, button")));
  });
})();

/* ── Preloader (só na primeira visita da sessão) ──────────── */
(function preloader() {
  let jaEntrou = false;
  try { jaEntrou = sessionStorage.getItem("axe-licenca") === "1"; } catch { /* navegador restritivo */ }
  if (jaEntrou || reduzMovimento) {
    $("#preloader").style.display = "none";
    abrirPortao();
    return;
  }
  try { sessionStorage.setItem("axe-licenca", "1"); } catch { /* navegador restritivo */ }

  const barra = $(".firmeza-progresso");
  let prog = 0;
  const iv = setInterval(() => {
    prog = Math.min(100, prog + 8 + Math.random() * 16);
    barra.style.width = prog + "%";
    if (prog >= 100) {
      clearInterval(iv);
      setTimeout(abrirPortao, 80);
    }
  }, 55);

  function abrirPortao() {
    $("#preloader").classList.add("apagado");
    if (reduzMovimento) return;
    // Entrada do hero — AxéCloud surge bem devagar (só opacity/y — sem blur, evita travar)
    const tl = gsap.timeline({ delay: 0.35 });
    tl.from(".hero-titulo .letra", {
      opacity: 0,
      y: 10,
      stagger: 0.16,
      duration: 2.6,
      ease: "sine.out",
      force3D: true,
    })
      .from(".hero-saudacao span", { yPercent: 110, duration: 1.1, ease: "power3.out" }, "-=0.5")
      .from(".hero-sub span", { yPercent: 110, duration: 1, ease: "power3.out" }, "-=0.55")
      .from(".hero-sub2 span", { yPercent: 110, duration: 1, ease: "power3.out" }, "-=0.65")
      .from(".hero-ctas .btn", { y: 26, opacity: 0, stagger: 0.14, duration: 0.85 }, "-=0.4")
      .from(".hero-scroll-dica", { opacity: 0, duration: 1.1 }, "-=0.2");
  }
})();

/* ── Ponto riscado: desenhado pela pemba conforme o scroll ── */
$$("#ponto-riscado .pr-traco").forEach((el) => {
  const len = el.getTotalLength ? el.getTotalLength() : 2000;
  el.style.strokeDasharray = len;
  el.style.strokeDashoffset = len;
  gsap.to(el, {
    strokeDashoffset: 0,
    ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom 20%", scrub: 1.2 },
  });
});
// O ponto some suave quando sai do hero
gsap.to(".ponto-riscado-wrap", {
  opacity: 0, scale: 1.25,
  scrollTrigger: { trigger: "#fundamento", start: "top 90%", end: "top 30%", scrub: true },
});

/* ── Reveals genéricos ────────────────────────────────────── */
$$("[data-reveal]").forEach((el) => {
  gsap.from(el, {
    y: 46, opacity: 0, duration: 1.05, ease: "power3.out",
    scrollTrigger: { trigger: el, start: "top 86%" },
  });
});

/* Manifesto: linhas acendem como pontos cantados */
$$(".fundamento-linhas .linha-grande").forEach((linha) => {
  gsap.to(linha, {
    color: "rgba(248, 243, 233, 0.96)",
    scrollTrigger: { trigger: linha, start: "top 74%", end: "top 42%", scrub: true },
  });
});

/* ── Fio de contas: progresso e navegação ─────────────────── */
(function fioDeContas() {
  const preenchido = $(".fio-preenchido");
  const contas = $$(".conta");
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => { preenchido.style.height = self.progress * 100 + "%"; },
  });
  contas.forEach((c) => {
    const alvo = $(c.dataset.alvo);
    if (!alvo) return;
    c.addEventListener("click", () => lenis.scrollTo(alvo, { offset: -20 }));
    ScrollTrigger.create({
      trigger: alvo, start: "top 55%", end: "bottom 45%",
      onToggle: (self) => c.classList.toggle("acesa", self.isActive),
    });
  });
})();

/* ═══ CONTEÚDO ══════════════════════════════════════════════ */

/* Os 14 módulos reais do sistema (landingModules) com símbolos do nicho */
const MODULOS = [
  { nome: "Painel do Zelador", desc: "A visão do pai e da mãe de santo: tudo o que acontece na casa, num olhar só.", tag: "gestão", icone: "olho" },
  { nome: "Filhos de Santo", desc: "Cadastro completo da corrente: orixás de cabeça, obrigações, datas e histórico de cada filho.", tag: "corrente", icone: "corrente" },
  { nome: "Calendário de Giras", desc: "Giras, festas e obrigações marcadas no tempo da casa — com convite público e RSVP.", tag: "tempo", icone: "lua" },
  { nome: "Financeiro + Pix", desc: "Mensalidades, doações, despesas e a caixinha da casa. O Pix cai direto, sem intermediário.", tag: "sustento", icone: "buzios" },
  { nome: "Mural de Avisos", desc: "Transmissão de aviso para toda a corrente — a palavra do zelador chega a todos.", tag: "palavra", icone: "sino" },
  { nome: "Galeria de Fotos", desc: "Até 100 GB para guardar a memória das festas, das giras e da história da casa.", tag: "memória", icone: "memoria" },
  { nome: "Biblioteca de Estudo", desc: "Pontos cantados, apostilas e fundamentos organizados para o estudo da corrente.", tag: "saber", icone: "livro" },
  { nome: "Loja do Axé", desc: "Velas, ervas, guias e artigos religiosos — a loja da casa com pedidos organizados.", tag: "axé", icone: "vela" },
  { nome: "Almoxarifado", desc: "O estoque ritual da casa: ervas, velas, louças — com alerta no WhatsApp quando faltar.", tag: "zelo", icone: "erva" },
  { nome: "WhatsApp Oficial", desc: "Integração oficial Meta: avisos, cobranças e confirmações direto no WhatsApp do filho.", tag: "conexão", icone: "onda" },
  { nome: "Espaço do Fiel", desc: "Atendimentos e pedidos de reza: o consulente pede, a casa acolhe.", tag: "acolhida", icone: "maos" },
  { nome: "Portal Público", desc: "Sua casa no diretório de terreiros do Brasil, com página própria e eventos abertos.", tag: "porteira", icone: "portao" },
  { nome: "App Instalável", desc: "PWA no celular de cada filho de santo — a casa no bolso, mesmo offline.", tag: "alcance", icone: "firmeza" },
  { nome: "Notificações Push", desc: "A casa chama, o filho recebe: avisos na tela do celular, na hora certa.", tag: "chamado", icone: "estrela" },
];

/* Símbolos SVG desenhados no traço da pemba (stroke fino, nicho) */
const ICONES = {
  olho: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 24 C12 12 36 12 44 24 C36 36 12 36 4 24 Z"/><circle cx="24" cy="24" r="7"/><circle cx="24" cy="24" r="2.4" fill="currentColor"/><path d="M24 5 L24 11 M24 37 L24 43"/></svg>`,
  corrente: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="24" cy="10" r="5"/><circle cx="10" cy="32" r="5"/><circle cx="38" cy="32" r="5"/><path d="M21 14 L13 28 M27 14 L35 28 M15 32 L33 32"/></svg>`,
  lua: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M30 6 A20 20 0 1 0 42 28 A15 15 0 0 1 30 6 Z"/><path d="M34 12 L36 16 L40 16 L37 19 L38 23 L34 20.6 L30 23 L31 19 L28 16 L32 16 Z" stroke-width="1"/></svg>`,
  buzios: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="16" cy="18" rx="7" ry="9"/><path d="M13 13 L19 13 M12.5 17 L19.5 17 M13 21 L19 21"/><ellipse cx="32" cy="30" rx="7" ry="9"/><path d="M29 25 L35 25 M28.5 29 L35.5 29 M29 33 L35 33"/></svg>`,
  sino: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 6 C15 6 13 14 13 22 C13 30 9 33 9 33 L39 33 C39 33 35 30 35 22 C35 14 33 6 24 6 Z"/><path d="M20 38 A4 4 0 0 0 28 38"/><path d="M24 2 L24 6"/></svg>`,
  memoria: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="7" y="12" width="34" height="26" rx="3"/><circle cx="24" cy="25" r="7"/><circle cx="24" cy="25" r="2.5"/><path d="M17 12 L20 7 L28 7 L31 12"/></svg>`,
  livro: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 10 C19 6 10 6 7 8 L7 38 C10 36 19 36 24 40 C29 36 38 36 41 38 L41 8 C38 6 29 6 24 10 Z"/><path d="M24 10 L24 40"/><path d="M12 16 L19 16 M12 22 L19 22 M29 16 L36 16 M29 22 L36 22"/></svg>`,
  vela: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="18" y="20" width="12" height="22" rx="2"/><path d="M24 12 C21 15 21 18 24 20 C27 18 27 15 24 12 Z" fill="currentColor" opacity="0.9"/><path d="M24 8 C22.5 9.8 22.5 11 24 12.4 C25.5 11 25.5 9.8 24 8 Z"/></svg>`,
  erva: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 44 L24 18"/><path d="M24 30 C14 30 9 24 8 15 C17 15 23 20 24 30 Z"/><path d="M24 24 C34 24 39 18 40 9 C31 9 25 14 24 24 Z"/></svg>`,
  onda: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 18 Q10 12 16 18 T28 18 T40 18 T52 18"/><path d="M4 26 Q10 20 16 26 T28 26 T40 26 T52 26"/><path d="M4 34 Q10 28 16 34 T28 34 T40 34 T52 34"/></svg>`,
  maos: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 28 C10 20 14 12 24 10 C34 12 38 20 38 28"/><path d="M10 28 L10 36 C10 40 14 42 18 42 L30 42 C34 42 38 40 38 36 L38 28"/><circle cx="24" cy="24" r="4"/></svg>`,
  portao: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 42 L8 14 C8 14 16 6 24 6 C32 6 40 14 40 14 L40 42"/><path d="M14 42 L14 22 M22 42 L22 18 M26 42 L26 18 M34 42 L34 22"/><path d="M4 42 L44 42"/></svg>`,
  firmeza: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="14" y="6" width="20" height="36" rx="4"/><path d="M24 34 C21.5 31.5 21.5 29 24 27 C26.5 29 26.5 31.5 24 34 Z"/><path d="M20 11 L28 11"/></svg>`,
  estrela: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 4 L28 18 L42 18 L31 27 L35 41 L24 32 L13 41 L17 27 L6 18 L20 18 Z"/></svg>`,
};

/* Congá dos módulos — lista clicável + painel (sem scroll horizontal) */
(function montaConga() {
  const lista = $("#conga-lista");
  const painel = $("#conga-painel");
  if (!lista || !painel) return;

  let atual = 0;
  let autoTimer = null;
  let pausado = false;

  lista.innerHTML = MODULOS.map((m, i) => `
    <li>
      <button type="button" data-i="${i}" ${i === 0 ? 'class="ativo"' : ""}>
        <span class="n">${String(i + 1).padStart(2, "0")}</span>
        <span>${m.nome}</span>
      </button>
    </li>
  `).join("");

  function mostra(i, { auto = false } = {}) {
    atual = (i + MODULOS.length) % MODULOS.length;
    const m = MODULOS[atual];
    $$("#conga-lista button").forEach((b) => b.classList.toggle("ativo", Number(b.dataset.i) === atual));
    $("#conga-num").textContent = String(atual + 1).padStart(2, "0");
    $("#conga-simbolo").innerHTML = ICONES[m.icone] || ICONES.estrela;
    $("#conga-nome").textContent = m.nome;
    $("#conga-desc").textContent = m.desc;
    $("#conga-tag").textContent = m.tag;
    painel.classList.remove("trocando");
    void painel.offsetWidth;
    painel.classList.add("trocando");
    // Mantém o item ativo visível na lista
    const btn = $(`#conga-lista button[data-i="${atual}"]`);
    if (btn && !auto) btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  function reiniciaAuto() {
    clearInterval(autoTimer);
    if (reduzMovimento || pausado) return;
    autoTimer = setInterval(() => mostra(atual + 1, { auto: true }), 4500);
  }

  lista.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-i]");
    if (!btn) return;
    pausado = true;
    mostra(Number(btn.dataset.i));
    reiniciaAuto();
  });
  $("#conga-prev")?.addEventListener("click", () => { pausado = true; mostra(atual - 1); reiniciaAuto(); });
  $("#conga-next")?.addEventListener("click", () => { pausado = true; mostra(atual + 1); reiniciaAuto(); });
  painel.addEventListener("mouseenter", () => { pausado = true; clearInterval(autoTimer); });
  painel.addEventListener("mouseleave", () => { pausado = false; reiniciaAuto(); });

  mostra(0);
  reiniciaAuto();
})();

/* ═══ DADOS REAIS DO SISTEMA ════════════════════════════════ */

async function api(caminho) {
  const r = await fetch(caminho, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${caminho} → ${r.status}`);
  const upstream = r.headers.get("x-axe-upstream");
  const fonte = $("#fonte-dados");
  if (fonte) {
    fonte.textContent =
      upstream === "sistema-local"
        ? "· dados ao vivo do sistema local (localhost:3000) ·"
        : "· dados públicos atualizados agora ·";
  }
  return r.json();
}

function contarAte(el, valor) {
  const obj = { n: 0 };
  gsap.to(obj, {
    n: valor,
    duration: 2.2,
    ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 88%" },
    onUpdate: () => { el.textContent = Math.round(obj.n).toLocaleString("pt-BR"); },
  });
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Terreiros — números vivos + casas em “quem está por trás” */
(async function carregaCasas() {
  const quemLista = $("#quem-casas-lista");
  try {
    const [dir, cidades] = await Promise.all([
      api("/api/v1/public/terreiros?limit=8"),
      api("/api/v1/public/terreiros/cidades").catch(() => null),
    ]);

    contarAte($("#num-terreiros"), dir.total || (dir.items || []).length);
    if (cidades?.cidades) contarAte($("#num-cidades"), cidades.cidades.length);

    const casas = dir.items || [];
    if (!quemLista) return;
    if (!casas.length) {
      quemLista.innerHTML = `<p class="aviso-vazio">Novas casas autorizadas aparecerão aqui conforme os perfis forem publicados.</p>`;
      return;
    }
    quemLista.innerHTML = casas.slice(0, 3).map((c) => {
      const slug = String(c.slug || "").trim();
      const perfil = slug
        ? `/terreiro/${encodeURIComponent(slug)}`
        : String(c.perfilUrl || "").replace(/^\/terreiros\//, "/terreiro/") || "/terreiros";
      return `
      <a class="quem-casa" href="${esc(perfil)}">
        <span class="quem-casa-ico" aria-hidden="true">⌂</span>
        <span>
          <strong>${esc(c.nome)}</strong>
          <small>${esc([c.cidade, c.estado].filter(Boolean).join("/") || "Brasil")} · ${esc(c.tradicao || "casa de axé")}</small>
        </span>
      </a>`;
    }).join("");
  } catch (e) {
    console.warn("[casas]", e);
    if (quemLista) quemLista.innerHTML = `<p class="aviso-vazio">Não foi possível carregar as casas agora.</p>`;
  }
})();

/* Eventos públicos */
(async function carregaEventos() {
  const lista = $("#eventos-lista");
  const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  try {
    const data = await api("/api/v1/public/eventos?limit=6");
    const eventos = data.items || [];
    contarAte($("#num-eventos"), eventos.length);
    if (!eventos.length) {
      lista.innerHTML = `<p class="aviso-vazio">Nenhuma gira pública agendada neste momento — a corrente descansa.</p>`;
      return;
    }
    lista.innerHTML = eventos.map((ev) => {
      const d = new Date(ev.data + "T12:00:00");
      let url = "/eventos";
      if (ev.eventoPageUrl) url = ev.eventoPageUrl;
      else if (ev.senhasPageUrl) url = ev.senhasPageUrl;
      else if (ev.terreiro?.slug) url = `/terreiro/${encodeURIComponent(ev.terreiro.slug)}`;
      return `
        <a class="evento-linha" href="${esc(url)}">
          <span class="evento-data">
            <span class="evento-dia">${d.getDate()}</span>
            <span class="evento-mes">${MESES[d.getMonth()]}</span>
          </span>
          <span>
            <span class="evento-nome">${esc(ev.titulo)}</span>
            <span class="evento-casa">${esc(ev.terreiro?.nome || "")}${ev.terreiro?.cidade ? " · " + esc(ev.terreiro.cidade) : ""}</span>
          </span>
          <span class="evento-tipo">${esc(ev.tipo || "gira")}${ev.hora ? " · " + esc(String(ev.hora).slice(0, 5)) : ""}</span>
        </a>`;
    }).join("");

    gsap.from(".evento-linha", {
      x: -40, opacity: 0, stagger: 0.1, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: lista, start: "top 84%" },
    });
  } catch (e) {
    console.warn("[eventos]", e);
    lista.innerHTML = `<p class="aviso-vazio">O calendário não respondeu agora — tente com o sistema local ligado.</p>`;
  }
})();

/* Depoimentos */
(async function carregaVozes() {
  const trilho = $("#vozes-trilho");
  let vozes = [];
  try {
    const data = await api("/api/v1/landing/testimonials");
    if (data.items?.length) vozes = data.items;
  } catch (e) {
    console.warn("[vozes]", e);
  }

  if (!vozes.length) {
    trilho.classList.add("vazio");
    trilho.innerHTML = '<p class="aviso-vazio">Depoimentos autorizados serão publicados aqui. Nenhuma avaliação é criada para preencher espaço.</p>';
    return;
  }

  const cartas = vozes.map((v) => `
    <figure class="voz-carta">
      <blockquote class="voz-texto">${esc(v.text || v.quote || "")}</blockquote>
      <figcaption>
        <p class="voz-autor">${esc(v.author || v.contactName || "Zelador(a)")}</p>
        <p class="voz-casa">${esc([v.houseName, [v.city, v.state].filter(Boolean).join(" · ")].filter(Boolean).join(" — "))}</p>
      </figcaption>
    </figure>
  `);
  // Duplica para o trilho infinito
  trilho.innerHTML = cartas.join("") + `<div aria-hidden="true" class="vozes-copia">${cartas.join("")}</div>`;

  if (!reduzMovimento) {
    const metade = trilho.scrollWidth / 2;
    gsap.to(trilho, { x: -metade, duration: vozes.length * 14, ease: "none", repeat: -1 });
  }
})();

/* Planos reais */
(async function carregaPlanos() {
  const grade = $("#planos-grade");
  // Vita só é aplicado pelo painel admin — não aparece no site público
  const fallback = [
    { id: "premium", name: "Premium", price: 69.9, cycle: "/mês", desc: "Gestão espiritual e financeira completa para o seu terreiro. Plano renovável.", destaque: true },
  ];

  let planos = fallback;
  try {
    const data = await api("/api/plans");
    // A API retorna { plans: { premium: {...}, vita: {...} } } (objeto por id)
    const lista = Array.isArray(data.plans)
      ? data.plans.map((p) => [p.id || p.name, p])
      : Object.entries(data.plans || {});
    const publicos = lista
      .filter(([id, p]) => !/vita/i.test(String(id || "")) && !/vita/i.test(String(p.name || p.title || "")))
      .map(([id, p]) => ({
        id,
        name: String(p.name || p.title || id || "Premium"),
        price: Number(p.price ?? p.priceMonthly ?? p.amount ?? 0) || null,
        cycle: "/mês",
        desc: String(p.description || p.subtitle || "A gestão completa da casa de axé, com todos os módulos."),
        destaque: true,
      }));
    if (publicos.length) planos = publicos;
  } catch (e) {
    console.warn("[planos]", e);
  }

  const BENEFICIOS = [
    "Filhos de santo ilimitados",
    "Giras, financeiro e Pix direto",
    "WhatsApp oficial (Meta)",
    "Portal público do terreiro",
    "App instalável (PWA)",
  ];

  const p = planos[0] || fallback[0];
  const preco = p.price != null
    ? `<span class="oferta-moeda">R$</span><span class="oferta-valor">${p.price.toFixed(2).replace(".", ",")}</span>`
    : `<span class="oferta-valor">Consultar</span>`;

  grade.innerHTML = `
    <div class="oferta-palco">
      <div class="oferta-copy">
        <span class="oferta-selo">✦ plano ${esc(p.name)}</span>
        <h3>Gestão completa da casa — <em>sem surpresa</em></h3>
        <p>${esc(p.desc)}</p>
        <div class="oferta-pilares">
          <div class="oferta-pilar"><strong>30 dias</strong><span>Teste grátis, sem cartão de crédito</span></div>
          <div class="oferta-pilar"><strong>100 GB</strong><span>Galeria para fotos e vídeos das giras</span></div>
          <div class="oferta-pilar"><strong>WhatsApp</strong><span>API oficial da Meta, na casa</span></div>
          <div class="oferta-pilar"><strong>Privacidade</strong><span>Dados da casa isolados e seguros</span></div>
        </div>
      </div>
      <div class="oferta-preco-lado">
        <div class="oferta-anel">
          <div class="oferta-gb" aria-hidden="true">
            <div><strong>100<small>GB</small></strong><span>galeria</span></div>
          </div>
          <div class="oferta-preco-bloco">
            <p class="oferta-nome">${esc(p.name)}</p>
            <p class="oferta-preco">${preco}<span class="oferta-ciclo">${esc(p.cycle || "/mês")}</span></p>
          </div>
        </div>
        <p class="oferta-gb-legenda"><strong>100 GB</strong> para o zelador guardar a memória da casa — fotos e vídeos das festas e giras.</p>
        <a class="oferta-cta" href="/register">Começar 30 dias grátis</a>
        <p class="oferta-nota">sem cartão · cancele quando quiser</p>
      </div>
    </div>
    <div class="oferta-beneficios">
      ${BENEFICIOS.map((b) => `<span>${esc(b)}</span>`).join("")}
    </div>
  `;

  gsap.from(".oferta-palco", {
    y: 60, opacity: 0, duration: 1.1, ease: "power3.out",
    scrollTrigger: { trigger: grade, start: "top 82%" },
  });
  gsap.from(".oferta-beneficios span", {
    y: 20, opacity: 0, stagger: 0.08, duration: 0.7, ease: "power2.out",
    scrollTrigger: { trigger: grade, start: "top 70%" },
  });
})();

/* FAQ — textos literais do HOME_FAQ (seoHome.ts / axecloud.com.br) */
(function montaFaq() {
  const lista = $("#faq-lista");
  if (!lista) return;

  // HOME_FAQ (seoHome.ts) — mesmas 7 perguntas da landing (LandingFaq slice 0–7)
  const link = (href, label) => {
    const u = new URL(href, location.origin);
    const destino = u.hostname === "axecloud.com.br" ? u.pathname + u.search + u.hash : u.href;
    return `<a href="${esc(destino)}">${esc(label || href.replace("https://", ""))}</a>`;
  };
  const FAQ = [
    {
      q: "O que é gestão de terreiros?",
      a: `Gestão de terreiros é a organização prática da casa de axé: mensalidades, calendário de giras, cadastro de filhos de santo, comunicação com a comunidade e memória da casa — sempre com respeito à direção espiritual. O AxéCloud é um software brasileiro de gestão de terreiros para Umbanda, Candomblé e Jurema. Conheça em ${link("https://axecloud.com.br/")} e compare módulos em ${link("https://axecloud.com.br/por-que-axecloud")}.`,
    },
    {
      q: "Qual plataforma de gestão para terreiros atende Umbanda e Candomblé?",
      a: `O AxéCloud é uma plataforma brasileira de gestão para terreiros com financeiro Pix, calendário de giras, galeria, mural e portal do filho de santo — desenvolvida com respeito às tradições de matriz africana. Conheça o guia em ${link("https://axecloud.com.br/conteudo/gestao-de-terreiros")} e teste grátis por 30 dias em ${link("https://axecloud.com.br/register")}.`,
    },
    {
      q: "O AxéCloud serve para terreiros de Umbanda, Candomblé e Jurema?",
      a: "Sim. O AxéCloud é flexível para casas de axé de Umbanda, Candomblé, Jurema e outras vertentes. Você personaliza termos, cargos e rotinas conforme a tradição do seu terreiro.",
    },
    {
      q: "Como funciona a gestão financeira do terreiro?",
      a: "O módulo financeiro registra mensalidades, doações e despesas com histórico transparente. Os filhos de santo podem pagar via Pix e a diretoria acompanha tudo em tempo real, sem planilhas.",
    },
    {
      q: "Filhos de santo têm acesso próprio ao sistema?",
      a: "Sim. Cada filho de santo acessa um portal com mural de avisos, biblioteca de estudos, calendário de giras e mensalidades — tudo separado do painel do zelador.",
    },
    {
      q: "Posso guardar fotos de giras e eventos do terreiro?",
      a: "Sim. A galeria oferece até 100 GB por terreiro para fotos e vídeos — álbuns por festa, gira ou tema, com acesso controlado pela diretoria.",
    },
    {
      q: "Mais de uma pessoa pode administrar o terreiro?",
      a: "Com certeza. O zelador principal pode criar acessos para ogãs, cambonos ou membros da diretoria cuidarem do financeiro, galeria, mural e calendário.",
    },
  ];

  lista.innerHTML = FAQ.map((item, i) => `
    <article class="faq-item${i === 0 ? " aberto" : ""}">
      <button type="button" class="faq-pergunta" aria-expanded="${i === 0 ? "true" : "false"}">
        <span class="faq-num">${String(i + 1).padStart(2, "0")}</span>
        <span class="faq-texto">${esc(item.q)}</span>
        <span class="faq-icone" aria-hidden="true">+</span>
      </button>
      <div class="faq-resposta" style="${i === 0 ? "max-height:400px" : ""}">
        <div class="faq-resposta-inner">${item.a}</div>
      </div>
    </article>
  `).join("");

  // Ajusta altura do primeiro aberto após render
  const primeiro = $(".faq-item.aberto .faq-resposta");
  if (primeiro) primeiro.style.maxHeight = primeiro.scrollHeight + "px";

  lista.addEventListener("click", (e) => {
    const btn = e.target.closest(".faq-pergunta");
    if (!btn) return;
    const item = btn.closest(".faq-item");
    const corpo = item.querySelector(".faq-resposta");
    const jaAberto = item.classList.contains("aberto");

    $$(".faq-item", lista).forEach((el) => {
      el.classList.remove("aberto");
      el.querySelector(".faq-pergunta").setAttribute("aria-expanded", "false");
      el.querySelector(".faq-resposta").style.maxHeight = "0";
    });

    if (!jaAberto) {
      item.classList.add("aberto");
      btn.setAttribute("aria-expanded", "true");
      corpo.style.maxHeight = corpo.scrollHeight + "px";
    }
  });

  gsap.from(".faq-item", {
    y: 28, opacity: 0, stagger: 0.07, duration: 0.75, ease: "power3.out",
    scrollTrigger: { trigger: "#faq", start: "top 78%" },
  });
})();

/* Chamado final: Axé. cresce do fundo */
gsap.from(".chamado-titulo", {
  scale: 0.6, opacity: 0, duration: 1.4, ease: "power3.out",
  scrollTrigger: { trigger: "#chamado", start: "top 62%" },
});

/* Links âncora suaves */
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const alvo = $(a.getAttribute("href"));
    if (!alvo) return;
    e.preventDefault();
    lenis.scrollTo(alvo, { offset: -10 });
  });
});
