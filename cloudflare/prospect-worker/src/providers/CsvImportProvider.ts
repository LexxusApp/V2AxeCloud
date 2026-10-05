import type { ProspectingEnv } from '../types.js';
import type { IProspectSourceProvider, DiscoveryQuery, RawDiscoveredLead } from './types.js';

export class CsvImportProvider implements IProspectSourceProvider {
  readonly code = 'csv';
  readonly name = 'Importação CSV';

  async fetchLeads(query: DiscoveryQuery, _env: ProspectingEnv): Promise<RawDiscoveredLead[]> {
    const csvContent = String(query.config?.csvText || '').trim();
    if (!csvContent) return [];

    return this.parseCsv(csvContent);
  }

  parseCsv(content: string): RawDiscoveredLead[] {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    // Header parsing
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(delimiter).map((h) =>
      h.trim().toLowerCase().replace(/^["']|["']$/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const nameIdx = headers.findIndex((h) => /^(nome|terreiro|casa|organizacao|lead)$/.test(h));
    const phoneIdx = headers.findIndex((h) => /^(telefone|fone|whatsapp|celular|tel)$/.test(h));
    const cityIdx = headers.findIndex((h) => /^(cidade|municipio)$/.test(h));
    const stateIdx = headers.findIndex((h) => /^(estado|uf)$/.test(h));
    const addressIdx = headers.findIndex((h) => /^(endereco|logradouro|rua)$/.test(h));
    const emailIdx = headers.findIndex((h) => /^(email|e-mail|correio)$/.test(h));
    const siteIdx = headers.findIndex((h) => /^(site|website|url|dominio)$/.test(h));
    const instaIdx = headers.findIndex((h) => /^(instagram|insta|ig)$/.test(h));
    const placeIdx = headers.findIndex((h) => /^(place_id|google_place_id)$/.test(h));

    const leads: RawDiscoveredLead[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const name = nameIdx >= 0 ? parts[nameIdx] : parts[0];
      if (!name) continue;

      leads.push({
        name,
        phone: phoneIdx >= 0 ? parts[phoneIdx] : null,
        city: cityIdx >= 0 ? parts[cityIdx] : null,
        state: stateIdx >= 0 ? parts[stateIdx] : null,
        address: addressIdx >= 0 ? parts[addressIdx] : null,
        email: emailIdx >= 0 ? parts[emailIdx] : null,
        website: siteIdx >= 0 ? parts[siteIdx] : null,
        instagram: instaIdx >= 0 ? parts[instaIdx] : null,
        google_place_id: placeIdx >= 0 ? parts[placeIdx] : null,
        source: 'csv',
        rawPayload: { row: i, originalLine: line },
      });
    }

    return leads;
  }
}
