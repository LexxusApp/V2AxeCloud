import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import {
  ArrowRight, Bell, BookOpen, Building2, CalendarDays, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleCheck, Clock3, Command, Compass, Home,
  MapPin, Menu, MessageCircle, MoreHorizontal, Plus, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Users, WalletCards,
} from "lucide-react";
import "./styles.css";

const days = [
  { short: "DOM", number: "27", label: "Domingo" },
  { short: "SEG", number: "28", label: "Segunda" },
  { short: "TER", number: "29", label: "Terça" },
  { short: "QUA", number: "30", label: "Quarta" },
  { short: "QUI", number: "01", label: "Quinta" },
  { short: "SEX", number: "02", label: "Sexta" },
  { short: "SÁB", number: "03", label: "Sábado" },
];

const nav = [
  { label: "Início", icon: Home, active: true },
  { label: "Corrente", icon: Users },
  { label: "Giras", icon: CalendarDays },
  { label: "Financeiro", icon: WalletCards },
  { label: "Comunicação", icon: MessageCircle },
  { label: "Casa", icon: Building2 },
  { label: "Radar", icon: Compass },
];

const agenda = [
  { day: 0, time: "09:30", title: "Revisar dados da casa", kind: "system", meta: "Configuração", place: "Painel" },
  { day: 1, time: "20:00", title: "Gira de Caboclo", kind: "gira", meta: "32 confirmados", place: "Terreiro principal" },
  { day: 3, time: "18:30", title: "Preceito de Ogum", kind: "preceito", meta: "Dia 4 de 7", place: "Em andamento" },
  { day: 5, time: "19:00", title: "Reunião da corrente", kind: "meeting", meta: "48 membros", place: "Salão principal" },
];

function Sidebar() {
  return <aside className="rail" aria-label="Navegação principal">
    <a className="brand-mark" href="#" aria-label="AxéCloud">
      <img src="/axecloud-trident.png" alt="" /><span>AXÉ</span>
    </a>
    <nav>{nav.map(({ label, icon: Icon, active }) =>
      <button className={active ? "rail-action active" : "rail-action"} key={label} aria-label={label}>
        <Icon size={20} strokeWidth={1.8} /><span>{label}</span>
      </button>)}
    </nav>
    <button className="rail-action rail-settings" aria-label="Configurações">
      <Settings2 size={20} strokeWidth={1.8} /><span>Ajustes</span>
    </button>
  </aside>;
}

function Header() {
  return <header className="topbar">
    <button className="house-control">
      <span className="house-seal"><Building2 size={18} /></span>
      <span><strong>Teste Anual</strong><small>Casa selecionada</small></span>
      <ChevronDown size={16} />
    </button>
    <label className="command-search">
      <Search size={17} />
      <input aria-label="Buscar no AxéCloud" placeholder="Buscar pessoa, gira ou lançamento" />
      <kbd><Command size={12} /> K</kbd>
    </label>
    <span className="prototype-note">Protótipo com dados ilustrativos</span>
    <button className="header-icon" aria-label="Notificações"><Bell size={19} /><b>1</b></button>
    <button className="user-control"><span>L</span><strong>Lucas</strong><ChevronDown size={15} /></button>
    <button className="mobile-menu" aria-label="Abrir menu"><Menu /></button>
  </header>;
}

function DateStrip({ selectedDay, onSelect }: { selectedDay: number; onSelect: (day: number) => void }) {
  return <div className="date-strip" aria-label="Dias da semana">
    {days.map((day, index) =>
      <button key={day.short} className={selectedDay === index ? "date-cell selected" : "date-cell"}
        onClick={() => onSelect(index)} aria-pressed={selectedDay === index}>
        <small>{day.short}</small><strong>{day.number}</strong>
      </button>)}
  </div>;
}

function TerrainMap() {
  return <svg className="terrain-map" viewBox="0 0 900 520" aria-hidden="true">
    <path d="M-40 82C98 8 172 142 314 86S517 22 663 96s224 26 308-33" />
    <path d="M-61 129C75 53 172 194 328 129s274-59 391 22 214 30 287-19" />
    <path d="M-66 194C91 115 182 253 338 199s275-70 397 18 213 43 291-17" />
    <path d="M-55 270C96 188 204 312 358 270s251-78 383 12 202 55 278 2" />
    <path d="M-37 351C101 277 223 380 371 352s239-81 368 5 192 61 277 22" />
    <path d="M-25 427C112 366 229 446 386 428s222-72 354-1 193 59 286 37" />
    <path d="M22 493c154-42 261 15 392-4s222-50 348 5 167 41 245 29" />
  </svg>;
}

function CalendarCanvas({ selectedDay }: { selectedDay: number }) {
  const selectedEvents = useMemo(() => agenda.filter((event) => event.day === selectedDay), [selectedDay]);
  const laterThisWeek = useMemo(() => agenda.filter((event) => event.day !== selectedDay && event.day !== 1), [selectedDay]);
  return <section className="calendar-canvas" aria-label="Agenda ritual da semana">
    <TerrainMap />
    <div className="time-axis" aria-hidden="true">
      <span>08</span><span>12</span><span>16</span><span>20</span><span>24</span>
    </div>
    <div className="day-columns" aria-hidden="true">
      {days.map((day, index) => <i className={selectedDay === index ? "active" : ""} key={day.short} />)}
    </div>
    <div className="now-line"><span>AGORA 18:42</span></div>
    <div className="desktop-events">
      {agenda.map((event, index) =>
        <button className={"calendar-event " + event.kind}
          style={{ "--day": event.day, "--order": index } as React.CSSProperties} key={event.title}>
          <span className="event-time">{event.time}</span>
          <strong>{event.title}</strong>
          <small>{event.meta}</small>
          <span className="event-place"><MapPin size={12} />{event.place}</span>
        </button>)}
    </div>
    <div className="mobile-agenda">
      {selectedEvents.length ? selectedEvents.map((event) =>
        <button className={"mobile-event " + event.kind} key={event.title}>
          <div><small>{event.time}</small><strong>{event.title}</strong></div>
          <span>{event.meta}</span><ArrowRight size={18} />
        </button>) :
        <div className="free-day">
          <CircleCheck size={20} />
          <div><strong>Sem compromissos</strong><small>Este dia está livre para organizar a casa.</small></div>
        </div>}
      <div className="mobile-time current"><span>18:42</span><b /></div>
      <div className="mobile-time muted"><span>20:00</span><b /></div>
      {selectedDay !== 1 &&
        <button className="mobile-event gira secondary">
          <div><small>SEG, 28 - 20:00</small><strong>Gira de Caboclo</strong></div>
          <span>32 confirmados</span><ArrowRight size={18} />
        </button>}
      {laterThisWeek.length > 0 && <div className="week-followups">
        <h3>Depois nesta semana</h3>
        {laterThisWeek.map((event) =>
          <button className="week-event" key={event.title}>
            <span>{days[event.day].short} {days[event.day].number}</span>
            <strong>{event.title}</strong>
            <small>{event.time}</small>
            <ArrowRight size={16} />
          </button>)}
      </div>}
    </div>
  </section>;
}

function DecisionDesk() {
  const [completed, setCompleted] = useState<string[]>([]);
  const toggle = (key: string) => setCompleted((items) =>
    items.includes(key) ? items.filter((item) => item !== key) : [...items, key]);
  const tasks = [
    { key: "profile", title: "Completar dados da casa", detail: "Faltam endereço e tradição", icon: SlidersHorizontal },
    { key: "map", title: "Ativar perfil no Radar", detail: "Sua casa ainda não aparece", icon: MapPin },
  ];
  return <aside className="decision-desk">
    <div className="decision-heading">
      <div><h2>O que pede sua atenção</h2>
        <p>{completed.length ? "A casa está avançando." : "Duas ações antes da próxima gira."}</p>
      </div>
      <button aria-label="Mais opções"><MoreHorizontal /></button>
    </div>
    <div className="task-stack">
      {tasks.map(({ key, title, detail, icon: Icon }) => {
        const done = completed.includes(key);
        return <button className={done ? "task done" : "task"} key={key} onClick={() => toggle(key)}>
          <span><Icon size={18} /></span>
          <div><strong>{done ? "Concluído" : title}</strong><small>{done ? "Atualizado neste protótipo" : detail}</small></div>
          {done ? <Check size={18} /> : <ArrowRight size={18} />}
        </button>;
      })}
    </div>
    <div className="next-focus">
      <div className="focus-time"><Clock3 size={18} /><span><strong>20:00</strong><small>amanhã</small></span></div>
      <div><h3>Gira de Caboclo</h3><p>32 pessoas confirmadas. Organização aberta.</p></div>
      <button>Abrir gira <ArrowRight size={16} /></button>
    </div>
  </aside>;
}

function SituationLedger() {
  const items = [
    { icon: Users, value: "48", label: "na corrente", note: "+7 neste mês" },
    { icon: WalletCards, value: "R$ 8.420", label: "em caixa", note: "Setembro" },
    { icon: MessageCircle, value: "98%", label: "WhatsApp entregue", note: "Canal em dia" },
    { icon: ShieldCheck, value: "Ativo", label: "perfil público", note: "No Radar" },
  ];
  return <section className="situation-ledger" aria-label="Situação da casa">
    <header><span><BookOpen size={20} /></span><div><h2>Livro de situação</h2><p>Leitura rápida da casa agora.</p></div></header>
    <div className="ledger-values">
      {items.map(({ icon: Icon, value, label, note }) =>
        <div className="ledger-item" key={label}>
          <Icon size={18} /><div><strong>{value}</strong><small>{label}</small></div><em>{note}</em>
        </div>)}
    </div>
  </section>;
}

function AtlasDashboard() {
  const [selectedDay, setSelectedDay] = useState(0);
  return <div className="app">
    <Sidebar />
    <main>
      <Header />
      <section className="atlas">
        <header className="atlas-title">
          <div><span className="mobile-prototype">Dados ilustrativos</span><h1>A casa, em perspectiva.</h1><p>Agenda, decisões e situação reunidas no mesmo tempo.</p></div>
          <div className="period-control">
            <button aria-label="Semana anterior"><ChevronLeft /></button>
            <span><strong>27 set - 03 out</strong><small>Semana atual</small></span>
            <button aria-label="Próxima semana"><ChevronRight /></button>
          </div>
        </header>
        <DateStrip selectedDay={selectedDay} onSelect={setSelectedDay} />
        <div className="atlas-workspace">
          <CalendarCanvas selectedDay={selectedDay} />
          <DecisionDesk />
        </div>
        <SituationLedger />
      </section>
      <button className="create-button"><Plus size={20} /><span>Criar</span></button>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {nav.slice(0, 4).map(({ label, icon: Icon, active }) =>
          <button className={active ? "active" : ""} key={label}><Icon size={21} /><span>{label}</span></button>)}
        <button className="create-tab"><Plus size={21} /><span>Criar</span></button>
      </nav>
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<AtlasDashboard />);
