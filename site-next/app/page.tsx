"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, BookOpen, CalendarDays, Check, CircleDollarSign, FileText,
  Images, LockKeyhole, MapPin, Menu, MessageCircleMore, PackageCheck, Search,
  ShieldCheck, UsersRound, X,
} from "lucide-react";

const CONTACT_URL = "https://wa.me/5511920033501?text=Ol%C3%A1%2C%20quero%20conhecer%20melhor%20o%20Ax%C3%A9Cloud.";

const rooms = [
  { n: "01", title: "Financeiro", note: "Mensalidades, Pix e prestação de contas", icon: CircleDollarSign, area: "finance" },
  { n: "02", title: "Agenda", note: "Giras, eventos e obrigações", icon: CalendarDays, area: "agenda" },
  { n: "03", title: "Comunidade", note: "Filhos, visitantes e vínculos", icon: UsersRound, area: "people" },
  { n: "04", title: "Comunicação", note: "Avisos pelo WhatsApp oficial", icon: MessageCircleMore, area: "talk" },
  { n: "05", title: "Patrimônio", note: "Estoque, materiais e loja", icon: PackageCheck, area: "stock" },
  { n: "06", title: "Memória", note: "Documentos, imagens e estudos", icon: Images, area: "memory" },
];

const scattered = [
  ["Recibo 028", "R$ 120,00", "paper receipt"], ["Gira de sábado", "20h — confirmar equipe", "paper event"],
  ["3 mensagens", "Quem ficará na cozinha?", "message msg-a"], ["Mensalidade", "Faltam 7 confirmações", "paper bill"],
  ["Lista de compras", "vela · pemba · café", "paper shopping"], ["Documento", "Onde foi guardado?", "paper doc"],
  ["1 áudio · 02:41", "Grupo da diretoria", "message msg-b"], ["Estoque", "Conferir materiais", "paper inventory"],
];

const archive = [
  { image: "/screenshots/current/giras-calendario.webp", tag: "GIRAS E AGENDA", title: "Cada movimento da casa planejado com clareza." },
  { image: "/screenshots/current/galeria.webp", tag: "MEMÓRIA", title: "Fotos e vídeos organizados em álbuns da casa." },
  { image: "/screenshots/current/biblioteca.webp", tag: "CONHECIMENTO", title: "Estudos, cantigas e documentos em seu lugar." },
  { image: "/screenshots/current/almoxarifado.webp", tag: "PATRIMÔNIO", title: "Materiais e insumos acompanhados de verdade." },
];

const ecosystem = [
  { href: "https://axecloud.com.br/recursos", icon: PackageCheck, eyebrow: "CONHEÇA A PLATAFORMA", title: "Todos os recursos", text: "Financeiro, calendário, portal, WhatsApp, PWA e os demais módulos." },
  { href: "https://axecloud.com.br/por-que-axecloud", icon: ShieldCheck, eyebrow: "DECIDA COM CLAREZA", title: "Por que AxéCloud", text: "Compare formas de organizar a casa e entenda a proposta da plataforma." },
  { href: "https://axecloud.com.br/terreiros", icon: MapPin, eyebrow: "SERVIÇO PÚBLICO", title: "Diretório de terreiros", text: "Encontre casas de Umbanda e Candomblé por cidade e região." },
  { href: "https://axecloud.com.br/terreiro/e-u-j-a-espaco-universalista-dr-jose-de-arimateia", icon: MapPin, eyebrow: "CASA EM DESTAQUE", title: "E.U.J.A. Sorocaba", text: "Espaço Universalista Dr. José de Arimateia — terreiro em Vila Augusta, Sorocaba/SP." },
  { href: "https://axecloud.com.br/eventos", icon: CalendarDays, eyebrow: "AGENDA ABERTA", title: "Giras e eventos", text: "Consulte festas, giras e atividades abertas ao público." },
  { href: "https://axecloud.com.br/conteudo", icon: BookOpen, eyebrow: "CONHECIMENTO", title: "Guias e glossário", text: "Conteúdo sobre gestão, tradições afro-brasileiras e rotina da casa." },
  { href: "https://axecloud.com.br/espaco-do-fiel", icon: MessageCircleMore, eyebrow: "ESPAÇO DO FIEL", title: "Pedido de reza", text: "Envie uma intenção diretamente para uma casa participante." },
];

const faqItems = [
  { q: "O que é o AxéCloud?", a: "O AxéCloud é uma plataforma brasileira de gestão para casas de Umbanda, Candomblé, Jurema e outras tradições. Reúne financeiro, agenda, comunidade, comunicação, patrimônio e memória em um só lugar." },
  { q: "O sistema respeita a tradição de cada casa?", a: "Sim. A tecnologia cuida da organização administrativa sem interferir no fundamento ou na direção espiritual. Termos, cargos e rotinas podem acompanhar a realidade de cada terreiro." },
  { q: "Filhos de santo têm acesso próprio?", a: "Sim. Cada membro acessa um espaço separado do painel da administração, com avisos, calendário, mensalidades, biblioteca e outros conteúdos liberados pela casa." },
  { q: "Como funciona o financeiro e o Pix?", a: "A casa acompanha mensalidades, entradas, despesas e prestações de contas. Os pagamentos podem ser feitos por Pix e ficam registrados no histórico, sem depender de planilhas espalhadas." },
  { q: "Meus dados e os dados da comunidade ficam protegidos?", a: "Sim. Cada casa possui ambiente isolado, acesso controlado por perfil, conexão segura e rotinas de backup. A plataforma foi planejada para preservar a privacidade da comunidade e atender à LGPD." },
  { q: "Preciso instalar alguma coisa?", a: "Não. O AxéCloud funciona diretamente no navegador do computador ou celular e também pode ser adicionado à tela inicial como aplicativo PWA." },
  { q: "Posso testar antes de assinar?", a: "Sim. A casa pode testar o plano Premium completo por 30 dias, sem cartão de crédito e sem compromisso." },
];

function Brand() {
  return <a className="cx-brand" href="#inicio" aria-label="AxéCloud — início"><span className="cx-brand-trident" aria-hidden="true" /><strong><span>Axé</span><em>Cloud</em></strong></a>;
}

function Rack() {
  return <div className="cx-rack-wrap" aria-label="Infraestrutura protegida do AxéCloud">
    <div className="cx-rack-shadow" /><div className="cx-rack">
      <div className="cx-rack-top"><span><i /> AXÉCLOUD PRIVATE CLOUD</span><b>ONLINE</b></div>
      {["IDENTIDADE", "DADOS", "BACKUP", "REDE"].map((name, row) => <div className="cx-unit" key={name}>
        <span className="cx-handle" /><div className="cx-unit-name"><small>NODE 0{row + 1}</small><strong>{name}</strong></div>
        <div className="cx-vents">{Array.from({ length: 30 }, (_, i) => <i key={i} />)}</div>
        <div className="cx-meter"><i style={{ width: `${28 + row * 13}%` }} /></div>
        <div className="cx-leds"><i /><i /><i className={row === 2 ? "amber" : ""} /></div><span className="cx-handle right" />
      </div>)}
      <div className="cx-rack-bottom"><span>BACKUP CONTÍNUO</span><span>AMBIENTE ISOLADO</span></div>
    </div>
  </div>;
}

export default function Home() {
  const root = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const rootElement = root.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const usesTouchNavigation = window.matchMedia("(hover: none), (pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    // Native scrolling is more reliable on touch devices, especially after a
    // page is restored from the mobile browser's back/forward cache.
    if (!prefersReducedMotion && !usesTouchNavigation) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      tick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      lenis.on("scroll", ScrollTrigger.update);
    }

    const restoreScrolling = () => {
      document.documentElement.style.removeProperty("overflow");
      document.documentElement.style.removeProperty("height");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("height");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("touch-action");
      lenis?.resize();
      lenis?.start();
      window.requestAnimationFrame(() => ScrollTrigger.refresh(true));
    };

    window.addEventListener("pageshow", restoreScrolling);
    restoreScrolling();

    const handleSamePageAnchor = (event: MouseEvent) => {
      const source = event.target;
      if (!(source instanceof Element)) return;
      const anchor = source.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!anchor || !rootElement?.contains(anchor)) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      if (!target) return;

      event.preventDefault();
      window.history.pushState(null, "", href);
      if (lenis) {
        lenis.scrollTo(target, { offset: -92, duration: 1.05 });
      } else {
        const top = target.getBoundingClientRect().top + window.scrollY - 92;
        window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
      }
    };

    rootElement?.addEventListener("click", handleSamePageAnchor);

    if (prefersReducedMotion) {
      return () => {
        window.removeEventListener("pageshow", restoreScrolling);
        rootElement?.removeEventListener("click", handleSamePageAnchor);
      };
    }

    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { duration: .85, ease: "power3.out" } })
        .from(".cx-conversion-copy > *", { y: 34, opacity: 0, stagger: .07 })
        .from(".cx-hero-housemap", { y: 42, opacity: 0, scale: .96 }, .18)
        .from(".cx-hero-module", { y: 22, opacity: 0, stagger: .05, duration: .5 }, .42)
        .from(".cx-hero-assurance > *", { y: 16, opacity: 0, stagger: .05, duration: .45 }, .56);

      gsap.timeline({ scrollTrigger: { trigger: ".cx-clutter", start: "top top", end: "bottom bottom", scrub: 1 } })
        .from(".cx-clutter-copy > p, .cx-clutter-copy > .before, .cx-clutter-copy > span", { y: 40, opacity: 0, stagger: .08 })
        .to(".cx-scattered", { x: (i) => (i % 2 ? 80 : -80), y: (i) => (i - 3) * 18, rotate: 0, scale: .72, opacity: 0, stagger: .03 }, .25)
        .fromTo(".cx-organized", { clipPath: "inset(50% 50% 50% 50%)", opacity: 0 }, { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }, .38)
        .from(".cx-organized-row", { x: 45, opacity: 0, stagger: .07 }, .48)
        .to(".cx-clutter-copy .before", { autoAlpha: 0, y: -20, duration: .1 }, .46)
        .fromTo(".cx-clutter-copy .after", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .16 }, .58);

      gsap.timeline({ scrollTrigger: { trigger: ".cx-security", start: "top top", end: "bottom bottom", scrub: 1 } })
        .to(".cx-corridor-left", { xPercent: -42 }, 0)
        .to(".cx-corridor-right", { xPercent: 42 }, 0)
        .to(".cx-corridor-ceiling", { yPercent: -70 }, 0)
        .from(".cx-rack", { z: -700, scale: .42, opacity: .15 }, .05)
        .from(".cx-security-copy > *", { y: 45, opacity: 0, stagger: .08 }, .35)
        .from(".cx-security-proof span", { y: 25, opacity: 0, stagger: .05 }, .52);

      const track = document.querySelector<HTMLElement>(".cx-archive-track");
      if (track && window.matchMedia("(min-width: 701px)").matches) gsap.to(track, { x: () => -(track.scrollWidth - window.innerWidth), ease: "none", scrollTrigger: { trigger: ".cx-archive", start: "top top", end: () => `+=${track.scrollWidth}`, pin: true, scrub: 1, invalidateOnRefresh: true } });

      gsap.utils.toArray<HTMLElement>(".cx-reveal").forEach(el => gsap.from(el, { y: 55, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 82%" } }));
    }, root);
    return () => {
      window.removeEventListener("pageshow", restoreScrolling);
      rootElement?.removeEventListener("click", handleSamePageAnchor);
      ctx.revert();
      lenis?.destroy();
      if (tick) gsap.ticker.remove(tick);
    };
  }, []);

  const organizationJsonLd = { "@context": "https://schema.org", "@type": "Organization", "@id": "https://axecloud.com.br/#organization", name: "AxéCloud", url: "https://axecloud.com.br/", logo: "https://axecloud.com.br/icon-512.png" };
  const softwareJsonLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", "@id": "https://axecloud.com.br/#software", name: "AxéCloud", applicationCategory: "BusinessApplication", operatingSystem: "Web, Android, iOS", url: "https://axecloud.com.br/", publisher: { "@id": "https://axecloud.com.br/#organization" }, description: "Sistema de gestão para terreiros de Umbanda, Candomblé e Jurema.", offers: [{ "@type": "Offer", name: "Premium mensal", price: "69.90", priceCurrency: "BRL", url: "https://axecloud.com.br/register" }, { "@type": "Offer", name: "Premium anual", price: "699.00", priceCurrency: "BRL", url: "https://axecloud.com.br/register" }] };
  const faqJsonLd = { "@context": "https://schema.org", "@type": "FAQPage", "@id": "https://axecloud.com.br/#faq", mainEntity: faqItems.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };

  return <main className="cinema-house" ref={root} id="inicio">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    <header className="cx-header"><Brand /><nav aria-label="Navegação principal"><a href="https://axecloud.com.br/terreiros">Terreiros</a><a href="https://axecloud.com.br/eventos">Eventos</a><a href="https://axecloud.com.br/conteudo">Conteúdo</a><a href="https://axecloud.com.br/por-que-axecloud">Por quê?</a><a href="#plano">Planos</a></nav><a className="cx-header-contact" href={CONTACT_URL} target="_blank" rel="noreferrer">Fale conosco</a><a className="cx-header-login" href="/entrar">Entrar</a><a className="cx-header-cta" href="https://axecloud.com.br/register">Testar 30 dias <ArrowRight /></a><button type="button" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} aria-controls="menu-principal" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>{menu && <div className="cx-menu" id="menu-principal" role="navigation" aria-label="Navegação móvel" onClick={() => setMenu(false)}><a href="https://axecloud.com.br/terreiros">Terreiros</a><a href="https://axecloud.com.br/eventos">Eventos</a><a href="https://axecloud.com.br/conteudo">Conteúdo</a><a href="https://axecloud.com.br/por-que-axecloud">Por quê?</a><a href="#plano">Planos</a><div className="cx-menu-actions"><a className="cx-menu-login" href="/entrar">Entrar</a><a className="cx-menu-contact" href={CONTACT_URL} target="_blank" rel="noreferrer">Fale conosco</a><a className="cx-menu-trial" href="https://axecloud.com.br/register">Testar 30 dias <ArrowRight /></a></div></div>}</header>

    <section className="cx-opening cx-conversion-hero" aria-labelledby="hero-title">
      <div className="cx-hero-architecture" aria-hidden="true"><i /><i /><span /></div>
      <div className="cx-conversion-shell">
        <div className="cx-conversion-copy">
          <p className="cx-hero-eyebrow"><i /> GESTÃO COMPLETA PARA CASAS DE AXÉ</p>
          <h1 id="hero-title">Sua casa de axé.<span>Organizada em um só lugar.</span></h1>
          <p className="cx-hero-lead">Financeiro, filhos de santo, giras, estoque, memória e comunicação em um sistema criado para terreiros de Umbanda e Candomblé.</p>
          <div className="cx-hero-actions">
            <a className="cx-hero-primary" href="https://axecloud.com.br/register">Testar grátis por 30 dias <ArrowRight /></a>
            <a className="cx-hero-secondary" href="#problema">Ver como funciona <ArrowRight /></a>
          </div>
          <div className="cx-hero-price"><strong>30 dias grátis</strong><span>sem cartão</span><i /><span>depois</span><b>R$ 69,90/mês</b></div>
          <div className="cx-hero-assurance"><span><ShieldCheck /> Dados privados</span><span><MessageCircleMore /> Suporte humano</span><span><Check /> Todos os módulos</span></div>
        </div>

        <aside className="cx-hero-housemap" aria-label="Áreas da casa organizadas pelo AxéCloud">
          <div className="cx-hero-housemap-title"><span>UMA CASA · UMA GESTÃO</span><small>6 ÁREAS ESSENCIAIS</small></div>
          <div className="cx-hero-housemap-heart"><img src="/axecloud-trident.png" alt="" width="42" height="51" /><span><small>AXÉCLOUD</small><strong>Uma casa. Uma direção.</strong></span></div>
          <div className="cx-hero-modules">
            {rooms.map((room) => <article className="cx-hero-module" key={room.title}><span>{room.n}</span><room.icon /><div><strong>{room.title}</strong><small>{room.note}</small></div></article>)}
          </div>
          <p className="cx-hero-housemap-note"><span>A rotina se conecta</span><span>24 módulos incluídos</span></p>
        </aside>
      </div>
      <a className="cx-hero-scroll" href="#problema"><span>CONHEÇA O SISTEMA</span><i /></a>
    </section>

    <section className="cx-services" id="servicos-publicos">
      <div className="cx-services-copy cx-reveal">
        <p>NOVIDADE NO MAPA AXÉCLOUD</p>
        <h2>Quem procura cuidado.<br /><span>Encontra quem oferece.</span></h2>
        <div className="cx-services-lead">
          <MapPin />
          <p>Casas com perfil reivindicado podem publicar seus serviços e atendimentos. As informações aparecem no perfil público do terreiro, com contato direto pelo WhatsApp.</p>
        </div>
        <ol>
          <li><span>01</span><div><strong>Cadastre no painel</strong><small>Nome, descrição, duração, valor e disponibilidade.</small></div></li>
          <li><span>02</span><div><strong>Publique no perfil</strong><small>Os atendimentos ficam visíveis para quem encontrou a casa no mapa.</small></div></li>
          <li><span>03</span><div><strong>Receba o contato</strong><small>A pessoa fala diretamente com a casa pelo WhatsApp informado.</small></div></li>
        </ol>
        <a href="https://axecloud.com.br/terreiros">Explorar o mapa <ArrowRight /></a>
      </div>

      <div className="cx-services-profile cx-reveal" aria-label="Exemplo de como os atendimentos aparecem no perfil público">
        <div className="cx-services-map"><i /><i /><i /><span><MapPin /></span><small>EXEMPLO DE PERFIL PÚBLICO</small></div>
        <div className="cx-services-profile-head"><div><small>CASA DE AXÉ · PERFIL NO MAPA</small><strong>Atendimentos espirituais</strong></div><span>PUBLICADO</span></div>
        <div className="cx-services-list">
          <article><div><strong>Jogo de Búzios</strong><small>Orientação e consulta individual</small></div><span>60 min</span></article>
          <article><div><strong>Limpeza Espiritual</strong><small>Atendimento com horário marcado</small></div><span>Sob consulta</span></article>
          <article><div><strong>Atendimento de Umbanda</strong><small>Consulte dias e disponibilidade</small></div><span>Disponível</span></article>
        </div>
        <div className="cx-services-contact"><MessageCircleMore /><span><small>CONTATO DIRETO</small><strong>Agendar via WhatsApp</strong></span><ArrowRight /></div>
      </div>
    </section>

    <section className="cx-clutter" id="problema"><div className="cx-clutter-sticky"><div className="cx-clutter-copy"><p>01 — O PROBLEMA</p><h2 className="before">Quando tudo chega<br />por caminhos diferentes.</h2><h2 className="after">A rotina volta<br />a caber no dia.</h2><span>O sistema organiza sem interferir no fundamento da casa.</span></div><div className="cx-clutter-stage">{scattered.map(([a,b,c],i) => <div className={`cx-scattered ${c} scatter-${i}`} key={a}><small>{a}</small><strong>{b}</strong></div>)}<div className="cx-organized"><div className="cx-organized-head"><span><i /> ROTINA DE HOJE</span><small>4 AÇÕES ORGANIZADAS</small></div>{[[CircleDollarSign,"Financeiro conciliado","12 mensalidades"],[CalendarDays,"Agenda confirmada","Gira · 20h"],[MessageCircleMore,"Comunidade avisada","96% entregues"],[PackageCheck,"Materiais conferidos","Estoque atualizado"]].map(([Icon,title,note],i) => { const I = Icon as typeof CircleDollarSign; return <div className="cx-organized-row" key={title as string}><span>0{i+1}</span><I /><div><strong>{title as string}</strong><small>{note as string}</small></div><Check /></div>})}</div></div></div></section>

    <section className="cx-security" id="seguranca"><div className="cx-security-sticky"><div className="cx-corridor" aria-hidden="true"><div className="cx-corridor-left" /><div className="cx-corridor-right" /><div className="cx-corridor-ceiling" /></div><Rack /><div className="cx-security-copy"><p>02 — SEGURANÇA</p><h2>O que é sagrado<br />não pode ficar exposto.</h2><span>Dados financeiros, pessoais e registros da casa permanecem privados, protegidos e sob seu controle.</span><div className="cx-security-proof"><span><LockKeyhole /> Acesso controlado</span><span><ShieldCheck /> Privacidade e LGPD</span><span><FileText /> Backup contínuo</span></div></div></div></section>

    <section className="cx-archive" id="memoria"><div className="cx-archive-track"><div className="cx-archive-intro"><p>03 — O AXÉCLOUD REAL</p><h2>O presente passa.<br />O que foi cuidado<br /><span>permanece.</span></h2><small>TELAS ATUAIS · CAPTURADAS NO SISTEMA REAL</small></div>{archive.map((item,i) => <article className="cx-archive-frame" key={item.title}><div className="cx-frame-number">0{i+1}</div><div className="cx-frame-image"><Image src={item.image} alt={`Tela atual do AxéCloud — ${item.tag}`} width={1440} height={900} sizes="(max-width: 650px) 88vw, (max-width: 900px) 78vw, 68vw" /></div><p>{item.tag}</p><h3>{item.title}</h3></article>)}<div className="cx-archive-end"><BookOpen /><p>Organização para o presente.</p><h2>Memória para<br />quem vem depois.</h2></div></div></section>

    <section className="cx-ecosystem" id="descobrir"><div className="cx-ecosystem-head cx-reveal"><p>ALÉM DO SISTEMA</p><h2>Uma plataforma para a casa.<br /><span>Um serviço para a comunidade.</span></h2><div><Search /><p>O AxéCloud também mantém diretório público, agenda de eventos, conteúdo educativo, glossário e espaço para pedidos de reza.</p></div></div><div className="cx-ecosystem-grid">{ecosystem.map((item,i) => <a className="cx-ecosystem-link cx-reveal" href={item.href} key={item.title}><span>0{i+1}</span><item.icon /><small>{item.eyebrow}</small><h3>{item.title}</h3><p>{item.text}</p><ArrowRight /></a>)}</div></section>

    <section className="cx-finale"><div className="cx-final-plan" aria-hidden="true">{rooms.map(r => <span key={r.title}>{r.title}</span>)}<i /><i /><i /></div><div className="cx-finale-copy cx-reveal"><p>04 — A CASA ORGANIZADA E VIVA</p><h2>O AxéCloud cuida<br />da organização.<br /><span>Sua casa cuida das pessoas.</span></h2></div>
      <article className="cx-offer cx-reveal" id="plano">
        <div className="cx-offer-head"><div><img src="/axecloud-trident.png" alt="" width="54" height="54" /><span><small>PLANO PREMIUM</small><strong>Um plano. A casa inteira.</strong></span></div><p><i /> TODOS OS RECURSOS INCLUÍDOS</p></div>
        <div className="cx-offer-body">
          <div className="cx-offer-price">
            <p>ESCOLHA COMO PREFERE CUIDAR</p>
            <div className="cx-cycle" role="group" aria-label="Periodicidade da assinatura"><button className={billing === "monthly" ? "active" : ""} onClick={() => setBilling("monthly")}><span>Mensal</span><small>Flexibilidade todo mês</small></button><button className={billing === "annual" ? "active" : ""} onClick={() => setBilling("annual")}><span>Anual</span><small>Economize 2 mensalidades</small><b>MAIS VANTAJOSO</b></button></div>
            <div className="cx-offer-number"><sup>R$</sup><strong>{billing === "monthly" ? "69,90" : "699"}</strong><small>{billing === "monthly" ? "por mês" : "por ano"}</small></div>
            <div className="cx-offer-economy">{billing === "monthly" ? <><i /><span><strong>30 dias para conhecer tudo</strong><small>Sem cartão e sem compromisso</small></span></> : <><i /><span><strong>R$ 139,80 de economia</strong><small>Equivale a R$ 58,25 por mês</small></span></>}</div>
            <div className="cx-offer-numbers"><span><strong>24</strong><small>módulos</small></span><span><strong>100 GB</strong><small>de memória</small></span><span><strong>30 dias</strong><small>grátis</small></span></div>
          </div>
          <div className="cx-offer-included">
            <p>Tudo que sua casa recebe:</p><div className="cx-included-grid">{[["Financeiro e Pix","Mensalidades e prestação de contas"],["Corrente da casa","Filhos, documentos e histórico"],["Giras e frequência","Agenda, convites e confirmações"],["Comunicação oficial","Mural, mensagens e WhatsApp"],["Memória e acervo","Galeria, biblioteca e documentos"],["Gestão completa","Estoque, loja e patrimônio"]].map(([title,text]) => <div key={title}><Check /><span><strong>{title}</strong><small>{text}</small></span></div>)}</div>
            <div className="cx-offer-assurance"><ShieldCheck /><span><strong>Dados privados e suporte humano.</strong><small>Ambiente isolado por casa, atualizações incluídas e ajuda quando precisar.</small></span></div>
            <a className="cx-offer-cta" href="https://axecloud.com.br/register"><span><small>COMECE AGORA</small><strong>Testar gratuitamente por 30 dias</strong></span><ArrowRight /></a><p className="cx-offer-note">Sem cartão · Cancele quando quiser · Todos os módulos liberados</p>
          </div>
        </div>
      </article>
    </section>

    <section className="cx-faq" id="faq">
      <div className="cx-faq-intro cx-reveal"><p>06 — PERGUNTAS FREQUENTES</p><h2>Antes de entrar,<br /><span>tudo precisa estar claro.</span></h2><small>Respostas diretas sobre a plataforma, a segurança e o período de teste.</small></div>
      <div className="cx-faq-list cx-reveal">{faqItems.map((item, i) => <details key={item.q}><summary><span>0{i + 1}</span><strong>{item.q}</strong><i /></summary><p>{item.a}</p></details>)}</div>
    </section>

    <footer className="cx-footer"><Brand /><p>Gestão profissional para casas de Umbanda, Candomblé e Jurema.</p><nav><a href="https://axecloud.com.br/recursos">Recursos</a><a href="https://axecloud.com.br/terreiros">Terreiros</a><a href="https://axecloud.com.br/eventos">Eventos</a><a href="https://axecloud.com.br/conteudo">Conteúdo</a><a href="https://axecloud.com.br/privacidade">Privacidade</a><a href="https://axecloud.com.br/termos">Termos</a></nav><a href="#inicio">Voltar ao início ↑</a></footer>
  </main>;
}
