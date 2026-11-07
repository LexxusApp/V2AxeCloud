import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import {
  AlertCircle, ArrowRight, Bell, BookOpen, Building2, CalendarDays,
  CalendarPlus, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign,
  Compass, Home, MapPin, Menu, MessageCircleMore, PackageCheck, Plus,
  Search, Settings2, ShieldCheck, Sparkles, UsersRound, WalletCards
} from "lucide-react";
import "./styles.css";

const nav = [
  ["Início", Home],
  ["Corrente", UsersRound],
  ["Giras", CalendarDays],
  ["Financeiro", WalletCards],
  ["Comunicação", MessageCircleMore],
  ["Casa", Building2],
  ["Radar", Compass],
] as const;

function Sidebar() {
  return <aside className="sidebar">
    <a className="brand" href="#" aria-label="AxéCloud">
      <img src="/axecloud-trident.png" alt="" />
      <strong>AXÉCLOUD</strong>
    </a>
    <nav aria-label="Navegação principal">
      {nav.map(([label, Icon], index) =>
        <button className={index === 0 ? "nav-item active" : "nav-item"} key={label}>
          <Icon size={20} strokeWidth={1.8}/>
          <span>{label}</span>
        </button>
      )}
    </nav>
    <div className="sidebar-signature">
      <i/>
      <span>Tradição<br/>Organização<br/>Continuidade</span>
    </div>
  </aside>;
}

function Topbar() {
  return <header className="topbar">
    <button className="house-switcher">
      <span className="house-avatar"><Building2 size={17}/></span>
      <span><strong>Teste Anual</strong><small>Teste ativo, vence 31 out.</small></span>
      <ChevronDown size={15}/>
    </button>
    <label className="global-search">
      <Search size={17}/>
      <input aria-label="Buscar ou criar" placeholder="Buscar ou criar..." />
      <kbd>⌘ K</kbd>
    </label>
    <div className="topbar-actions">
      <span className="preview-label">Protótipo com dados ilustrativos</span>
      <button className="icon-button" aria-label="Notificações">
        <Bell size={20}/><i>1</i>
      </button>
      <button className="profile-button">
        <span>L</span><strong>Lucas</strong><ChevronDown size={15}/>
      </button>
      <button className="menu-button" aria-label="Abrir menu"><Menu size={22}/></button>
    </div>
  </header>;
}

const flowNodes = [
  { icon: Settings2, title: "Configuração da casa", detail: "17% concluído", action: "Continuar", state: "warning" },
  { icon: CalendarDays, title: "Gira de Caboclo", detail: "28 set, 20:00", action: "Abrir agenda", state: "gold" },
  { icon: MessageCircleMore, title: "WhatsApp funcionando", detail: "98% entregues", action: "Ver envios", state: "online" },
] as const;

function CommandFlow() {
  return <div className="flow">
    <svg className="energy-map" viewBox="0 0 760 116" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="flowGradient" x1="0" x2="1">
          <stop offset="0" stopColor="#e5b83d" stopOpacity=".22"/>
          <stop offset=".48" stopColor="#ffd85d"/>
          <stop offset="1" stopColor="#38d69a"/>
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-80%" width="140%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path className="path-shadow" d="M64 64 C155 22 202 102 286 59 S420 23 505 60 S630 98 706 49"/>
      <path className="path-main" d="M64 64 C155 22 202 102 286 59 S420 23 505 60 S630 98 706 49"/>
    </svg>
    <div className="node-grid">
      {flowNodes.map(({ icon: Icon, title, detail, action, state }, index) =>
        <button className={"flow-node " + state} style={{ "--delay": index } as React.CSSProperties} key={title}>
          <span className="orbit"><i/><b><Icon size={23} strokeWidth={1.8}/></b></span>
          <span className="node-copy"><strong>{title}</strong><small>{detail}</small></span>
          <span className="node-action">{action}<ChevronRight size={14}/></span>
        </button>
      )}
    </div>
  </div>;
}

function AttentionPanel() {
  return <aside className="attention-panel">
    <div className="attention-head">
      <div><Sparkles size={17}/><h2>Pede sua atenção</h2></div>
      <button>Ver todas <ArrowRight size={14}/></button>
    </div>
    <button className="attention-item urgent">
      <span><AlertCircle size={20}/></span>
      <div><strong>Completar dados da casa</strong><small>Finalize as informações principais.</small></div>
      <ChevronRight size={18}/>
    </button>
    <button className="attention-item">
      <span><MapPin size={20}/></span>
      <div><strong>Ativar perfil no mapa</strong><small>Sua casa ainda não aparece no Radar.</small></div>
      <ChevronRight size={18}/>
    </button>
  </aside>;
}

function CommandDeck() {
  return <section className="command-deck">
    <span className="mobile-preview-label">Dados ilustrativos</span>
    <div className="deck-heading">
      <span>Central da casa</span>
      <h1>Boa noite, <strong>Teste.</strong></h1>
      <p>Sua casa em um só ritmo.</p>
    </div>
    <div className="deck-layout">
      <CommandFlow/>
      <AttentionPanel/>
    </div>
    <button className="create-fab"><span><Plus size={24}/></span><strong>Criar</strong></button>
  </section>;
}

const pulseData = [
  { icon: UsersRound, value: "48", label: "na corrente", change: "+12%" },
  { icon: CircleDollarSign, value: "R$ 8.420", label: "em caixa", change: "+8%" },
  { icon: MessageCircleMore, value: "98%", label: "WhatsApp entregues", change: "+2%" },
  { icon: ShieldCheck, value: "Ativo", label: "perfil público", change: "No mapa" },
] as const;

function PulseBar() {
  return <section className="pulse-bar">
    <div className="pulse-name"><span><Sparkles size={20}/></span><div><strong>Pulso da casa</strong><small>Atualizado agora</small></div></div>
    <div className="pulse-metrics">
      {pulseData.map(({ icon: Icon, value, label, change }) =>
        <div className="metric" key={label}>
          <Icon size={20} strokeWidth={1.8}/>
          <div><strong>{value}</strong><small>{label}</small></div>
          <em>{change}</em>
        </div>
      )}
    </div>
  </section>;
}

function EventSpotlight() {
  return <section className="event-spotlight">
    <div className="event-copy">
      <span className="section-label">Próxima gira</span>
      <h2>Gira de Caboclo</h2>
      <div className="event-meta">
        <span><CalendarDays size={16}/>28 set, 20:00</span>
        <span><MapPin size={16}/>Terreiro principal</span>
      </div>
      <p>Força da mata, caminho aberto.<br/>Que os Caboclos nos guiem.</p>
      <div className="confirmed"><UsersRound size={18}/><strong>32 confirmados</strong><span>+7 hoje</span></div>
    </div>
    <button className="primary-action"><CalendarPlus size={18}/>Abrir organização<ArrowRight size={18}/></button>
  </section>;
}

function PreceitoPanel() {
  return <section className="preceito-panel">
    <div className="preceito-head"><h2>Preceito</h2><span><i/>Em andamento</span></div>
    <div className="preceito-content">
      <div><strong>Ogum, 7 dias</strong><small>Quarto dia concluído</small></div>
      <div className="day-track" aria-label="4 de 7 dias concluídos">
        {[1,2,3,4,5,6,7].map(day => <span className={day <= 4 ? "done" : ""} key={day}><b>{day}</b></span>)}
      </div>
      <blockquote>“Disciplina também é um ato de fé.”</blockquote>
    </div>
    <button className="secondary-action">Acompanhar preceito<ArrowRight size={17}/></button>
  </section>;
}

const recent = [
  { icon: UsersRound, title: "Novo membro", detail: "Mariana de Oxum entrou na casa", time: "há 2 horas" },
  { icon: MessageCircleMore, title: "Comunicado enviado", detail: "Aviso da Gira de Caboclo", time: "há 5 horas" },
  { icon: PackageCheck, title: "Pagamento confirmado", detail: "João registrou uma mensalidade", time: "há 7 horas" },
] as const;

function ActivityRail() {
  return <section className="activity-rail">
    <div className="activity-title"><BookOpen size={19}/><div><h2>O que aconteceu na casa</h2><p>Movimentos recentes da sua comunidade.</p></div></div>
    <div className="activity-grid">
      {recent.map(({ icon: Icon, title, detail, time }) =>
        <div className="activity-item" key={title}>
          <span><Icon size={20}/></span>
          <div><strong>{title}</strong><small>{detail}</small></div>
          <time>{time}</time>
        </div>
      )}
    </div>
    <button className="activity-link">Ver histórico<ArrowRight size={15}/></button>
  </section>;
}

function MobileNav() {
  const items = [["Início", Home], ["Corrente", UsersRound], ["Giras", CalendarDays], ["Financeiro", WalletCards], ["Mais", Menu]] as const;
  return <nav className="mobile-nav" aria-label="Navegação móvel">
    {items.map(([label, Icon], index) =>
      <button className={index === 0 ? "active" : ""} key={label}><Icon size={21}/><span>{label}</span></button>
    )}
  </nav>;
}

function App() {
  return <div className="app-shell">
    <Sidebar/>
    <main>
      <Topbar/>
      <CommandDeck/>
      <div className="workspace">
        <PulseBar/>
        <div className="feature-grid"><EventSpotlight/><PreceitoPanel/></div>
        <ActivityRail/>
      </div>
    </main>
    <MobileNav/>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App/>);
