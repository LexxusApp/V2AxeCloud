import type { ProspectingEnv } from '../types.js';
import type { IProspectSourceProvider, DiscoveryQuery, RawDiscoveredLead } from './types.js';

export class ManualLeadProvider implements IProspectSourceProvider {
  readonly code = 'manual';
  readonly name = 'Cadastro Manual';

  async fetchLeads(query: DiscoveryQuery, _env: ProspectingEnv): Promise<RawDiscoveredLead[]> {
    const raw = query.config?.lead as Partial<RawDiscoveredLead> | undefined;
    if (!raw?.name) return [];

    return [
      {
        name: raw.name,
        city: raw.city || null,
        state: raw.state || null,
        address: raw.address || null,
        phone: raw.phone || null,
        email: raw.email || null,
        website: raw.website || null,
        instagram: raw.instagram || null,
        google_place_id: raw.google_place_id || null,
        source: 'manual',
        rawPayload: raw.rawPayload || {},
      },
    ];
  }
}
