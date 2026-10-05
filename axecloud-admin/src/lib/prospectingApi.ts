import { apiJson } from './api';

export type ProspectStatus =
  | 'discovered'
  | 'enriching'
  | 'analyzed'
  | 'qualified'
  | 'waiting_contact'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'demo'
  | 'trial'
  | 'customer'
  | 'not_interested'
  | 'do_not_contact'
  | 'duplicate'
  | 'invalid';

export interface ProspectLeadItem {
  id: string;
  terreiro_id?: string | null;
  directory_id?: string | null;
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  google_place_id?: string | null;
  source: string;
  status: ProspectStatus;
  score: number;
  ai_summary?: string | null;
  last_contact_at?: string | null;
  next_action_at?: string | null;
  whatsapp_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProspectDashboardData {
  counts: {
    discovered: number;
    enriching: number;
    analyzed: number;
    qualified: number;
    contacted: number;
    replied: number;
    interested: number;
    demo: number;
    trial: number;
    customer: number;
    total: number;
  };
  funnel: Array<{ stage: string; count: number; label: string }>;
  timeSeries: Array<{ date: string; leads: number; contacted: number; qualified: number }>;
}

export interface LeadDetailResponse {
  lead: ProspectLeadItem;
  analyses: Array<{
    id: string;
    score: number;
    confidence: number;
    summary: string;
    business_signals: string[];
    possible_needs: string[];
    digital_presence: Record<string, unknown>;
    recommended_next_action: string;
    created_at: string;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    from_status?: string | null;
    to_status?: string | null;
    description: string;
    metadata?: Record<string, unknown>;
    created_at: string;
  }>;
  conversations: Array<{
    id: string;
    channel: string;
    status: string;
    last_message_at?: string | null;
    human_handoff: boolean;
  }>;
}

export async function fetchProspectingDashboard(): Promise<ProspectDashboardData> {
  return apiJson<ProspectDashboardData>('/api/prospecting/dashboard');
}

export async function fetchProspectingLeads(params: {
  status?: string;
  city?: string;
  state?: string;
  scoreMin?: number;
  scoreMax?: number;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ leads: ProspectLeadItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.city) query.set('city', params.city);
  if (params.state) query.set('state', params.state);
  if (params.source) query.set('source', params.source);
  if (params.search) query.set('search', params.search);
  if (params.scoreMin != null) query.set('scoreMin', String(params.scoreMin));
  if (params.scoreMax != null) query.set('scoreMax', String(params.scoreMax));
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));

  return apiJson<{ leads: ProspectLeadItem[]; total: number }>(`/api/prospecting/leads?${query.toString()}`);
}

export async function fetchLeadDetail(id: string): Promise<LeadDetailResponse> {
  return apiJson<LeadDetailResponse>(`/api/prospecting/leads/${id}`);
}

export async function triggerLeadAnalysis(id: string): Promise<any> {
  return apiJson(`/api/prospecting/leads/${id}/analyze`, { method: 'POST' });
}

export async function qualifyLeadManual(id: string): Promise<any> {
  return apiJson(`/api/prospecting/leads/${id}/qualify`, { method: 'POST' });
}

export async function blacklistLeadManual(id: string): Promise<any> {
  return apiJson(`/api/prospecting/leads/${id}/blacklist`, { method: 'POST' });
}

export async function updateLeadPartial(id: string, patch: Partial<ProspectLeadItem>): Promise<any> {
  return apiJson(`/api/prospecting/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function startProspectingDiscovery(params: {
  providerCode: string;
  city?: string;
  state?: string;
  limit?: number;
}): Promise<any> {
  return apiJson('/api/prospecting/discovery/start', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function sendLeadWhatsApp(leadId: string): Promise<{ success: boolean; messageId: string; lead: ProspectLeadItem }> {
  return apiJson(`/api/prospecting/leads/${leadId}/send-whatsapp`, {
    method: 'POST',
  });
}

export async function batchSendWhatsApp(limit = 5): Promise<{ success: boolean; sentCount: number; total: number; results: any[] }> {
  return apiJson('/api/prospecting/outbound/batch-send', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}
