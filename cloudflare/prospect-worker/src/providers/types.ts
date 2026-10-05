import type { ProspectingEnv } from '../types.js';

export interface RawDiscoveredLead {
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  google_place_id?: string | null;
  directory_id?: string | null;
  terreiro_id?: string | null;
  source: string;
  rawPayload?: Record<string, unknown>;
}

export interface DiscoveryQuery {
  city?: string;
  state?: string;
  query?: string;
  limit?: number;
  offset?: number;
  config?: Record<string, unknown>;
}

export interface IProspectSourceProvider {
  readonly code: string;
  readonly name: string;
  fetchLeads(query: DiscoveryQuery, env: ProspectingEnv): Promise<RawDiscoveredLead[]>;
}
