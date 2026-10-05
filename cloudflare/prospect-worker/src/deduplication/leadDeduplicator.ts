/**
 * Mecanismo de Deduplicação Inteligente de Terreiros e Leads
 * Critérios:
 * 1. google_place_id
 * 2. telefone normalizado (E.164)
 * 3. domínio/site
 * 4. instagram handle
 * 5. nome + cidade + endereço normalizados
 */

import type { ProspectingLead } from '../types.js';

export function normalizePhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }
  return digits.length >= 12 && digits.length <= 13 ? digits : digits;
}

export function extractDomain(url?: string | null): string {
  if (!url) return '';
  const trimmed = String(url).trim().toLowerCase();
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    let host = parsed.hostname.replace(/^www\./, '');
    // Ignora domínios genéricos de redes sociais para a chave de domínio
    if (/^(instagram\.com|facebook\.com|fb\.com|wa\.me|api\.whatsapp\.com|linktr\.ee|tiktok\.com|youtube\.com)$/.test(host)) {
      return '';
    }
    return host;
  } catch {
    return '';
  }
}

export function normalizeInstagram(raw?: string | null): string {
  if (!raw) return '';
  let text = String(raw).trim().toLowerCase();
  text = text.replace(/^https?:\/\/(?:www\.)?instagram\.com\//, '');
  text = text.replace(/^[/?#].*$/, '');
  text = text.replace(/^@/, '');
  text = text.split('/')[0].split('?')[0].trim();
  return text;
}

export function normalizeText(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // mantém só alfanumérico e espaços
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCompositeKey(name: string, city?: string | null, address?: string | null): string {
  const normName = normalizeText(name);
  const normCity = normalizeText(city);
  const normAddress = normalizeText(address);
  return `${normName}|${normCity}|${normAddress}`;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchReason?: 'directory_id' | 'google_place_id' | 'phone' | 'website' | 'instagram' | 'composite_address';
  matchedLeadId?: string;
  matchedName?: string;
}

export interface CandidateLeadInput {
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  google_place_id?: string | null;
  directory_id?: string | null;
}

export function checkLeadDuplicate(
  candidate: CandidateLeadInput,
  existingList: Array<Partial<ProspectingLead>>,
): DuplicateCheckResult {
  const candDirId = (candidate.directory_id || '').trim();
  const candPlaceId = (candidate.google_place_id || '').trim();
  const candPhone = normalizePhone(candidate.phone);
  const candDomain = extractDomain(candidate.website);
  const candInsta = normalizeInstagram(candidate.instagram);
  const candComposite = buildCompositeKey(candidate.name, candidate.city, candidate.address);
  const candNameCity = `${normalizeText(candidate.name)}|${normalizeText(candidate.city)}`;

  for (const existing of existingList) {
    const existingId = existing.id || '';
    const existingName = existing.name || '';

    // 0. directory_id (identificador unívoco do terreiro no catálogo do AxéCloud)
    if (candDirId && existing.directory_id && String(existing.directory_id).trim() === candDirId) {
      return {
        isDuplicate: true,
        matchReason: 'directory_id',
        matchedLeadId: existingId,
        matchedName: existingName,
      };
    }

    // 1. google_place_id (identificador exato Google Maps)
    if (candPlaceId && existing.google_place_id && existing.google_place_id.trim() === candPlaceId) {
      return {
        isDuplicate: true,
        matchReason: 'google_place_id',
        matchedLeadId: existingId,
        matchedName: existingName,
      };
    }

    // 2. Telefone normalizado
    if (candPhone && candPhone.length >= 10) {
      const existPhone = normalizePhone(existing.phone_normalized || existing.phone);
      if (existPhone && existPhone === candPhone) {
        return {
          isDuplicate: true,
          matchReason: 'phone',
          matchedLeadId: existingId,
          matchedName: existingName,
        };
      }
    }

    // 3. Domínio/site próprio
    if (candDomain) {
      const existDomain = extractDomain(existing.website);
      if (existDomain && existDomain === candDomain) {
        return {
          isDuplicate: true,
          matchReason: 'website',
          matchedLeadId: existingId,
          matchedName: existingName,
        };
      }
    }

    // 4. Instagram
    if (candInsta) {
      const existInsta = normalizeInstagram(existing.instagram);
      if (existInsta && existInsta === candInsta) {
        return {
          isDuplicate: true,
          matchReason: 'instagram',
          matchedLeadId: existingId,
          matchedName: existingName,
        };
      }
    }

    // 5. Nome + Cidade (com ou sem endereço)
    if (existing.name && candidate.name) {
      const existComposite = buildCompositeKey(existing.name, existing.city, existing.address);
      if (candComposite && candComposite === existComposite) {
        return {
          isDuplicate: true,
          matchReason: 'composite_address',
          matchedLeadId: existingId,
          matchedName: existingName,
        };
      }

      // Mesmo nome normalizado e mesma cidade
      const existNameCity = `${normalizeText(existing.name)}|${normalizeText(existing.city)}`;
      if (candNameCity.length >= 8 && candNameCity === existNameCity) {
        return {
          isDuplicate: true,
          matchReason: 'composite_address',
          matchedLeadId: existingId,
          matchedName: existingName,
        };
      }
    }
  }

  return { isDuplicate: false };
}
