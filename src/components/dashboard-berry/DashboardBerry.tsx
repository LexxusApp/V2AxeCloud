import React, { useCallback, useMemo, useRef, useState } from 'react';
import PreceitoCommandCenter, { type PreceitoCommandCenterHandle } from '../preceito/PreceitoCommandCenter';
import { useDashboardResources } from '../../hooks/useDashboardResources';
import type { DashboardResources } from '../../lib/dashboardResources';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  countsTowardSaldo,
  isLancamentoNoMesRef,
  normalizeMovimentoTipo,
} from '../../lib/financeiroSaldo';

interface DashboardBerryProps {
  onNavigate: (tab: string, subview?: string) => void;
  terreiroNome?: string;
  zeladorNome?: string;
  tenantId?: string;
  userId?: string;
  userRole?: string;
}

const emptyBerryData: Omit<DashboardResources, 'whatsappConnected'> & { whatsappConnected: boolean | null } = {
  children: [],
  transactions: [],
  events: [],
  notices: [],
  pixConfig: null,
  profile: null,
  radar: null,
  whatsappLogs: [],
  whatsappConnected: null,
  confirmations: {},
};

export const DashboardBerry: React.FC<DashboardBerryProps> = ({
  onNavigate,
  terreiroNome = 'Sede',
  zeladorNome,
  tenantId,
  userId,
  userRole = 'admin',
}) => {
  const preceitoRef = useRef<PreceitoCommandCenterHandle>(null);
  const preceitoScope = `${tenantId || ''}:${userId || ''}:${userRole}`;
  const [preceitoState, setPreceitoState] = useState<{ scope: string; cycle: any } | null>(null);
  const activePreceito = preceitoState?.scope === preceitoScope ? preceitoState.cycle : null;
  const handleActivePreceitoChange = useCallback((cycle: any) => {
    setPreceitoState((previous) => previous?.scope === preceitoScope && previous.cycle === cycle
      ? previous : { scope: preceitoScope, cycle });
  }, [preceitoScope]);
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

  // Each card publishes its own result; optional services cannot hold the page.
  const resources = useDashboardResources(tenantId && userId ? { tenantId, userId, userRole } : undefined);
  const data = {
    children: resources.children.data ?? emptyBerryData.children,
    transactions: resources.transactions.data ?? emptyBerryData.transactions,
    events: resources.events.data ?? emptyBerryData.events,
    notices: resources.notices.data ?? emptyBerryData.notices,
    pixConfig: resources.pixConfig.data ?? null,
    profile: resources.profile.data ?? null,
    radar: resources.radar.data ?? null,
    whatsappLogs: resources.whatsappLogs.data ?? emptyBerryData.whatsappLogs,
    whatsappConnected: resources.whatsappConnected.data ?? null,
    confirmations: resources.confirmations.data ?? emptyBerryData.confirmations,
  };
  const childrenReady = resources.children.data !== undefined;
  const financialReady = resources.transactions.data !== undefined;
  const eventsReady = resources.events.data !== undefined;
  const confirmationsReady = resources.confirmations.data !== undefined;
  const whatsappReady = resources.whatsappLogs.data !== undefined;
  const radarReady = resources.radar.data !== undefined;
  const setupResources = [resources.children, resources.events, resources.pixConfig, resources.profile, resources.radar];
  const setupReady = setupResources.every((resource) => resource.data !== undefined);
  const setupFailed = setupResources.some((resource) => resource.error && resource.data === undefined);
  const attentionResources = [resources.children, resources.transactions, resources.events, resources.confirmations, resources.whatsappLogs];
  const attentionLoading = attentionResources.some((resource) => resource.data === undefined && !resource.error);
  const attentionFailed = attentionResources.some((resource) => resource.data === undefined && resource.error);
  const timelineResources = [resources.transactions, resources.events, resources.notices, resources.confirmations];
  const timelineLoading = timelineResources.some((resource) => resource.data === undefined && !resource.error);
  const timelineFailed = timelineResources.some((resource) => resource.data === undefined && resource.error);
  const whatsappStatusLabel = data.whatsappConnected === true ? 'WhatsApp conectado'
    : data.whatsappConnected === false ? 'WhatsApp desconectado'
    : resources.whatsappConnected.error ? 'Status do WhatsApp indisponível' : 'Consultando WhatsApp…';
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = useMemo(
    () => [...data.events]
      .filter((event) => String(event?.data || '') >= todayIso)
      .sort((a, b) => `${a.data || ''}T${a.hora || '00:00'}`.localeCompare(`${b.data || ''}T${b.hora || '00:00'}`)),
    [data.events, todayIso],
  );
  const nextEvent = upcomingEvents[0] || null;
  const confirmedPeople = nextEvent?.id ? data.confirmations[nextEvent.id] || [] : [];
  const displayFilhosCount = childrenReady ? data.children.length : null;
  const withAppAccess = data.children.filter((child) => String(child?.user_id || '').trim()).length;
  const nextEventTitle = nextEvent?.titulo || (eventsReady ? 'Nenhuma gira agendada' : resources.events.error ? 'Agenda indisponível' : 'Carregando próxima gira…');
  const nextEventDateTime = nextEvent?.data
    ? `${format(new Date(`${nextEvent.data}T12:00:00`), 'dd MMM', { locale: ptBR }).toUpperCase()}${nextEvent.hora ? ` · ${String(nextEvent.hora).slice(0, 5)}` : ''}`
    : 'Agenda disponível';
  const nextEventLocation = String(nextEvent?.local || 'Local não informado');
  const countedTransactions = data.transactions.filter(countsTowardSaldo);
  const currentMonthRevenue = countedTransactions
    .filter((transaction) => isLancamentoNoMesRef(transaction, new Date()) && normalizeMovimentoTipo(transaction.tipo) === 'entrada')
    .reduce((total, transaction) => total + (Number(transaction.valor) || 0), 0);
  const pendingMensalidades = data.transactions.filter((transaction) => {
    const category = String(transaction?.categoria || '').trim().toLowerCase();
    const status = String(transaction?.status || '').trim().toLowerCase();
    return category === 'mensalidade' && (status === 'pendente' || status === 'atrasado');
  });
  const monthKey = format(new Date(), 'yyyy-MM');
  const whatsappMonthLogs = data.whatsappLogs.filter((log) => String(log?.created_at || log?.data || '').slice(0, 7) === monthKey);
  const whatsappFailures = whatsappMonthLogs.filter((log) => ['failed', 'falha', 'partial', 'parcial'].includes(String(log?.status || '').toLowerCase())).length;
  const whatsappDeliveryRate = whatsappMonthLogs.length > 0
    ? Math.round(((whatsappMonthLogs.length - whatsappFailures) / whatsappMonthLogs.length) * 1000) / 10
    : null;
  const radarMetrics = data.radar?.metrics || {};
  const radarViews = Number(radarMetrics.views7 || radarMetrics.views30 || radarMetrics.viewsTotal || 0);
  const radarWhatsappClicks = Number(radarMetrics.whatsappClicks30 || 0);
  const radarMapClicks = Number(radarMetrics.directoryClicks30 || 0);
  const radarGoogleViews = Number(radarMetrics.googleViews30 || 0);
  const radarClaimed = data.radar?.claimed === true;
  const radarPublished = String(data.radar?.profile?.publicacaoStatus || '').toLowerCase() === 'publicado';
  const radarTitle = !radarReady ? (resources.radar.error ? 'Radar indisponível' : 'Carregando presença da casa…') : radarPublished ? 'Sua casa está no mapa' : radarClaimed ? 'Perfil em preparação' : 'Ative sua presença no Radar';
  const radarStatus = !radarReady ? (resources.radar.error ? 'Indisponível' : 'Carregando') : radarPublished ? 'Ativo no mapa' : radarClaimed ? 'Em preparação' : 'Configuração pendente';
  const radarDescription = !radarReady ? (resources.radar.error ? 'Não foi possível consultar o Radar agora. Os outros dados continuam disponíveis.' : 'Consultando as visitas e os contatos da sua casa.') : radarPublished
    ? 'Consulentes próximos já conseguem encontrar o perfil público da casa e iniciar contato.'
    : radarClaimed
      ? 'Complete a publicação para começar a acompanhar visitas e contatos.'
      : 'Configure o perfil público para sua casa aparecer no mapa do AxéCloud.';
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const setupSteps = useMemo(() => {
    const profile = data.profile;
    return [
      { label: 'Dados da casa', detail: 'Nome e localização pública preenchidos.', done: Boolean(profile?.nome_terreiro && profile?.cidade_publica && profile?.estado_publico), tab: 'settings' },
      { label: 'Foto da casa', detail: 'Identidade visual do terreiro adicionada.', done: Boolean(profile?.foto_url), tab: 'settings' },
      { label: 'Corrente mediúnica', detail: 'Filhos de santo cadastrados.', done: data.children.length > 0, tab: 'children' },
      { label: 'Mensalidades e Pix', detail: 'Chave e valor configurados para cobrança.', done: Boolean(data.pixConfig?.chave_pix && Number(data.pixConfig?.valor_mensalidade) > 0), tab: 'financial-configs' },
      { label: 'Primeira gira agendada', detail: 'Calendário oficial ativo para a comunidade.', done: data.events.length > 0, tab: 'calendar' },
      { label: 'Ativar perfil no Radar', detail: 'Receba consulentes e visitas na sua casa.', done: radarPublished, tab: 'radar' },
    ];
  }, [data.children.length, data.events.length, data.pixConfig, data.profile, radarPublished]);
  const setupDoneCount = setupSteps.filter((step) => step.done).length;
  const setupProgress = Math.round((setupDoneCount / setupSteps.length) * 100);
  const setupSources = [resources.profile, resources.profile, resources.children, resources.pixConfig, resources.events, resources.radar];

  const attentionItems = useMemo(() => {
    const items: Array<{ title: string; detail: string; action: string; tab: string }> = [];
    const unanswered = nextEvent ? Math.max(0, data.children.length - confirmedPeople.length) : 0;
    if (childrenReady && confirmationsReady && nextEvent && unanswered > 0) items.push({ title: `Confirmar presença em ${nextEvent.titulo || 'próxima gira'}`, detail: `${confirmedPeople.length} de ${data.children.length} pessoas já confirmaram presença.`, action: 'Ver lista', tab: 'calendar' });
    if (pendingMensalidades.length > 0) items.push({ title: `${pendingMensalidades.length} mensalidade${pendingMensalidades.length === 1 ? '' : 's'} aguardando confirmação`, detail: `${currency.format(pendingMensalidades.reduce((total, item) => total + (Number(item.valor) || 0), 0))} pendente de conciliação.`, action: 'Conciliar', tab: 'financial-mensalidades' });
    if (whatsappFailures > 0) items.push({ title: `${whatsappFailures} envio${whatsappFailures === 1 ? '' : 's'} de WhatsApp com falha`, detail: 'Revise os envios recentes e tente novamente.', action: 'Revisar', tab: 'mural' });
    const incompleteProfiles = data.children.filter((child) => !String(child?.telefone || child?.celular || '').trim() || !String(child?.data_nascimento || '').trim()).length;
    if (incompleteProfiles > 0) items.push({ title: `${incompleteProfiles} cadastro${incompleteProfiles === 1 ? '' : 's'} incompleto${incompleteProfiles === 1 ? '' : 's'}`, detail: 'Faltam telefone ou data de nascimento.', action: 'Completar', tab: 'children' });
    return items.slice(0, 3);
  }, [childrenReady, confirmationsReady, confirmedPeople.length, currency, data.children, nextEvent, pendingMensalidades, whatsappFailures]);

  const timelineItems = useMemo(() => {
    const items: Array<{ key: string; node: string; type: string; title: string; detail: string; tone: string }> = [];
    if (nextEvent?.id) items.push({ key: `event-${nextEvent.id}`, node: nextEvent.data ? format(new Date(`${nextEvent.data}T12:00:00`), 'dd MMM', { locale: ptBR }) : 'Próximo', type: 'Próxima gira', title: nextEvent.titulo || 'Próxima gira da casa', detail: [nextEvent.hora?.slice(0, 5), nextEvent.local, confirmationsReady ? `${confirmedPeople.length} confirmados` : 'Consultando confirmações'].filter(Boolean).join(' · '), tone: 'gira' });
    const latestTransaction = [...countedTransactions].sort((a, b) => new Date(String(b.data || 0)).getTime() - new Date(String(a.data || 0)).getTime())[0];
    if (latestTransaction?.id) items.push({ key: `finance-${latestTransaction.id}`, node: 'Recente', type: 'Financeiro', title: String(latestTransaction.descricao || latestTransaction.categoria || 'Movimentação financeira'), detail: currency.format(Number(latestTransaction.valor) || 0), tone: 'attention' });
    const latestNotice = [...data.notices].sort((a, b) => new Date(String(b.data_publicacao || b.created_at || 0)).getTime() - new Date(String(a.data_publicacao || a.created_at || 0)).getTime())[0];
    if (latestNotice?.id) items.push({ key: `notice-${latestNotice.id}`, node: 'Recente', type: 'Comunicado', title: String(latestNotice.titulo || 'Comunicado da casa'), detail: String(latestNotice.categoria || 'Publicado para a corrente.'), tone: 'comunicado' });
    if (activePreceito) items.push({ key: `preceito-${activePreceito.id || 'active'}`, node: 'Agora', type: 'Preceito', title: String(activePreceito.titulo || 'Ciclo de preceito ativo'), detail: 'Acompanhe a preparação e as confirmações da corrente.', tone: 'preceito' });
    return items.slice(0, 4);
  }, [activePreceito, confirmationsReady, confirmedPeople.length, countedTransactions, currency, data.notices, nextEvent]);

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
              <p className="hero-subtitle">{formattedDate}. Veja os dados atualizados e os próximos movimentos da sua casa.</p>
              
              <div className="hero-quick-indicators">
                <span className="hero-quick-item">
                  <span className="hero-quick-dot pulse-green" />
                  <strong>{displayFilhosCount ?? '—'}</strong> médiuns na corrente
                </span>
                <span className="hero-quick-sep">·</span>
                <span className="hero-quick-item">
                  <span className="hero-quick-dot pulse-green" />
                  {whatsappStatusLabel}
                </span>
                <span className="hero-quick-sep">·</span>
                <span className="hero-quick-item">
                  <span className="hero-quick-dot gold pulse-gold" />
                  {activePreceito ? 'Preceito ativo' : 'Preceito em repouso'}
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
                <h2 className="cinematic-gira-title">{nextEventTitle}</h2>
                <div className="cinematic-gira-meta">
                  <span className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{nextEventDateTime}</span>
                  </span>
                  <span className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{nextEventLocation}</span>
                  </span>
                </div>
                <p className="cinematic-gira-quote">{nextEvent?.descricao || (nextEvent ? 'Organize confirmações, avisos e os preparativos da corrente.' : 'Cadastre o próximo movimento para organizar a corrente.')}</p>
              </div>

              <div className="cinematic-gira-footer">
                <div className="cinematic-community">
                  <div className="cinematic-avatars">
                    {confirmedPeople.slice(0, 4).map((person, index) => (
                      <span key={person.filho_id} className={`c-avatar av-${index + 1}`} title={person.nome}>
                        {String(person.nome || '?').charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {confirmedPeople.length > 4 && <span className="c-avatar av-more" title={`${confirmedPeople.length - 4} confirmações adicionais`}>+{confirmedPeople.length - 4}</span>}
                  </div>
                  <span className="cinematic-confirmed">
                    <span className="confirmed-pulse-dot" />
                    <strong>{confirmationsReady ? confirmedPeople.length : '—'}</strong> {confirmationsReady ? 'confirmados' : resources.confirmations.error ? 'indisponíveis' : 'carregando'}
                  </span>
                </div>

                <div className="cinematic-actions-row">
                  <button className="btn-cinematic-notify" type="button" onClick={() => onNavigate('calendar')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                    <span>{nextEvent ? 'Disparar aviso' : 'Criar gira'}</span>
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
              <span className="card-pill-tag green">{childrenReady ? 'Corrente ativa' : resources.children.error ? 'Indisponível' : 'Carregando'}</span>
            </div>
            <div className="card-main">
              <div className="metric-number">{displayFilhosCount ?? '—'}</div>
              <p className="metric-label">Médiuns na corrente da casa</p>
            </div>
            <div className="card-footer-pills">
              <span><strong>{childrenReady ? withAppAccess : '—'}</strong> com app instalado</span>
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
              <span className="card-pill-tag green">{financialReady ? (pendingMensalidades.length > 0 ? `${pendingMensalidades.length} pendente${pendingMensalidades.length === 1 ? '' : 's'}` : 'Mês conciliado') : resources.transactions.error ? 'Indisponível' : 'Carregando'}</span>
            </div>
            <div className="card-main">
              <div className="metric-number">{financialReady ? currency.format(currentMonthRevenue) : '—'}</div>
              <p className="metric-label">Mensalidades arrecadadas este mês</p>
            </div>
            <svg className="card-sparkline" viewBox="0 0 100 32" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 24 Q 28 4, 52 18 T 96 8" />
            </svg>
            <div className="card-footer-pills">
              <span><strong>{financialReady ? pendingMensalidades.length : '—'}</strong> pendentes</span>
              <button type="button" onClick={() => onNavigate('financial')} className="text-white hover:underline flex items-center gap-1 text-xs">
                Ver extrato ➔
              </button>
            </div>
          </article>

          {/* Card 3: Ativação do preceito */}
          <article className="berry-card preceito-activation-card">
            <div className="card-top">
              <div className="icon-squircle amber">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
              </div>
              <span className="card-pill-tag amber">{activePreceito ? 'Ativo' : 'Em repouso'}</span>
            </div>
            <div className="card-main">
              <div className="metric-number">{activePreceito ? 'Ativo' : 'Pronto'}</div>
              <p className="metric-label"><strong>Ativar preceito</strong><span>{activePreceito ? activePreceito.titulo : 'Inicie o próximo ciclo da casa'}</span></p>
            </div>
            <div className="card-footer-pills">
              <span>{activePreceito ? 'Ciclo em andamento' : 'Último ciclo encerrado'}</span>
              <button type="button" onClick={() => activePreceito ? preceitoRef.current?.openDetail(activePreceito) : preceitoRef.current?.openWizard()} className="text-amber-600 font-semibold hover:underline flex items-center gap-1 text-xs">
                {activePreceito ? 'Acompanhar ➔' : 'Ativar agora ➔'}
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
              <span className="card-pill-tag teal">{data.whatsappConnected === true ? 'Conectado' : data.whatsappConnected === false ? 'Desconectado' : resources.whatsappConnected.error ? 'Status indisponível' : 'Consultando'}</span>
            </div>
            <div className="card-main">
              <div className="metric-number">{whatsappReady ? `${whatsappMonthLogs.length.toLocaleString('pt-BR')} envio${whatsappMonthLogs.length === 1 ? '' : 's'}` : '—'}</div>
              <p className="metric-label"><strong>WhatsApp da casa</strong><span>Avisos e lembretes enviados este mês</span></p>
            </div>
            <div className="card-footer-pills">
              <span>{whatsappReady ? `${whatsappFailures} falha${whatsappFailures === 1 ? '' : 's'}${whatsappDeliveryRate != null ? ` · ${whatsappDeliveryRate.toLocaleString('pt-BR')}% entregues` : ''}` : resources.whatsappLogs.error ? 'Envios indisponíveis' : 'Carregando envios'}</span>
              <button type="button" onClick={() => onNavigate('mural')} className="text-emerald-700 font-semibold hover:underline flex items-center gap-1 text-xs">
                Avisos e lembretes ➔
              </button>
            </div>
          </article>

        </section>

        {/* 3. WIDGETS INTEGRADOS: PRECEITO & RADAR */}
        <section className="featured-widgets-grid">
          
          {/* Widget Preceito Integrado com Modal da Central de Preparação */}
          <article className="feature-widget-card widget-preceito">
            <div className="widget-content-left">
              <div className="widget-badge-row">
                <span className="widget-type">🔥 PRECEITO LITÚRGICO</span>
                <span className="widget-pill">{activePreceito ? 'Ativo' : 'Em repouso'}</span>
              </div>
              <h3 className="widget-title">
                {activePreceito ? activePreceito.titulo : 'A corrente está em repouso'}
              </h3>
              <p className="widget-desc">
                {activePreceito
                  ? 'Acompanhe a preparação e as confirmações de preceito da corrente.'
                  : 'Nenhum ciclo de preceito ativo. A brasa permanece acesa, aguardando o próximo movimento litúrgico da casa.'}
              </p>
              <button
                className="widget-btn cursor-pointer"
                type="button"
                onClick={() => {
                  if (activePreceito) {
                    preceitoRef.current?.openDetail(activePreceito);
                  } else {
                    preceitoRef.current?.openWizard();
                  }
                }}
              >
                <span>{activePreceito ? 'Acompanhar preceito' : 'Iniciar ciclo de preceito'}</span>
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
            <div className="widget-radar-map" aria-label="Resumo das interações no Radar">
              <span className="radar-map-road radar-map-road-a" />
              <span className="radar-map-road radar-map-road-b" />
              <span className="radar-map-zone radar-map-zone-a" />
              <span className="radar-map-zone radar-map-zone-b" />
              <span className="radar-map-home">⌂</span>
              <span className="radar-map-pin radar-map-pin-a">{radarReady ? radarMapClicks : '—'}</span>
              <span className="radar-map-pin radar-map-pin-b">{radarReady ? radarGoogleViews : '—'}</span>
              <span className="radar-map-pin radar-map-pin-c">{radarReady ? radarWhatsappClicks : '—'}</span>
              <small>Interações dos últimos 30 dias</small>
            </div>
            <div className="widget-content-left">
              <div className="widget-badge-row">
                <span className="widget-type"><span className="radar-live-dot" /> PRESENÇA NO RADAR</span>
                <span className="widget-pill" style={{ background: '#e8f5e9', color: '#1c513e' }}>{radarStatus}</span>
              </div>
              <h3 className="widget-title">{radarTitle}</h3>
              <p className="widget-desc">{radarDescription}</p>
              <div className="widget-radar-stats" aria-label="Resumo do Radar">
                <div><strong>{radarReady ? radarViews : '—'}</strong><span>visitas ao perfil</span></div>
                <div><strong>{radarReady ? radarWhatsappClicks : '—'}</strong><span>cliques no WhatsApp</span></div>
              </div>
              <div className="widget-radar-actions">
                <button className="widget-btn" type="button" onClick={() => onNavigate('radar')}>
                  <span>Ver no mapa ↗</span>
                </button>
                <button className="widget-radar-secondary" type="button" onClick={() => onNavigate('mural')}>
                  WhatsApp · {radarReady ? radarWhatsappClicks : '—'}
                </button>
              </div>
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

            {attentionItems.length > 0 ? attentionItems.map((item, index) => (
              <div className="action-item" key={`${item.tab}-${item.title}`}>
                <div className="action-item-left">
                  <div className="action-bullet">{String(index + 1).padStart(2, '0')}</div>
                  <div className="action-text">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                </div>
                <button className="btn-action-trigger" type="button" onClick={() => onNavigate(item.tab)}>
                  {item.action}
                </button>
              </div>
            )) : (
              <div className="dashboard-empty-state">
                <strong>{attentionLoading ? 'Carregando prioridades da casa…' : attentionFailed ? 'Não foi possível carregar as prioridades' : 'Tudo em dia por aqui'}</strong>
                <small>{attentionFailed ? 'Atualize a página para tentar novamente.' : 'Quando surgir algo que precise de ação, aparecerá neste espaço.'}</small>
              </div>
            )}

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
              <div className="progress-circle">{setupReady ? `${setupProgress}%` : '—'}</div>
              <div>
                <strong style={{ fontSize: '14px', color: '#153b2a', display: 'block' }}>{setupReady ? `${setupDoneCount} de ${setupSteps.length} passos concluídos` : setupFailed ? 'Ativação indisponível' : 'Carregando ativação'}</strong>
                <small style={{ fontSize: '12px', color: '#6a6e62' }}>{!setupReady ? 'Os itens serão atualizados conforme os dados chegarem.' : setupDoneCount === setupSteps.length ? 'Configuração principal concluída.' : 'Continue pelos itens que ainda estão pendentes.'}</small>
              </div>
            </div>
            {setupSteps.map((step, index) => (
              <button className="checklist-step checklist-step-button" type="button" key={step.label} onClick={() => onNavigate(step.tab)}>
                <div className={`step-check ${step.done ? 'done' : ''}`}>{setupSources[index].data === undefined ? (setupSources[index].error ? '?' : '…') : step.done ? '✓' : index + 1}</div>
                <div className="step-info">
                  <strong>{step.label}</strong>
                  <small>{setupSources[index].data === undefined ? (setupSources[index].error ? 'Informação indisponível no momento.' : 'Carregando informação…') : step.detail}</small>
                </div>
              </button>
            ))}

          </div>

        </section>

        {/* 5. LINHA DO TEMPO DA CASA */}
        <section className="dashboard-timeline" aria-labelledby="timeline-title">
          <div className="timeline-header">
            <div className="timeline-heading">
              <span className="timeline-kicker">Ritmo da casa</span>
              <h2 id="timeline-title">Linha do tempo</h2>
              <p className="timeline-lead">O que já aconteceu, o que pede atenção e o próximo movimento da casa.</p>
            </div>
            <div className="timeline-summary" aria-label="Resumo da linha do tempo">
              <span className="timeline-summary-dot" aria-hidden="true" />
              <strong>{timelineItems.length} movimento{timelineItems.length === 1 ? '' : 's'}</strong>
              <span>próximos e recentes</span>
            </div>
          </div>

          {timelineItems.length > 0 ? (
            <div className="timeline-track" style={{ '--timeline-columns': Math.min(4, timelineItems.length) } as React.CSSProperties}>
              {timelineItems.map((item, index) => (
                <article className={`timeline-event timeline-event-${item.tone} ${index === 0 ? 'timeline-event-current' : ''}`} key={item.key}>
                  <div className="timeline-event-marker"><span className="timeline-node">{item.node}</span></div>
                  <div className="timeline-event-card">
                    <div className="timeline-card-top"><span className="timeline-event-icon" aria-hidden="true" /><span className="timeline-event-type">{item.type}</span></div>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-state timeline-empty-state">
              <strong>{timelineLoading ? 'Carregando a linha do tempo…' : timelineFailed ? 'Não foi possível carregar os movimentos' : 'A linha do tempo começa com o primeiro movimento da casa'}</strong>
              <small>{timelineFailed ? 'Atualize a página para tentar novamente.' : 'Giras, comunicados e movimentações financeiras aparecerão aqui automaticamente.'}</small>
            </div>
          )}
        </section>

        {/* Modais e sincronização do PreceitoCommandCenter */}
        <PreceitoCommandCenter
          key={preceitoScope}
          ref={preceitoRef}
          tenantId={tenantId || ''}
          variant="hidden"
          onActiveCycleChange={handleActivePreceitoChange}
        />
      </div>
    </div>
  );
};

export default DashboardBerry;
