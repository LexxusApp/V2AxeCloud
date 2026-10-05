import type { ProspectingEnv } from '../types.js';
import type { IProspectSourceProvider, DiscoveryQuery, RawDiscoveredLead } from './types.js';

export class GooglePlacesProvider implements IProspectSourceProvider {
  readonly code = 'google_places';
  readonly name = 'Google Places API';

  async fetchLeads(query: DiscoveryQuery, env: ProspectingEnv): Promise<RawDiscoveredLead[]> {
    const apiKey = String(env.GOOGLE_PLACES_API_KEY || env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      console.warn('[GooglePlacesProvider] GOOGLE_PLACES_API_KEY não configurada.');
      return [];
    }

    const searchQuery = query.query || `terreiro de umbanda candomble ${query.city || ''} ${query.state || ''}`.trim();
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', searchQuery);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'pt-BR');

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Places HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      results?: Array<{
        place_id: string;
        name: string;
        formatted_address?: string;
        types?: string[];
      }>;
    };

    const results = data.results || [];
    return results.map((p) => ({
      name: p.name,
      city: query.city || null,
      state: query.state || null,
      address: p.formatted_address || null,
      google_place_id: p.place_id,
      source: 'google_places',
      rawPayload: p,
    }));
  }
}
