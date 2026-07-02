import { authFetch } from './authenticatedFetch';
import type { VelaCor } from './pedidosRezaTypes';

export type ParticipanteStatus = 'pendente' | 'confirmado' | 'recusado' | 'presente';

export type EventoParticipante = {
  id: string;
  event_id: string;
  filho_id: string;
  status: ParticipanteStatus;
  checkin_token?: string | null;
  responded_at?: string | null;
  checked_in_at?: string | null;
  justificativa?: string | null;
  filhos_de_santo?: {
    nome?: string;
    cargo?: string;
    foto_url?: string | null;
    whatsapp_phone?: string | null;
  };
};

export type EventoSenha = {
  id: string;
  numero: number;
  nome: string;
  telefone?: string | null;
  status: 'aguardando' | 'presente' | 'chamado' | 'atendido' | 'cancelado';
  called_at?: string | null;
  attended_at?: string | null;
  checked_in_at?: string | null;
};

export type MapaVelaItem = {
  id: string | null;
  filho_id: string;
  nome: string;
  cargo?: string | null;
  foto_url?: string | null;
  vela: VelaCor | null;
  quantidade: number;
  entregue: boolean;
  observacao?: string;
};

export type GiraEventConfig = {
  vagas_maximas?: number | null;
  senhas_maximas?: number | null;
  confirmacao_automatica?: boolean;
  senhas_ativas?: boolean;
  checkin_qr_token?: string | null;
  senhas_public_token?: string | null;
  evento_public_token?: string | null;
  evento_publico?: boolean;
};

export type EventoConfirmadoResumo = {
  filho_id: string;
  nome: string;
  foto_url: string | null;
};

export async function fetchConfirmadosResumo(tenantId: string) {
  const res = await authFetch(
    `/api/v1/events/confirmados-resumo?tenantId=${encodeURIComponent(tenantId)}`,
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar confirmações');
  return json.data as Record<string, EventoConfirmadoResumo[]>;
}

export async function fetchParticipantes(eventId: string, tenantId: string) {
  const res = await authFetch(
    `/api/v1/events/${encodeURIComponent(eventId)}/participantes?tenantId=${encodeURIComponent(tenantId)}`,
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar participantes');
  return json as {
    data: EventoParticipante[];
    stats: {
      total: number;
      confirmados: number;
      presentes: number;
      vagas_maximas: number | null;
      vagas_restantes: number | null;
    };
    checkinUrl: string | null;
    senhasUrl: string | null;
    eventoPublicUrl: string | null;
    event: GiraEventConfig & { id: string; titulo?: string };
  };
}

export async function patchGiraConfig(
  eventId: string,
  tenantId: string,
  patch: Partial<GiraEventConfig>,
) {
  const res = await authFetch(`/api/v1/events/${encodeURIComponent(eventId)}/gira-config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, ...patch }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao salvar configuração');
  return json.data;
}

export async function respondParticipacao(
  eventId: string,
  tenantId: string,
  action: 'confirmar' | 'declinar',
  filhoId?: string,
) {
  const res = await authFetch(
    `/api/v1/events/${encodeURIComponent(eventId)}/participantes/respond`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, action, filhoId }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao registrar resposta');
  return json;
}

export async function approveParticipante(
  eventId: string,
  tenantId: string,
  participanteId: string,
) {
  const res = await authFetch(
    `/api/v1/events/${encodeURIComponent(eventId)}/participantes/${encodeURIComponent(participanteId)}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao aprovar');
  return json.data;
}

export async function fetchFrequenciaReport(tenantId: string) {
  const res = await authFetch(`/api/v1/frequencia?tenantId=${encodeURIComponent(tenantId)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar frequência');
  return json.data as Array<{
    filho_id: string;
    nome: string;
    cargo?: string;
    foto_url?: string | null;
    total_eventos: number;
    confirmados: number;
    presentes: number;
    faltas: number;
    assiduidade_pct: number;
  }>;
}

export async function fetchMinhasParticipacoes(tenantId: string, start: string, end: string) {
  const qs = new URLSearchParams({ tenantId, start, end });
  const res = await authFetch(`/api/v1/participacoes?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar participações');
  return json.data as Array<{
    id: string;
    event_id: string;
    status: ParticipanteStatus;
    checkin_token?: string | null;
    evento?: {
      titulo: string;
      data: string;
      hora: string;
      tipo: string;
      vagas_maximas?: number | null;
    } | null;
  }>;
}

export async function fetchSenhas(eventId: string, tenantId: string) {
  const res = await authFetch(
    `/api/v1/events/${encodeURIComponent(eventId)}/senhas?tenantId=${encodeURIComponent(tenantId)}`,
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar senhas');
  return json.data as EventoSenha[];
}

export async function emitirSenhaZelador(
  eventId: string,
  tenantId: string,
  nome: string,
  telefone?: string,
) {
  const res = await authFetch(`/api/v1/events/${encodeURIComponent(eventId)}/senhas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, nome, telefone }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao emitir senha');
  return json.data as EventoSenha;
}

export async function updateSenhaStatus(
  eventId: string,
  tenantId: string,
  senhaId: string,
  status: EventoSenha['status'],
) {
  const res = await authFetch(
    `/api/v1/events/${encodeURIComponent(eventId)}/senhas/${encodeURIComponent(senhaId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, status }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao atualizar senha');
  return json.data as EventoSenha;
}

export async function fetchMapaVelas(eventId: string, tenantId: string) {
  const res = await authFetch(
    `/api/v1/events/${encodeURIComponent(eventId)}/mapa-velas?tenantId=${encodeURIComponent(tenantId)}`,
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar mapa de velas');
  return json.data as MapaVelaItem[];
}

export async function saveMapaVelas(
  eventId: string,
  tenantId: string,
  items: Array<{
    filho_id: string;
    vela: VelaCor;
    quantidade?: number;
    observacao?: string;
    entregue?: boolean;
  }>,
) {
  const res = await authFetch(`/api/v1/events/${encodeURIComponent(eventId)}/mapa-velas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, items }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao salvar mapa de velas');
}

export async function toggleVelaEntregue(
  eventId: string,
  tenantId: string,
  velaId: string,
  entregue: boolean,
) {
  const res = await authFetch(
    `/api/v1/events/${encodeURIComponent(eventId)}/mapa-velas/${encodeURIComponent(velaId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, entregue }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao atualizar vela');
  return json.data;
}
