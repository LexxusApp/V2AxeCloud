import React, { useMemo } from 'react';
import useSWR from 'swr';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardBerryProps {
  onNavigate: (tab: string, subview?: string) => void;
  terreiroNome?: string;
  zeladorNome?: string;
  tenantId?: string;
}

export const DashboardBerry: React.FC<DashboardBerryProps> = ({
  onNavigate,
  terreiroNome = 'Sede',
  zeladorNome,
  tenantId,
}) => {
  // 1. Período do dia (Manhã, Tarde, Noite)
  const { greeting, daypart, formattedDate } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let g = 'Boa noite';
    let dp = 'night';
    if (hour >= 5 && hour < 12) {
      g = 'Bom dia';
      dp = 'morning';
    } else if (hour >= 12 && hour < 18) {
      g = 'Boa tarde';
      dp = 'afternoon';
    }
    const capDate = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    const formatted = capDate.charAt(0).toUpperCase() + capDate.slice(1);
    return { greeting: g, daypart: dp, formattedDate: formatted };
  }, []);

  // 2. Buscar dados reais com fallback suave para o protótipo
  const { data: stats } = useSWR(
    tenantId ? `berry-stats-${tenantId}` : null,
    async () => {
      if (!tenantId) return null;
      try {
        const [filhosRes, eventsRes] = await Promise.all([
          supabase.from('filhos_de_santo').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          supabase.from('calendario_axe').select('id, titulo, data, hora').eq('tenant_id', tenantId).gte('data', new Date().toISOString().slice(0, 10)).order('data', { ascending: true }).limit(1),
        ]);
        return {
          filhosCount: filhosRes.count || 0,
          proximaGira: eventsRes.data?.[0] || null,
        };
      } catch {
        return null;
      }
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const displayFilhosCount = stats?.filhosCount && stats.filhosCount > 0 ? stats.filhosCount : 42;
  const displayGiraTitulo = stats?.proximaGira?.titulo || 'Gira de Caboclo';
  const displayGiraDataHora = stats?.proximaGira
    ? `${stats.proximaGira.data.split('-').reverse().slice(0, 2).join('/')} · ${(stats.proximaGira.hora || '20:00').slice(0, 5)}`
    : '26 SET · 20:00';

  return (
    <div className="dashboard-main-content">
      <div className="dashboard-container">
        
        {/* 1. HERO TOP GRID — 50% BOA TARDE / 50% CARD CINEMATOGRÁFICO DE GIRA */}
        <section className="hero-cinematic-grid">
          
          {/* Metade 1: Boas-vindas Zeladoria */}
          <article className="hero-welcome-card" id="hero-welcome-card" data-daypart={daypart}>
            <div className="dashboard-v5-hero__forest" aria-hidden="true" />
            <div className="dashboard-v5-hero__foliage dashboard-v5-hero__foliage--canopy" aria-hidden="true" />
            <div className="hero-sacred-aura" aria-hidden="true" />
            <div className="hero-light-sheen" aria-hidden="true" />
            
            {/* Fagúlhas Flutuantes de Axé (GPU 60fps) */}
            <div className="hero-embers-container" aria-hidden="true">
              <span className="hero-ember h-ember-1" />
              <span className="hero-ember h-ember-2" />
              <span className="hero-ember h-ember-3" />
            </div>
            

            {/* Risco Dourado Iluminado */}
            <svg className="dashboard-v5-hero__energy" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="dashboard-hero-energy" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EBCB56" stopOpacity="0" />
                  <stop offset="25%" stopColor="#F2CE55" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="#FFF0A3" stopOpacity="0.95" />
                  <stop offset="75%" stopColor="#F2CE55" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#E3B936" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="hero-energy-base" d="M-40 166 C 170 74 318 206 536 113 S 887 49 1240 154" />
              <path className="hero-energy-glow-line" d="M-40 166 C 170 74 318 206 536 113 S 887 49 1240 154" stroke="url(#dashboard-hero-energy)" strokeWidth="3" fill="none" opacity="0.9" />
              <path className="hero-energy-stream" d="M-40 166 C 170 74 318 206 536 113 S 887 49 1240 154" />
            </svg>

            <div className="hero-welcome-inner">
              <div className="hero-tag">
                <svg className="hero-tag-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                </svg>
                <span>PAINEL DA ZELADORIA · HOJE</span>
              </div>
              <h1 className="hero-title">{greeting}, {zeladorNome || terreiroNome}.</h1>
              <p className="hero-subtitle">{formattedDate}. A corrente está em harmonia e as rotinas da sua casa estão sob sua condução.</p>
              
              <div className="hero-quick-indicators">
                <span className="hero-quick-item">
                  <span className="hero-quick-dot pulse-green" />
                  <strong>{displayFilhosCount}</strong> médiuns na corrente
                </span>
                <span className="hero-quick-sep">·</span>
                <span className="hero-quick-item">
                  <span className="hero-quick-dot pulse-green" />
                  Porteira firmada
                </span>
                <span className="hero-quick-sep">·</span>
                <span className="hero-quick-item">
                  <span className="hero-quick-dot gold pulse-gold" />
                  Preceito em repouso
                </span>
              </div>
            </div>

            <div className="hero-actions">
              <button className="btn-hero-primary" type="button" onClick={() => onNavigate('children')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Ver corrente</span>
              </button>
              <button className="btn-hero-secondary" type="button" onClick={() => onNavigate('calendar')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                <span>Novo movimento</span>
              </button>
            </div>
          </article>

          {/* Metade 2: Card Cinematográfico da Gira */}
          <article className="cinematic-gira-card" id="cinematicGiraCard">
            <div className="cinematic-gira-art" aria-hidden="true" />
            <div className="cinematic-gira-aura" aria-hidden="true" />
            <div className="cinematic-light-sheen" aria-hidden="true" />
            
            {/* Fagúlhas do Tridente Sagrado (GPU 60fps) */}
            <div className="cinematic-embers" aria-hidden="true">
              <span className="c-ember ember-1" />
              <span className="c-ember ember-2" />
              <span className="c-ember ember-3" />
              <span className="c-ember ember-4" />
              <span className="c-ember ember-5" />
            </div>
            

            <div className="cinematic-gira-content">
              <div>
                <div className="cinematic-gira-badge">
                  <span>PRÓXIMA GIRA</span>
                  <span className="sparkle">✦</span>
                </div>
                <h2 className="cinematic-gira-title">{displayGiraTitulo}</h2>
                <div className="cinematic-gira-meta">
                  <span className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{displayGiraDataHora}</span>
                  </span>
                  <span className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Terreiro Principal</span>
                  </span>
                </div>
                <p className="cinematic-gira-quote">“Força da mata, caminho aberto. Que os Caboclos nos guiem.”</p>
              </div>

              <div className="cinematic-gira-footer">
                <div className="cinematic-community">
                  <div className="cinematic-avatars">
                    <span className="c-avatar av-1" title="Mariana de Oxum">M</span>
                    <span className="c-avatar av-2" title="Carlos de Ogum">C</span>
                    <span className="c-avatar av-3" title="João de Xangô">J</span>
                    <span className="c-avatar av-4" title="Ana de Iemanjá">A</span>
                    <span className="c-avatar av-more" title="+27 irmãos confirmados">+27</span>
                  </div>
                  <span className="cinematic-confirmed">
                    <span className="confirmed-pulse-dot" />
                    <strong>32</strong> confirmados
                  </span>
                </div>

                <div className="cinematic-actions-row">
                  <button className="btn-cinematic-notify" type="button" onClick={() => onNavigate('calendar')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                    <span>Disparar aviso</span>
                  </button>
                  <button className="btn-cinematic-open" type="button" onClick={() => onNavigate('calendar')}>
                    <span>Abrir organização</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </article>

        </section>

        {/* 2. OS 4 CARDS ESTILO BERRY */}
        <section className="metrics-grid">
          
          {/* Card 1: Corrente */}
          <article className="berry-card card-gradient-emerald">
            <div className="card-top">
              <div className="icon-squircle emerald">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span className="card-pill-tag green">Corrente Ativa</span>
            </div>
            <div className="card-main">
              <div className="metric-number">{displayFilhosCount}</div>
              <p className="metric-label">Médiuns na corrente da casa</p>
            </div>
            <div className="card-footer-pills">
              <span><strong>{Math.max(1, displayFilhosCount - 4)}</strong> com app instalado</span>
              <button type="button" onClick={() => onNavigate('children')} className="text-white hover:underline flex items-center gap-1 text-xs">
                Ver filhos ➔
              </button>
            </div>
          </article>

          {/* Card 2: Financeiro */}
          <article className="berry-card card-gradient-gold">
            <div className="card-top">
              <div className="icon-squircle gold">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
              </div>
              <span className="card-pill-tag green">92% Em Dia</span>
            </div>
            <div className="card-main">
              <div className="metric-number">R$ 2.450,00</div>
              <p className="metric-label">Mensalidades arrecadadas este mês</p>
            </div>
            <svg className="card-sparkline" viewBox="0 0 100 32" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 24 Q 28 4, 52 18 T 96 8" />
            </svg>
            <div className="card-footer-pills">
              <span><strong>2</strong> pendentes</span>
              <button type="button" onClick={() => onNavigate('financial')} className="text-white hover:underline flex items-center gap-1 text-xs">
                Ver extrato ➔
              </button>
            </div>
          </article>

          {/* Card 3: Radar */}
          <article className="berry-card">
            <div className="card-top">
              <div className="icon-squircle amber">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m4.93 4.93 4.24 4.24" />
                  <path d="m14.83 9.17 4.24-4.24" />
                  <path d="m14.83 14.83 4.24 4.24" />
                  <path d="m9.17 14.83-4.24 4.24" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>
              <span className="card-pill-tag amber">No Radar Axé</span>
            </div>
            <div className="card-main">
              <div className="metric-number">84 visitas</div>
              <p className="metric-label">Consulentes na região este mês</p>
            </div>
            <div className="card-footer-pills">
              <span>Raio de <strong>15km</strong></span>
              <button type="button" onClick={() => onNavigate('radar')} className="text-amber-600 font-semibold hover:underline flex items-center gap-1 text-xs">
                Ver perfil no mapa ➔
              </button>
            </div>
          </article>

          {/* Card 4: WhatsApp Disparos */}
          <article className="berry-card">
            <div className="card-top">
              <div className="icon-squircle forest">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
                  <path d="M8 12h.01" />
                  <path d="M12 12h.01" />
                  <path d="M16 12h.01" />
                </svg>
              </div>
              <span className="card-pill-tag teal">99,4% Entregues</span>
            </div>
            <div className="card-main">
              <div className="metric-number">1.248 disparos</div>
              <p className="metric-label">Avisos e lembretes enviados este mês</p>
            </div>
            <div className="card-footer-pills">
              <span>Zero falhas · Linha ativa</span>
              <button type="button" onClick={() => onNavigate('mural')} className="text-emerald-700 font-semibold hover:underline flex items-center gap-1 text-xs">
                Avisos e lembretes ➔
              </button>
            </div>
          </article>

        </section>

        {/* 3. WIDGETS INTEGRADOS: PRECEITO & RADAR */}
        <section className="featured-widgets-grid">
          
          {/* Widget Preceito */}
          <article className="feature-widget-card widget-preceito">
            <div className="widget-content-left">
              <div className="widget-badge-row">
                <span className="widget-type">🔥 PRECEITO LITÚRGICO</span>
                <span className="widget-pill">Em repouso</span>
              </div>
              <h3 className="widget-title">A corrente está em repouso</h3>
              <p className="widget-desc">Nenhum ciclo de preceito ativo. A brasa permanece acesa, aguardando o próximo movimento litúrgico da casa.</p>
              <button className="widget-btn" type="button" onClick={() => onNavigate('calendar')}>
                <span>Iniciar ciclo de preceito</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="widget-visual">
              <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#c99318" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </div>
          </article>

          {/* Widget Radar */}
          <article className="feature-widget-card widget-radar">
            <div className="widget-content-left">
              <div className="widget-badge-row">
                <span className="widget-type">📡 RADAR AXÉCLOUD</span>
                <span className="widget-pill" style={{ background: '#e8f5e9', color: '#1c513e' }}>Visível no mapa</span>
              </div>
              <h3 className="widget-title">Presença ativa para consulentes</h3>
              <p className="widget-desc">Sua casa está verificada no Radar. Consulentes da sua região encontram datas de giras abertas e falam direto no WhatsApp.</p>
              <button className="widget-btn" type="button" onClick={() => onNavigate('radar')}>
                <span>Gerenciar perfil no Radar</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="widget-visual">
              <div className="mini-radar-sweep" />
              <div className="mini-beacon-dot" />
            </div>
          </article>

        </section>

        {/* 4. PAINEL INFERIOR EM 2 COLUNAS */}
        <section className="bottom-sections-grid">
          
          {/* Coluna 1: O Que Pede Atenção Hoje */}
          <div className="section-panel">
            <div className="panel-header">
              <h2 className="panel-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <span>O que pede atenção hoje</span>
              </h2>
              <span className="panel-badge">Só o que a casa precisa olhar agora</span>
            </div>

            <div className="action-item">
              <div className="action-item-left">
                <div className="action-bullet">01</div>
                <div className="action-text">
                  <strong>Confirmar presença da gira de sexta</strong>
                  <small>36 de 42 médiuns já confirmaram presença pelo WhatsApp.</small>
                </div>
              </div>
              <button className="btn-action-trigger" type="button" onClick={() => onNavigate('calendar')}>
                Ver lista
              </button>
            </div>

            <div className="action-item">
              <div className="action-item-left">
                <div className="action-bullet">02</div>
                <div className="action-text">
                  <strong>2 comprovantes Pix aguardando conciliação</strong>
                  <small>Mariana e Alexandre enviaram o comprovante da mensalidade.</small>
                </div>
              </div>
              <button className="btn-action-trigger" type="button" onClick={() => onNavigate('financial')}>
                Conciliar
              </button>
            </div>

            <div className="action-item">
              <div className="action-item-left">
                <div className="action-bullet">03</div>
                <div className="action-text">
                  <strong>Aviso litúrgico programado para amanhã</strong>
                  <small>Instruções de banho e vestimenta para a corrente de caboclos.</small>
                </div>
              </div>
              <button className="btn-action-trigger" type="button" onClick={() => onNavigate('mural')}>
                Revisar
              </button>
            </div>

            {/* Acesso rápido aos módulos */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '11px', fontWeight: 850, letterSpacing: '0.12em', color: '#72766b', marginBottom: '12px', textTransform: 'uppercase' }}>
                Acesso Rápido da Casa
              </div>
              <div className="shortcuts-row">
                <button type="button" onClick={() => onNavigate('inventory')} className="shortcut-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  </svg>
                  <span>Almoxarifado</span>
                </button>
                <button type="button" onClick={() => onNavigate('library')} className="shortcut-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                    <path d="M6 6h10" />
                    <path d="M6 10h10" />
                  </svg>
                  <span>Biblioteca</span>
                </button>
                <button type="button" onClick={() => onNavigate('gallery')} className="shortcut-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                  </svg>
                  <span>Galeria</span>
                </button>
                <button type="button" onClick={() => onNavigate('store')} className="shortcut-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <span>Loja</span>
                </button>
              </div>
            </div>

          </div>

          {/* Coluna 2: Checklist de Ativação */}
          <div className="section-panel">
            <div className="panel-header">
              <h2 className="panel-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20" />
                  <path d="m17 5-5-3-5 3" />
                  <path d="m17 19-5 3-5-3" />
                  <path d="M2 12h20" />
                  <path d="m5 7-3 5 3 5" />
                  <path d="m19 7 3 5-3 5" />
                </svg>
                <span>Ativação do terreiro</span>
              </h2>
            </div>

            <div className="onboarding-progress-head">
              <div className="progress-circle">83%</div>
              <div>
                <strong style={{ fontSize: '14px', color: '#153b2a', display: 'block' }}>5 de 6 passos concluídos</strong>
                <small style={{ fontSize: '12px', color: '#6a6e62' }}>Sua casa está pronta para o dia a dia.</small>
              </div>
            </div>

            <div className="checklist-step">
              <div className="step-check done">✓</div>
              <div className="step-info">
                <strong>Dados da casa</strong>
                <small>Nome, zelador e localização preenchidos.</small>
              </div>
            </div>

            <div className="checklist-step">
              <div className="step-check done">✓</div>
              <div className="step-info">
                <strong>Foto da casa</strong>
                <small>Identidade visual do terreiro adicionada.</small>
              </div>
            </div>

            <div className="checklist-step">
              <div className="step-check done">✓</div>
              <div className="step-info">
                <strong>Corrente mediúnica</strong>
                <small>Filhos de santo cadastrados.</small>
              </div>
            </div>

            <div className="checklist-step">
              <div className="step-check done">✓</div>
              <div className="step-info">
                <strong>Chave Pix da casa</strong>
                <small>Conta bancária para mensalidades vinculada.</small>
              </div>
            </div>

            <div className="checklist-step">
              <div className="step-check done">✓</div>
              <div className="step-info">
                <strong>Radar AxéCloud</strong>
                <small>Perfil ativado e visível no mapa.</small>
              </div>
            </div>

            <div className="checklist-step">
              <div className="step-check" style={{ borderColor: '#c99318', color: '#c99318' }}>6</div>
              <div className="step-info">
                <strong>Primeira Gira Litúrgica</strong>
                <small>Cadastre a próxima gira no calendário.</small>
              </div>
            </div>

          </div>

        </section>

      </div>
    </div>
  );
};

export default DashboardBerry;
