import type {
  ProspectingEnv,
  ProspectingLead,
  ProspectStatus,
  ProspectingEvent,
  ProspectingAiAnalysisRow,
  ProspectingConversation,
  ProspectingMessage,
} from '../../types.js';
import { normalizePhone } from '../../deduplication/leadDeduplicator.js';

export class CrmService {
  private supabaseUrl: string;
  private serviceKey: string;

  constructor(private env: ProspectingEnv) {
    this.supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!this.supabaseUrl || !this.serviceKey) {
      throw new Error('Supabase credentials ausentes no CrmService.');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.supabaseUrl}/rest/v1/${endpoint}`;
    const headers = new Headers(options.headers);
    headers.set('apikey', this.serviceKey);
    headers.set('Authorization', `Bearer ${this.serviceKey}`);
    headers.set('Content-Type', 'application/json');

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Supabase REST ${res.status} em ${endpoint}: ${err}`);
    }

    if (res.status === 204) return null as unknown as T;
    const text = await res.text();
    if (!text || !text.trim()) return null as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null as unknown as T;
    }
  }

  async getLeads(filters: {
    status?: string;
    city?: string;
    state?: string;
    scoreMin?: number;
    scoreMax?: number;
    source?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ leads: ProspectingLead[]; total: number }> {
    const limit = Math.min(filters.limit || 50, 200);
    const offset = filters.offset || 0;

    const params = new URLSearchParams({
      select: '*',
      order: 'created_at.desc',
      limit: String(limit),
      offset: String(offset),
    });

    if (filters.status) params.append('status', `eq.${filters.status}`);
    if (filters.city) params.append('city', `ilike.%${filters.city}%`);
    if (filters.state) params.append('state', `ilike.%${filters.state}%`);
    if (filters.source) params.append('source', `eq.${filters.source}`);
    if (filters.scoreMin != null) params.append('score', `gte.${filters.scoreMin}`);
    if (filters.scoreMax != null) params.append('score', `lte.${filters.scoreMax}`);
    if (filters.search) {
      params.append('or', `(name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,city.ilike.%${filters.search}%)`);
    }

    const countHeaders = new Headers();
    countHeaders.set('Prefer', 'count=exact');

    const url = `${this.supabaseUrl}/rest/v1/prospecting_leads?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'count=exact',
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Falha ao listar leads (${res.status}): ${err}`);
    }

    const contentRange = res.headers.get('content-range');
    const totalMatch = contentRange?.match(/\/(\d+|\*)/);
    const total = totalMatch && totalMatch[1] !== '*' ? parseInt(totalMatch[1], 10) : 0;

    const rawLeads = await res.json().catch(() => []);
    const leads = (Array.isArray(rawLeads) ? rawLeads : []) as ProspectingLead[];
    return { leads, total };
  }

  async getLeadById(id: string): Promise<ProspectingLead | null> {
    const rows = await this.request<ProspectingLead[]>(`prospecting_leads?id=eq.${id}&select=*`);
    return rows && rows.length ? rows[0] : null;
  }

  async findLeadByPhone(phone: string): Promise<ProspectingLead | null> {
    const norm = normalizePhone(phone);
    if (!norm) return null;

    const variants = new Set<string>([norm]);
    if (norm.startsWith('55') && norm.length === 12) {
      variants.add(`55${norm.slice(2, 4)}9${norm.slice(4)}`);
    } else if (norm.startsWith('55') && norm.length === 13 && norm[4] === '9') {
      variants.add(`55${norm.slice(2, 4)}${norm.slice(5)}`);
    }

    const orFilters: string[] = [];
    for (const v of variants) {
      orFilters.push(`phone_normalized.eq.${v}`);
      orFilters.push(`phone.eq.${v}`);
      orFilters.push(`phone.eq.%2B${v}`);
    }

    const rows = await this.request<ProspectingLead[]>(
      `prospecting_leads?or=(${orFilters.join(',')})&select=*&limit=1`,
    );
    return rows && rows.length ? rows[0] : null;
  }

  async listAllCandidatesForDedup(): Promise<Array<Partial<ProspectingLead>>> {
    const leads: Array<Partial<ProspectingLead>> = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const res = await fetch(
        `${this.supabaseUrl}/rest/v1/prospecting_leads?select=id,name,city,address,phone,phone_normalized,website,instagram,google_place_id,directory_id`,
        {
          headers: {
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
            Range: `${from}-${from + batchSize - 1}`,
          },
        },
      );
      if (!res.ok) break;
      const batch = (await res.json().catch(() => [])) as Array<Partial<ProspectingLead>>;
      if (!batch || batch.length === 0) break;
      leads.push(...batch);
      if (batch.length < batchSize) break;
      from += batchSize;
    }
    return leads;
  }

  async createLead(lead: Partial<ProspectingLead>): Promise<ProspectingLead> {
    const normPhone = normalizePhone(lead.phone);
    const payload = {
      ...lead,
      phone_normalized: normPhone || null,
      status: lead.status || 'discovered',
      score: lead.score != null ? lead.score : 0,
      whatsapp_opt_in: Boolean(lead.whatsapp_opt_in),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = await this.request<ProspectingLead[]>('prospecting_leads', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify(payload),
    });

    const leadCreated = Array.isArray(created) ? created[0] : null;
    if (!leadCreated) {
      if (lead.directory_id) {
        const rows = await this.request<ProspectingLead[]>(`prospecting_leads?directory_id=eq.${lead.directory_id}&select=*&limit=1`);
        if (rows && rows[0]) return rows[0];
      }
      if (normPhone) {
        const found = await this.findLeadByPhone(normPhone);
        if (found) return found;
      }
      return lead as ProspectingLead;
    }

    // Registra evento de criação
    await this.recordEvent({
      lead_id: leadCreated.id,
      event_type: 'lead_discovered',
      to_status: leadCreated.status,
      description: `Lead criado via fonte ${leadCreated.source}`,
      metadata: { source: leadCreated.source },
    }).catch((e) => console.error('[CrmService] Erro ao registrar evento de criação:', e));

    return leadCreated;
  }

  async createLeadsBatch(leads: Array<Partial<ProspectingLead>>): Promise<ProspectingLead[]> {
    if (!leads.length) return [];

    const now = new Date().toISOString();
    const payloads = leads.map((lead) => {
      const normPhone = normalizePhone(lead.phone);
      return {
        ...lead,
        phone_normalized: normPhone || null,
        status: lead.status || 'discovered',
        score: lead.score != null ? lead.score : 0,
        whatsapp_opt_in: Boolean(lead.whatsapp_opt_in),
        created_at: now,
        updated_at: now,
      };
    });

    const created = await this.request<ProspectingLead[]>('prospecting_leads', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify(payloads),
    });

    const result = Array.isArray(created) ? created : [];

    // Grava eventos de descoberta de forma assíncrona
    for (const lead of result) {
      if (lead && lead.id) {
        void this.recordEvent({
          lead_id: lead.id,
          event_type: 'lead_discovered',
          to_status: lead.status,
          description: `Lead criado via fonte ${lead.source}`,
          metadata: { source: lead.source },
        }).catch((e) => console.error('[CrmService] Erro ao gravar evento do lead:', e));
      }
    }

    return result;
  }

  async updateLead(id: string, patch: Partial<ProspectingLead>): Promise<ProspectingLead> {
    const prev = await this.getLeadById(id);
    const cleanPatch: Record<string, unknown> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    if (patch.phone) {
      cleanPatch.phone_normalized = normalizePhone(patch.phone) || null;
    }

    const updated = await this.request<ProspectingLead[]>(`prospecting_leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(cleanPatch),
    });

    const leadUpdated = updated[0];

    // Se houve mudança de status, registra evento no histórico
    if (prev && patch.status && patch.status !== prev.status) {
      await this.recordEvent({
        lead_id: id,
        event_type: 'lead_status_changed',
        from_status: prev.status,
        to_status: patch.status,
        description: `Status alterado de ${prev.status} para ${patch.status}`,
        metadata: { prevScore: prev.score, newScore: leadUpdated.score },
      });
    }

    return leadUpdated;
  }

  async recordEvent(event: ProspectingEvent): Promise<void> {
    await this.request('prospecting_events', {
      method: 'POST',
      body: JSON.stringify({
        ...event,
        created_at: new Date().toISOString(),
      }),
    });
  }

  async getEvents(leadId: string): Promise<ProspectingEvent[]> {
    return this.request<ProspectingEvent[]>(`prospecting_events?lead_id=eq.${leadId}&select=*&order=created_at.desc`);
  }

  async recordAiAnalysis(analysis: Omit<ProspectingAiAnalysisRow, 'id' | 'created_at'>): Promise<ProspectingAiAnalysisRow> {
    const rows = await this.request<ProspectingAiAnalysisRow[]>('prospecting_ai_analysis', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        ...analysis,
        created_at: new Date().toISOString(),
      }),
    });

    // Atualiza o lead com o novo score e resumo
    await this.updateLead(analysis.lead_id, {
      score: analysis.score,
      ai_summary: analysis.summary,
      status: analysis.score >= 50 ? 'qualified' : 'analyzed',
      updated_at: new Date().toISOString(),
    });

    await this.recordEvent({
      lead_id: analysis.lead_id,
      event_type: 'ai_analysis_completed',
      description: `Análise IA concluída com score ${analysis.score}/100`,
      metadata: {
        score: analysis.score,
        confidence: analysis.confidence,
        signals: analysis.business_signals,
      },
    });

    return rows[0];
  }

  async getAiAnalyses(leadId: string): Promise<ProspectingAiAnalysisRow[]> {
    return this.request<ProspectingAiAnalysisRow[]>(
      `prospecting_ai_analysis?lead_id=eq.${leadId}&select=*&order=created_at.desc`,
    );
  }

  async getConversations(leadId: string): Promise<ProspectingConversation[]> {
    return this.request<ProspectingConversation[]>(
      `prospecting_conversations?lead_id=eq.${leadId}&select=*&order=updated_at.desc`,
    );
  }

  async getMessages(conversationId: string): Promise<ProspectingMessage[]> {
    return this.request<ProspectingMessage[]>(
      `prospecting_messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc`,
    );
  }

  async isPhoneBlacklisted(phone?: string | null): Promise<boolean> {
    const norm = normalizePhone(phone);
    if (!norm) return false;
    const rows = await this.request<{ phone: string }[]>(`prospecting_blacklist?phone=eq.${norm}&select=phone&limit=1`);
    return Boolean(rows && rows.length > 0);
  }

  async addToBlacklist(phone: string, reason: string, source = 'opt_out'): Promise<void> {
    const norm = normalizePhone(phone);
    if (!norm) return;
    await this.request('prospecting_blacklist', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        phone: norm,
        reason,
        source,
        created_at: new Date().toISOString(),
      }),
    });
  }

  async getDashboardMetrics(): Promise<{
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
  }> {
    const leads: Array<{ status: ProspectStatus; score: number; created_at: string; last_contact_at: string | null }> = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const res = await fetch(
        `${this.supabaseUrl}/rest/v1/prospecting_leads?select=status,score,created_at,last_contact_at`,
        {
          headers: {
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
            Range: `${from}-${from + batchSize - 1}`,
          },
        },
      );
      if (!res.ok) break;
      const batch = (await res.json().catch(() => [])) as Array<{
        status: ProspectStatus;
        score: number;
        created_at: string;
        last_contact_at: string | null;
      }>;
      if (!batch || batch.length === 0) break;
      leads.push(...batch);
      if (batch.length < batchSize) break;
      from += batchSize;
    }

    const counts = {
      discovered: 0,
      enriching: 0,
      analyzed: 0,
      qualified: 0,
      contacted: 0,
      replied: 0,
      interested: 0,
      demo: 0,
      trial: 0,
      customer: 0,
      total: leads.length,
    };

    const daysMap = new Map<string, { leads: number; contacted: number; qualified: number }>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      daysMap.set(d, { leads: 0, contacted: 0, qualified: 0 });
    }

    for (const lead of leads) {
      if (counts[lead.status] !== undefined) {
        counts[lead.status]++;
      }

      const day = (lead.created_at || '').slice(0, 10);
      if (daysMap.has(day)) {
        const item = daysMap.get(day)!;
        item.leads++;
        if (lead.score >= 50 || lead.status === 'qualified') item.qualified++;
      }

      if (lead.last_contact_at) {
        const cDay = lead.last_contact_at.slice(0, 10);
        if (daysMap.has(cDay)) {
          daysMap.get(cDay)!.contacted++;
        }
      }
    }

    const funnel = [
      { stage: 'discovered', count: counts.total, label: 'Leads Encontrados' },
      { stage: 'qualified', count: counts.qualified, label: 'Qualificados' },
      { stage: 'contacted', count: counts.contacted, label: 'Contatados' },
      { stage: 'replied', count: counts.replied, label: 'Responderam' },
      { stage: 'interested', count: counts.interested, label: 'Interessados' },
      { stage: 'trial', count: counts.trial + counts.demo, label: 'Em Teste' },
      { stage: 'customer', count: counts.customer, label: 'Clientes' },
    ];

    const timeSeries = Array.from(daysMap.entries()).map(([date, val]) => ({
      date,
      ...val,
    }));

    return { counts, funnel, timeSeries };
  }

  async getAdminConversationHistory(phone: string, limit = 8): Promise<Array<{ direction: 'inbound' | 'outbound'; body: string }>> {
    const norm = normalizePhone(phone);
    if (!norm) return [];
    const convs = await this.request<Array<{ id: string }>>(`admin_whatsapp_conversations?phone_e164=eq.${norm}&select=id&limit=1`);
    if (!convs || !convs[0]) return [];
    const msgs = await this.request<Array<{ direction: 'inbound' | 'outbound'; body: string }>>(
      `admin_whatsapp_messages?conversation_id=eq.${convs[0].id}&select=direction,body&order=created_at.desc&limit=${limit}`,
    );
    return Array.isArray(msgs) ? msgs.reverse() : [];
  }

  async recordInboundAdminMessage(phone: string, body: string, externalId?: string, contactName?: string): Promise<string | null> {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    const nowIso = new Date().toISOString();
    let convId: string | null = null;
    const existing = await this.request<Array<{ id: string; unread_count: number }>>(
      `admin_whatsapp_conversations?phone_e164=eq.${norm}&select=id,unread_count&limit=1`,
    );
    if (existing && existing[0]) {
      convId = existing[0].id;
      const patch: Record<string, unknown> = {
        last_message_at: nowIso,
        last_message_preview: (body || '').slice(0, 160),
        unread_count: (existing[0].unread_count || 0) + 1,
        status: 'open',
        updated_at: nowIso,
      };
      if (contactName) patch.contact_name = contactName;
      await this.request(`admin_whatsapp_conversations?id=eq.${convId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } else {
      const created = await this.request<Array<{ id: string }>>('admin_whatsapp_conversations', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          phone_e164: norm,
          contact_name: contactName || null,
          last_message_at: nowIso,
          last_message_preview: (body || '').slice(0, 160),
          unread_count: 1,
          status: 'open',
          created_at: nowIso,
          updated_at: nowIso,
        }),
      });
      if (created && created[0]) convId = created[0].id;
    }
    if (convId) {
      await this.request('admin_whatsapp_messages', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({
          conversation_id: convId,
          direction: 'inbound',
          body: body || '',
          message_type: 'text',
          external_id: externalId || null,
          status: 'received',
          created_at: nowIso,
        }),
      });
    }
    return convId;
  }

  async recordOutboundAdminMessage(convId: string, body: string, externalId?: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.request('admin_whatsapp_messages', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: convId,
        direction: 'outbound',
        body: body || '',
        message_type: 'text',
        external_id: externalId || null,
        status: 'sent',
        created_at: nowIso,
      }),
    });
    await this.request(`admin_whatsapp_conversations?id=eq.${convId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        last_message_at: nowIso,
        last_message_preview: (body || '').slice(0, 160),
        status: 'open',
        updated_at: nowIso,
      }),
    });
  }

  async applyMessageStatusUpdate(
    externalId: string,
    status: string,
    errorCode?: string | null,
    errorMessage?: string | null,
  ): Promise<void> {
    if (!externalId || !status) return;

    const rawStatus = String(status).trim().toLowerCase();
    const mappedStatus = rawStatus === 'delivered'
      ? 'delivered'
      : rawStatus === 'read'
        ? 'read'
        : rawStatus === 'failed' || rawStatus === 'deleted'
          ? 'failed'
          : 'sent';
    const externalIdFilter = new URLSearchParams({ external_id: `eq.${externalId}` }).toString();

    // Mantém a caixa operacional e o histórico legado sincronizados, mesmo
    // quando esta mensagem não foi criada pelo rastreador central.
    await this.request(`admin_whatsapp_messages?${externalIdFilter}&direction=eq.outbound`, {
      method: 'PATCH',
      body: JSON.stringify({ status: mappedStatus }),
    }).catch((error) => console.warn('[CrmService] Falha ao atualizar Caixa WA:', error));

    await this.request(`whatsapp_logs?${externalIdFilter}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: mappedStatus }),
    }).catch((error) => console.warn('[CrmService] Falha ao atualizar whatsapp_logs:', error));

    const deliveryParams = new URLSearchParams({
      external_id: `eq.${externalId}`,
      select: 'id,status',
      limit: '1',
    });
    const deliveries = await this.request<Array<{ id: string; status: string }>>(
      `whatsapp_deliveries?${deliveryParams.toString()}`,
    );
    const delivery = Array.isArray(deliveries) ? deliveries[0] : null;
    if (!delivery?.id) return;

    const statusRank: Record<string, number> = {
      queued: 0,
      sending: 1,
      accepted: 2,
      unknown: 2,
      sent: 3,
      delivered: 4,
      read: 5,
      failed: 6,
    };
    const currentStatus = String(delivery.status || 'queued').toLowerCase();
    const terminalFailure = currentStatus === 'failed' && !['read', 'delivered'].includes(mappedStatus);
    const downgrade = (statusRank[mappedStatus] ?? 0) < (statusRank[currentStatus] ?? 0)
      && currentStatus !== 'unknown';
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_webhook_at: nowIso,
      updated_at: nowIso,
    };

    if (!terminalFailure && !downgrade) {
      patch.status = mappedStatus;
      if (mappedStatus === 'sent') patch.sent_at = nowIso;
      if (mappedStatus === 'delivered') patch.delivered_at = nowIso;
      if (mappedStatus === 'read') patch.read_at = nowIso;
      if (mappedStatus === 'failed') {
        patch.failed_at = nowIso;
        patch.error_code = errorCode ? String(errorCode).slice(0, 80) : null;
        patch.error_message = errorMessage ? String(errorMessage).slice(0, 1000) : null;
      }
    }

    await this.request(`whatsapp_deliveries?id=eq.${encodeURIComponent(delivery.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });

    await this.request('whatsapp_delivery_events', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        delivery_id: delivery.id,
        status: mappedStatus,
        event_type: 'meta_webhook',
        event_key: `webhook:${externalId}:${mappedStatus}`,
        payload: {
          metaStatus: rawStatus,
          errorCode: errorCode || null,
          errorMessage: errorMessage || null,
        },
        created_at: nowIso,
      }),
    });
  }

  async updateSourceDiscoveryTime(sourceCode: string, newLeadsCount: number): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.request(`prospecting_sources?code=eq.${sourceCode}`, {
      method: 'PATCH',
      body: JSON.stringify({
        updated_at: nowIso,
        config: {
          last_discovery_at: nowIso,
          last_discovery_count: newLeadsCount,
          last_discovery_status: 'success',
        },
      }),
    }).catch((e) => console.error('[CrmService] Erro ao atualizar timestamp da fonte:', e));
  }

  async findFilhoDeSantoByPhone(phone: string): Promise<{ id: string; nome: string; tenant_id: string } | null> {
    const clean = String(phone || '').replace(/\D/g, '');
    if (!clean) return null;
    const without55 = clean.startsWith('55') ? clean.slice(2) : clean;
    const with55 = clean.startsWith('55') ? clean : `55${clean}`;
    try {
      const orFilter = `(whatsapp_phone.eq.${without55},whatsapp_phone.eq.${with55},whatsapp_phone.eq.%2B${with55})`;
      const rows = await this.request<Array<{ id: string; nome: string; tenant_id: string }>>(
        `filhos_de_santo?or=${orFilter}&select=id,nome,tenant_id&limit=1`,
      );
      return rows && rows[0] ? rows[0] : null;
    } catch (e) {
      console.warn('[CrmService] Erro ao buscar filho_de_santo por telefone:', e);
      return null;
    }
  }

  async findPerfilLiderByPhone(phone: string): Promise<{ id: string; nome_terreiro: string; cargo?: string } | null> {
    const clean = String(phone || '').replace(/\D/g, '');
    if (!clean) return null;
    const without55 = clean.startsWith('55') ? clean.slice(2) : clean;
    const with55 = clean.startsWith('55') ? clean : `55${clean}`;
    try {
      const orFilter = `(whatsapp.eq.${without55},whatsapp.eq.${with55},whatsapp_publico.eq.${without55},whatsapp_publico.eq.${with55})`;
      const rows = await this.request<Array<{ id: string; nome_terreiro: string; cargo?: string }>>(
        `perfil_lider?or=${orFilter}&select=id,nome_terreiro,cargo&limit=1`,
      );
      return rows && rows[0] ? rows[0] : null;
    } catch (e) {
      console.warn('[CrmService] Erro ao buscar perfil_lider por telefone:', e);
      return null;
    }
  }
}
