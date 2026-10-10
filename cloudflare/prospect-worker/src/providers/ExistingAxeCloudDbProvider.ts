import type { ProspectingEnv } from '../types.js';
import type { IProspectSourceProvider, DiscoveryQuery, RawDiscoveredLead } from './types.js';

export class ExistingAxeCloudDbProvider implements IProspectSourceProvider {
  readonly code = 'existing_axecloud_database';
  readonly name = 'Base Existente AxéCloud';

  async fetchLeads(query: DiscoveryQuery, env: ProspectingEnv): Promise<RawDiscoveredLead[]> {
    const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase credentials ausentes para ExistingAxeCloudDbProvider.');
    }

    const targetCount = Math.min(query.limit || 50, 200);

    // 1. Busca todos os directory_ids já importados no CRM para garantir zero duplicatas (paginado via Range)
    const importedIds = new Set<string>();
    let dirOffset = 0;
    const dirBatchSize = 1000;
    while (true) {
      const existingLeadsRes = await fetch(`${supabaseUrl}/rest/v1/prospecting_leads?select=directory_id&directory_id=not.is.null`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Range: `${dirOffset}-${dirOffset + dirBatchSize - 1}`,
        },
      });
      if (!existingLeadsRes.ok) break;
      const existingLeads = (await existingLeadsRes.json().catch(() => [])) as Array<{ directory_id: string }>;
      if (!existingLeads || existingLeads.length === 0) break;
      for (const l of existingLeads) {
        if (l.directory_id) importedIds.add(l.directory_id);
      }
      if (existingLeads.length < dirBatchSize) break;
      dirOffset += dirBatchSize;
    }

    // 2. Pagina terreiros_diretorio em lotes até acumular targetCount registros não importados
    const pageSize = 150;
    const maxPages = 80; // Pode varrer até 12.000 terreiros por ciclo de busca
    let currentOffset = query.offset || 0;
    const unimportedRows: Array<{
      id: string;
      nome: string;
      endereco?: string | null;
      telefone?: string | null;
      cidade?: string | null;
      estado?: string | null;
      bairro?: string | null;
      slug?: string | null;
      link_maps?: string | null;
      instagram_url?: string | null;
      claimed_by_tenant_id?: string | null;
    }> = [];

    for (let page = 0; page < maxPages && unimportedRows.length < targetCount; page++) {
      const params = new URLSearchParams({
        select: 'id,nome,endereco,telefone,cidade,estado,bairro,slug,link_maps,instagram_url,claimed_by_tenant_id',
        limit: String(pageSize),
        offset: String(currentOffset),
        claimed_by_tenant_id: 'is.null',
        order: 'created_at.desc',
      });

      if (query.city) {
        params.append('cidade', `ilike.%${query.city}%`);
      }
      if (query.state) {
        params.append('estado', `ilike.%${query.state}%`);
      }

      const res = await fetch(`${supabaseUrl}/rest/v1/terreiros_diretorio?${params.toString()}`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Falha ao consultar terreiros_diretorio (${res.status}): ${errText}`);
      }

      const batch = (await res.json().catch(() => [])) as any[];
      if (!batch || batch.length === 0) {
        // Fim dos registros da tabela
        break;
      }

      for (const row of batch) {
        if (!importedIds.has(row.id)) {
          unimportedRows.push(row);
          if (unimportedRows.length >= targetCount) {
            break;
          }
        }
      }

      currentOffset += pageSize;
    }

    return unimportedRows.map((r) => {
      // Extrai google_place_id do link_maps se presente
      let placeId: string | null = null;
      if (r.link_maps && r.link_maps.includes('place_id=')) {
        const match = r.link_maps.match(/place_id=([a-zA-Z0-9_-]+)/);
        if (match) placeId = match[1];
      }

      return {
        name: r.nome,
        city: r.cidade,
        state: r.estado,
        address: [r.endereco, r.bairro].filter(Boolean).join(', ') || null,
        phone: r.telefone,
        instagram: r.instagram_url,
        google_place_id: placeId,
        directory_id: r.id,
        terreiro_id: r.claimed_by_tenant_id || null,
        source: 'existing_axecloud_database',
        rawPayload: r,
      };
    });
  }
}
