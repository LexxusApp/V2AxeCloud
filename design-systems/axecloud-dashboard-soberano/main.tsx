import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import {
  Home,
  Users,
  CalendarDays,
  Newspaper,
  HandHeart,
  Images,
  Package,
  PieChart,
  BookOpen,
  ShoppingBag,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Plus,
  ArrowRight,
  Calendar,
  MessageCircle,
  Clock,
  MapPin,
  Check,
  TrendingUp,
  AlertCircle,
  UserCheck,
  Sparkles,
  Flame,
  Download,
  ExternalLink,
  Menu,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import './styles.css';

function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (o: boolean) => void }) {
  const [casaOpen, setCasaOpen] = useState(true);
  const [finOpen, setFinOpen] = useState(false);

  return (
    <>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Header with real Terreiro info */}
        <div className="sidebar-header">
          <div className="sidebar-tenant">
            <div className="tenant-avatar-wrapper">
              <img
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&q=80"
                alt="Kwe Nago"
                className="tenant-avatar-img"
              />
            </div>
            <div className="tenant-details">
              <div className="tenant-title">Kwe Nago Vodun Omin Odolá</div>
              <div className="tenant-plan-badge">Acesso Vitalício</div>
            </div>
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setMobileOpen(false)}
              title="Recolher menu"
            >
              {mobileOpen ? <X size={15} /> : <ChevronRight size={15} />}
            </button>
          </div>
        </div>

        <div className="sidebar-group-label">Gestão da Casa</div>

        {/* Real Menu Navigation Items */}
        <nav className="sidebar-nav">
          <button type="button" className="nav-link active">
            <Home size={17} className="nav-icon" />
            <span>Início</span>
          </button>

          {/* Accordion Casa */}
          <div>
            <button
              type="button"
              className="nav-accordion-header"
              onClick={() => setCasaOpen(!casaOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building size={17} />
                <span>Casa</span>
              </div>
              <ChevronDown
                size={14}
                style={{
                  transform: casaOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {casaOpen && (
              <div className="nav-accordion-content">
                <button type="button" className="nav-sublink">
                  <Users size={14} />
                  <span>Filhos de Santo</span>
                </button>
                <button type="button" className="nav-sublink">
                  <Flame size={14} />
                  <span>Obrigações</span>
                </button>
                <button type="button" className="nav-sublink">
                  <CalendarDays size={14} />
                  <span>Giras</span>
                </button>
                <button type="button" className="nav-sublink">
                  <Clock size={14} />
                  <span>Frequência</span>
                </button>
                <button type="button" className="nav-sublink">
                  <Newspaper size={14} />
                  <span>Comunicados</span>
                </button>
                <button type="button" className="nav-sublink">
                  <MessageCircle size={14} />
                  <span>Mensagens</span>
                </button>
              </div>
            )}
          </div>

          {/* Accordion Financeiro */}
          <div>
            <button
              type="button"
              className="nav-accordion-header"
              onClick={() => setFinOpen(!finOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PieChart size={17} />
                <span>Financeiro</span>
              </div>
              <ChevronDown
                size={14}
                style={{
                  transform: finOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {finOpen && (
              <div className="nav-accordion-content">
                <button type="button" className="nav-sublink">
                  <PieChart size={14} />
                  <span>Visão geral</span>
                </button>
                <button type="button" className="nav-sublink">
                  <CreditCard size={14} />
                  <span>Mensalidades</span>
                </button>
                <button type="button" className="nav-sublink">
                  <Settings size={14} />
                  <span>Configurações Pix</span>
                </button>
              </div>
            )}
          </div>

          <button type="button" className="nav-link">
            <Images size={17} className="nav-icon" />
            <span>Galeria</span>
          </button>

          <button type="button" className="nav-link">
            <Package size={17} className="nav-icon" />
            <span>Almoxarifado</span>
          </button>

          <button type="button" className="nav-link">
            <BookOpen size={17} className="nav-icon" />
            <span>Biblioteca</span>
          </button>

          <button type="button" className="nav-link">
            <ShoppingBag size={17} className="nav-icon" />
            <span>Loja</span>
          </button>

          <button type="button" className="nav-link">
            <Sparkles size={17} className="nav-icon" />
            <span>Radar</span>
          </button>

          <button type="button" className="nav-link">
            <CreditCard size={17} className="nav-icon" />
            <span>Minha assinatura</span>
          </button>

          <button type="button" className="nav-link">
            <Settings size={17} className="nav-icon" />
            <span>Configurações</span>
          </button>

          <button type="button" className="nav-link">
            <LifeBuoy size={17} className="nav-icon" />
            <span>Suporte</span>
          </button>
        </nav>

        {/* Real Sidebar Footer */}
        <div className="sidebar-footer">
          <button type="button" className="btn-install-app">
            <Download size={15} strokeWidth={2.6} />
            <span>Instalar aplicativo</span>
          </button>

          <button type="button" className="btn-logout">
            <LogOut size={14} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ setMobileOpen }: { setMobileOpen: (o: boolean) => void }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setMobileOpen(true)}
          style={{ display: 'none' }}
          id="mobile-toggle"
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>

        <button type="button" className="house-selector-btn">
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: '#FBBC00',
              color: '#080A0D',
              fontWeight: 800,
              fontSize: 11,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            K
          </div>
          <strong>Kwe Nago Vodun Omin Odolá</strong>
          <span className="status-indicator">
            <span className="status-dot" />
            Casa ativa
          </span>
          <ChevronDown size={14} style={{ color: '#8C8477' }} />
        </button>
      </div>

      <div className="topbar-center">
        <div className="search-bar">
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar médium, gira, comunicado, caixa ou ⌘ K..."
            readOnly
          />
          <span className="search-kbd">⌘ K</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="system-upgrade-pill">
          <Sparkles size={13} />
          <span>AxéCloud v2.4</span>
        </div>

        <button type="button" className="icon-btn" aria-label="Notificações">
          <Bell size={17} />
          <span className="icon-badge">1</span>
        </button>

        <button type="button" className="user-profile-btn">
          <div className="user-avatar">M</div>
          <span className="user-name">Miriam Barbosa</span>
          <ChevronDown size={14} style={{ color: '#8C8477' }} />
        </button>
      </div>
    </header>
  );
}

export default function DashboardSoberano() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="main-wrapper">
        <Topbar setMobileOpen={setMobileOpen} />

        <main className="dashboard-content">
          {/* HERO BANNER: Deep Macaia Green */}
          <section className="hero-banner">
            <div>
              <div className="hero-context-tag">
                <Sparkles size={13} />
                <span>Sua Casa Hoje · Domingo, 27 de Setembro</span>
              </div>
              <h1 className="hero-title">Boa tarde, Miriam.</h1>
              <p className="hero-subtitle">
                Domingo, 27 de setembro de 2026. A corrente está em harmonia e 4 rotinas aguardam sua condução hoje.
              </p>
            </div>

            <div className="hero-actions">
              <button type="button" className="btn-hero-gold">
                <Users size={16} strokeWidth={2.4} />
                <span>Ver corrente</span>
              </button>
              <button type="button" className="btn-hero-secondary">
                <Plus size={16} />
                <span>Novo movimento</span>
              </button>
            </div>
          </section>

          {/* 4 KPIS: Crisp Elevated White Cards */}
          <section className="kpi-grid" aria-label="Indicadores Vitais">
            {/* KPI 1: Corrente */}
            <article className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-pill sky">
                  <Users size={19} />
                </div>
                <span className="kpi-trend positive">
                  <TrendingUp size={11} /> +2 este mês
                </span>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">8</span>
                <span className="kpi-label">Pessoas ativas na corrente</span>
              </div>
              <div className="kpi-footer">
                <span>Presença média 94%</span>
                <span style={{ fontWeight: 700, color: '#0369A1' }}>6 em ordem</span>
              </div>
            </article>

            {/* KPI 2: Mensalidades */}
            <article className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-pill amber">
                  <CreditCard size={19} />
                </div>
                <span className="kpi-trend positive">
                  <Check size={11} /> Pix Ativo
                </span>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">9</span>
                <span className="kpi-label">Mensalidades para confirmação</span>
              </div>
              <div className="kpi-footer">
                <span>R$ 1.800,00 previstos</span>
                <span style={{ fontWeight: 700, color: '#B45309' }}>Caixinha OK</span>
              </div>
            </article>

            {/* KPI 3: Próxima Gira */}
            <article className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-pill amber">
                  <CalendarDays size={19} />
                </div>
                <span className="kpi-trend neutral">Amanhã 20h</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-value" style={{ fontSize: 20, paddingTop: 4 }}>Gira Solene</span>
                <span className="kpi-label">Caboclo e Boiadeiro</span>
              </div>
              <div className="kpi-footer">
                <span>Terreiro Principal</span>
                <span style={{ fontWeight: 700, color: '#047857' }}>32 confirmados</span>
              </div>
            </article>

            {/* KPI 4: WhatsApp */}
            <article className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-pill emerald">
                  <MessageCircle size={19} />
                </div>
                <span className="kpi-trend positive">100% online</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">OK</span>
                <span className="kpi-label">Últimos envios sem falha</span>
              </div>
              <div className="kpi-footer">
                <span>Linha oficial Meta</span>
                <span style={{ fontWeight: 700, color: '#047857' }}>98% leitura</span>
              </div>
            </article>
          </section>

          {/* LITURGICAL STATUS: Preceito da Casa */}
          <section className="liturgical-card" aria-label="Ciclo de Preceito">
            <div className="liturgical-left">
              <div className="liturgical-flame-icon">
                <Flame size={24} />
              </div>
              <div>
                <div className="liturgical-tag">Estado Litúrgico da Casa</div>
                <div className="liturgical-title">
                  <span>Preceito de Ogum Ativo</span>
                  <div className="stepper-pills">
                    <span className="step-circle done">1</span>
                    <span className="step-circle done">2</span>
                    <span className="step-circle done">3</span>
                    <span className="step-circle active">4</span>
                    <span className="step-circle pending">5</span>
                    <span className="step-circle pending">6</span>
                    <span className="step-circle pending">7</span>
                  </div>
                </div>
                <p className="liturgical-quote">
                  "Disciplina também é um ato de fé e reverência ao sagrado." — Dia 4 de 7 · 100% da corrente orientada.
                </p>
              </div>
            </div>

            <button type="button" className="btn-liturgical-action">
              <Sparkles size={15} />
              <span>Acompanhar Resguardo</span>
              <ArrowRight size={14} />
            </button>
          </section>

          {/* 2 COLUMNS: Gira em Destaque & O Que Pede Atenção */}
          <section className="two-col-grid" aria-label="Rotinas e Gira">
            {/* Column 1: Próxima Gira Solene */}
            <div className="gira-card-white">
              <div className="gira-top-banner">
                <div className="gira-tag-row">
                  <span className="gira-badge-amber">Próxima Gira · Amanhã às 20:00</span>
                  <span style={{ fontSize: 11, color: '#D1D5DB' }}>Sessão Solene nº 38</span>
                </div>
                <h2 className="gira-h2">Gira Solene de Caboclo e Boiadeiro</h2>
                <p className="gira-p">
                  Trabalho sagrado de cura, passe e firmeza de caminho. Força da mata para acolher
                  a assistência e harmonizar a corrente mediúnica.
                </p>
              </div>

              <div className="gira-bottom-info">
                <div className="gira-meta-row">
                  <div className="gira-meta-item">
                    <MapPin size={15} style={{ color: '#D97706' }} />
                    <span>Terreiro Principal & Salão das Matas</span>
                  </div>
                  <div className="gira-meta-item">
                    <UserCheck size={15} style={{ color: '#059669' }} />
                    <span>32 médiuns confirmados</span>
                  </div>
                </div>

                <div className="gira-actions-row">
                  <button type="button" className="btn-gira-gold">
                    <CalendarDays size={16} strokeWidth={2.4} />
                    <span>Gerenciar Chamada & Portaria</span>
                  </button>

                  <button type="button" className="btn-gira-wa">
                    <MessageCircle size={16} style={{ color: '#16A34A' }} />
                    <span>Enviar Lembrete WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2: O Que Pede Atenção (Routines) */}
            <div className="attention-card">
              <div className="attention-header">
                <div className="attention-header-title">
                  <AlertCircle size={18} style={{ color: '#D97706' }} />
                  <span>O que pede atenção hoje</span>
                </div>
                <a href="#casa" className="attention-header-link">
                  <span>Ver todas</span>
                  <ChevronRight size={14} />
                </a>
              </div>

              <div className="attention-list">
                <div className="attention-row">
                  <div className="attention-left-item">
                    <span className="attention-number">01</span>
                    <div className="attention-info">
                      <div className="attention-main-text">2 pessoas ainda não entraram no app</div>
                      <div className="attention-sub-text">Enviar acesso · login com Registro + 6 dígitos CPF</div>
                    </div>
                  </div>
                  <button type="button" className="attention-pill-btn gold">
                    Ativar &gt;
                  </button>
                </div>

                <div className="attention-row">
                  <div className="attention-left-item">
                    <span className="attention-number">02</span>
                    <div className="attention-info">
                      <div className="attention-main-text">8 cadastros com dados pendentes</div>
                      <div className="attention-sub-text">Faltam telefone ou data de nascimento</div>
                    </div>
                  </div>
                  <button type="button" className="attention-pill-btn">
                    Completar &gt;
                  </button>
                </div>

                <div className="attention-row">
                  <div className="attention-left-item">
                    <span className="attention-number">03</span>
                    <div className="attention-info">
                      <div className="attention-main-text">Há mensalidades para confirmar</div>
                      <div className="attention-sub-text">9 pessoas · Total de R$ 1.800,00</div>
                    </div>
                  </div>
                  <button type="button" className="attention-pill-btn">
                    Cobrar &gt;
                  </button>
                </div>

                <div className="attention-row">
                  <div className="attention-left-item">
                    <span className="attention-number">04</span>
                    <div className="attention-info">
                      <div className="attention-main-text">Completar fotos e perfil no Radar</div>
                      <div className="attention-sub-text">Faltam 2 fotos para ativação no mapa</div>
                    </div>
                  </div>
                  <button type="button" className="attention-pill-btn">
                    Configurar &gt;
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Floating Action Button (WhatsApp Axé) */}
      <button
        type="button"
        className="fab-whatsapp"
        title="WhatsApp do AxéCloud"
        aria-label="Atendimento WhatsApp"
      >
        <MessageCircle size={26} strokeWidth={2.2} />
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<DashboardSoberano />);
