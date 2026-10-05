import type { IProspectSourceProvider } from './types.js';
import { ExistingAxeCloudDbProvider } from './ExistingAxeCloudDbProvider.js';
import { GooglePlacesProvider } from './GooglePlacesProvider.js';
import { CsvImportProvider } from './CsvImportProvider.js';
import { ManualLeadProvider } from './ManualLeadProvider.js';

const registry = new Map<string, IProspectSourceProvider>([
  ['existing_axecloud_database', new ExistingAxeCloudDbProvider()],
  ['google_places', new GooglePlacesProvider()],
  ['csv', new CsvImportProvider()],
  ['manual', new ManualLeadProvider()],
]);

export function getProspectProvider(code: string): IProspectSourceProvider | null {
  return registry.get(code) || null;
}

export function listAvailableProviders(): Array<{ code: string; name: string }> {
  return Array.from(registry.values()).map((p) => ({ code: p.code, name: p.name }));
}
