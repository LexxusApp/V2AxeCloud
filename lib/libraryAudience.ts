import { libraryStoragePath } from './libraryStoragePath.js';
export type LibraryAudience = { visibilidade?: string | null; destinatarios?: string[] | null };
export type LibraryReader = { manager: boolean; memberId: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLibraryAudience(input: { visibilidade?: unknown; destinatarios?: unknown }): Required<LibraryAudience> {
  const visibility = input.visibilidade === undefined ? 'casa' : input.visibilidade;
  if (visibility !== 'casa' && visibility !== 'individual') throw Error('Escolha o público do material.');
  if (visibility === 'casa') return { visibilidade: 'casa', destinatarios: [] };
  if (!Array.isArray(input.destinatarios) || !input.destinatarios.length || input.destinatarios.length > 500) throw Error('Selecione ao menos um filho para o acervo privado.');
  const recipients = [...new Set(input.destinatarios.map(value => String(value).toLowerCase()))];
  if (recipients.some(id => !UUID.test(id))) throw Error('Destinatário inválido.');
  return { visibilidade: 'individual', destinatarios: recipients };
}

/** Tenant authorization is mandatory before this per-material check. Unknown scopes fail closed. */
export function canReadLibraryMaterial(material: LibraryAudience, reader: LibraryReader): boolean {
  if (reader.manager) return true;
  if (material.visibilidade == null || material.visibilidade === 'casa') return true; // legacy shared material
  return material.visibilidade === 'individual' && Boolean(reader.memberId) && Array.isArray(material.destinatarios) && material.destinatarios.includes(reader.memberId!);
}

/** Storage-backed PDFs must be opened through the authorized proxy, never a reusable signed link. */
export function libraryMaterialResponse<T extends LibraryAudience & { storage_path?: string | null; arquivo_url?: string | null }>(material: T, reader: LibraryReader): T {
  const path = material.storage_path || libraryStoragePath(material.arquivo_url || '');
  const result = { ...material, ...(path ? { storage_path: path, arquivo_url: '' } : {}) };
  if (!reader.manager) delete result.destinatarios;
  return result;
}
