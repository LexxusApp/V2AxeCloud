import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import ModernAppShell from '../../src/components/app/ModernAppShell';
import { HouseToastHost } from '../../src/components/app/HouseToastHost';
import { AppPageShell } from '../../src/components/app/AppTopNav';
import Financial from '../../src/views/Financial';
import ModernDashboard from '../../src/components/dashboard/ModernDashboard';
import { AxePageHeader } from '../../src/components/shared/AxePageScaffold';

// Read-only fixture harness. This entry is never imported by the application.
const owner = '00000000-0000-4000-8000-000000000001';
function Review() {
  const [tab, setTab] = useState('dashboard');
  const tenant = { nome: 'Casa de validação local', nome_terreiro: 'Casa de validação local', tenant_id: owner, plan: 'premium', tradicao: 'umbanda' };
  const view = tab === 'financial-mensalidades' ? 'mensalidades' : tab === 'financial-cantina' ? 'cantina' : tab === 'financial-configs' ? 'configs' : 'overview';
  return <><HouseToastHost/><ModernAppShell activeTab={tab} setActiveTab={setTab} userRole="admin" tenantData={tenant} userDisplayName="Revisão da interface"><div className="mx-5 mt-5 rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-950">Validação visual com componentes reais. Dados de teste locais; gravações bloqueadas.</div>{tab === 'dashboard' ? <AppPageShell><ModernDashboard
    tenantId={owner} userId={owner} houseName={tenant.nome} name="Zelador(a)"
    members={[{id:owner,nome:'Membro de validação'}]} withoutApp={0} incompleteProfiles={0}
    pendingCount={1} pendingValue={102} nextEvent={null} events={[]}
    setupSteps={[{id:'dados',label:'Dados da casa',detail:'Configuração local',done:true,tab:'settings'},{id:'agenda',label:'Primeira gira',detail:'Marque um encontro',done:false,tab:'calendar'}]}
    onSetup={step=>setTab(step.tab)} secondaryReady={true} secondaryError={false} failed={false} stale={false}
    onReload={()=>window.location.reload()} attention={{obligationsPending:0,obligationsOverdue:0,lowStock:0,outOfStock:0,whatsappFailed:0}}
    pendingCare={0} radar={{claimed:false,metrics:{views7:0,whatsappClicks30:0}}} onNavigate={setTab}
  /></AppPageShell> : tab.startsWith('financial') ? <Financial key={tab} userId={owner} userRole="admin" tenantData={tenant} isSessionReady={true} setActiveTab={setTab} initialView={view}/> : <AppPageShell><AxePageHeader title="Validação da navegação" description={`Destino selecionado: ${tab}. Esta página de revisão testa os componentes reais em modo de leitura.`}/><button type="button" onClick={() => setTab('financial')}>Voltar ao financeiro</button></AppPageShell>}</ModernAppShell></>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
