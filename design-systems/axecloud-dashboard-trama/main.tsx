import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import {
  AlertCircle, ArrowRight, Bell, BookOpen, CalendarDays, Check, ChevronDown,
  CircleDollarSign, Compass, Home, MapPin, Menu, MessageCircleMore, Plus,
  Search, Settings2, ShieldCheck, Sparkles, UsersRound, WalletCards
} from "lucide-react";
import "./styles.css";

const nav = [
  ["Início", Home], ["Corrente", UsersRound], ["Giras", CalendarDays],
  ["Financeiro", WalletCards], ["Comunicação", MessageCircleMore],
  ["Casa", Settings2], ["Radar", Compass]
] as const;

function Sidebar() {
  return <aside className="sidebar">
    <div className="brand"><b>♆</b><span>AXÉCLOUD</span></div>
    <nav>{nav.map(([label, Icon], index) =>
      <button className={index === 0 ? "nav active" : "nav"} key={label}>
        <Icon size={20}/><span>{label}</span>
      </button>)}
    </nav>
    <div className="motto">TRADIÇÃO<br/>ORGANIZAÇÃO<br/>CONTINUIDADE</div>
  </aside>;
}

function Topbar() {
  return <header className="topbar">
    <button className="house">
      <span className="avatar">TA</span>
      <span><strong>Teste Anual</strong><small>Casa ativa</small></span>
      <ChevronDown size={15}/>
    </button>
    <label className="search"><Search size={17}/><input placeholder="Buscar ou criar..."/><kbd>⌘ K</kbd></label>
    <div className="top-actions">
      <button className="icon-btn"><Bell size={20}/><i>1</i></button>
      <button className="profile"><span>L</span><strong>Lucas</strong><ChevronDown size={15}/></button>
    </div>
  </header>;
}

function Attention() {
  return <section className="card attention">
    <div className="head">
      <div><p className="eyebrow">PRIORIDADE DE HOJE</p><h2>2 ações pedem você</h2></div>
      <button className="link">Ver todas <ArrowRight size={15}/></button>
    </div>
    <button className="action urgent">
      <span className="action-icon"><AlertCircle size={20}/></span>
      <span><strong>Completar dados da casa</strong><small>Finalize as informações principais.</small></span>
      <ArrowRight size={18}/>
    </button>
    <button className="action">
      <span className="action-icon"><MapPin size={20}/></span>
      <span><strong>Ativar perfil no mapa</strong><small>Sua casa ainda não aparece no Radar.</small></span>
      <ArrowRight size={18}/>
    </button>
    <div className="setup">
      <span>Configuração da casa</span><strong>17%</strong><div><i/></div>
    </div>
  </section>;
}

function Gira() {
  return <section className="card gira">
    <div>
      <p className="eyebrow gold">PRÓXIMA GIRA</p>
      <h2>Gira de Caboclo</h2>
      <div className="gira-meta">
        <span><CalendarDays size={15}/>28 SET · 20:00</span>
        <span><MapPin size={15}/>Terreiro principal</span>
      </div>
      <p className="gira-note">Força da mata, caminho aberto.<br/>Que os Caboclos nos guiem.</p>
      <div className="attendance">
        <div className="faces"><span>AS</span><span>JM</span><span>MG</span><span>+29</span></div>
        <strong><i/>32 confirmados</strong>
      </div>
    </div>
    <button className="primary">Abrir organização <ArrowRight size={18}/></button>
  </section>;
}

const pulse = [
  [UsersRound, "48", "membros na corrente", "+12%"],
  [CircleDollarSign, "R$ 8.420", "em caixa", "+8%"],
  [MessageCircleMore, "Funcionando", "WhatsApp da casa", "Online"],
  [ShieldCheck, "Ativo", "perfil público", "No mapa"]
] as const;

function Pulse() {
  return <section className="card pulse">
    <div className="pulse-title"><span><Sparkles size={21}/></span><div><strong>Pulso da casa</strong><small>Em tempo real</small></div></div>
    <div className="pulse-grid">{pulse.map(([Icon, value, label, state]) =>
      <div className="pulse-item" key={label}>
        <Icon size={20}/><div><strong>{value}</strong><small>{label}</small></div><em>{state}</em>
      </div>)}
    </div>
  </section>;
}

function Preceito() {
  return <section className="card preceito">
    <div className="head">
      <div><p className="eyebrow gold">CICLO ATIVO</p><h2>Preceito</h2></div>
      <span className="pill"><i/>Em andamento</span>
    </div>
    <div className="preceito-body">
      <div className="ring"><span>4<small>/7</small></span></div>
      <div><h3>Ogum · 7 dias</h3><p>4 de 7 dias concluídos</p><blockquote>“Disciplina também é um ato de fé.”</blockquote></div>
    </div>
    <button className="secondary">Acompanhar preceito <ArrowRight size={17}/></button>
  </section>;
}

const activity = [
  [UsersRound, "Novo membro", "Mariana de Oxum entrou na casa", "há 2h"],
  [MessageCircleMore, "Comunicado enviado", "Aviso da Gira de Caboclo", "há 5h"],
  [CircleDollarSign, "Pagamento confirmado", "João registrou uma mensalidade", "há 7h"]
] as const;

function Timeline() {
  return <section className="card timeline">
    <div className="head">
      <div><p className="eyebrow">MOVIMENTO DA CASA</p><h2>O que aconteceu</h2></div>
      <button className="link">Ver histórico <ArrowRight size={15}/></button>
    </div>
    <div className="timeline-list">{activity.map(([Icon, title, detail, time]) =>
      <div className="activity" key={title}>
        <span><Icon size={19}/></span><div><strong>{title}</strong><small>{detail}</small></div><time>{time}</time>
      </div>)}
    </div>
  </section>;
}

function MobileNav() {
  const items = [["Início", Home], ["Corrente", UsersRound], ["Giras", CalendarDays], ["Financeiro", WalletCards], ["Mais", Menu]] as const;
  return <nav className="mobile-nav">{items.map(([label, Icon], index) =>
    <button className={index === 0 ? "active" : ""} key={label}><Icon size={21}/><span>{label}</span></button>)}
  </nav>;
}

function App() {
  return <div className="shell">
    <Sidebar/>
    <main className="main">
      <Topbar/>
      <div className="content">
        <section className="intro">
          <div><p className="eyebrow">CENTRAL DA CASA · SÁBADO, 27 DE SETEMBRO</p><h1>A casa <em>hoje.</em></h1><p>O essencial para manter a corrente em movimento.</p></div>
          <div className="intro-actions">
            <span className="prototype"><Check size={14}/>Protótipo · dados ilustrativos</span>
            <button className="agenda"><CalendarDays size={17}/>Ver agenda</button>
            <button className="create"><Plus size={18}/>Criar</button>
          </div>
        </section>
        <section className="grid">
          <Attention/><Gira/><Pulse/><Timeline/><Preceito/>
        </section>
        <footer><BookOpen size={16}/>AxéCloud · gestão com propósito e continuidade</footer>
      </div>
    </main>
    <MobileNav/>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App/>);
