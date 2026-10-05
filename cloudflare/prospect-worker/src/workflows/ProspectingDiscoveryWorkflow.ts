import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import type { ProspectingEnv } from '../types.js';
import type { RawDiscoveredLead } from '../providers/types.js';
import { CrmService } from '../services/crm/crmService.js';
import { getProspectProvider } from '../providers/providerRegistry.js';
import { checkLeadDuplicate } from '../deduplication/leadDeduplicator.js';

export interface DiscoveryWorkflowParams {
  providerCode?: string;
  city?: string;
  state?: string;
  limit?: number;
}

export interface DiscoveryConfig {
  providerCode: string;
  city: string;
  state: string;
  limit: number;
}

export interface DuplicationFilterResult {
  newLeads: RawDiscoveredLead[];
  duplicatesCount: number;
}

export class ProspectingDiscoveryWorkflow extends WorkflowEntrypoint<ProspectingEnv, DiscoveryWorkflowParams> {
  async run(event: WorkflowEvent<DiscoveryWorkflowParams>, step: WorkflowStep) {
    const crm = new CrmService(this.env);
    const providerCode = event.payload?.providerCode || 'existing_axecloud_database';
    const city = event.payload?.city || '';
    const state = event.payload?.state || '';
    const limit = event.payload?.limit || 50;

    // 1. Escolher regiões e parâmetros
    const config = await step.do<DiscoveryConfig>('resolve-regions-and-provider', async () => {
      console.log(`[DiscoveryWorkflow] Iniciando para provider: ${providerCode}, cidade: ${city || 'todas'}`);
      return { providerCode, city, state, limit };
    });

    // 2. Consultar provider configurado e identificar terreiros
    const rawLeads = await step.do<RawDiscoveredLead[]>('fetch-candidate-leads', { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' } }, async () => {
      const provider = getProspectProvider(config.providerCode);
      if (!provider) {
        throw new Error(`Provider não encontrado para o código: ${config.providerCode}`);
      }
      return await provider.fetchLeads(
        { city: config.city, state: config.state, limit: config.limit },
        this.env,
      );
    });

    // 3. Verificar duplicidade contra o banco existente
    const filteredResults = await step.do<DuplicationFilterResult>('check-duplication', async () => {
      const existingList = await crm.listAllCandidatesForDedup();
      const newLeads: RawDiscoveredLead[] = [];
      const duplicates = [];

      for (const raw of rawLeads) {
        const dupResult = checkLeadDuplicate(raw, existingList);
        if (dupResult.isDuplicate) {
          duplicates.push({ name: raw.name, reason: dupResult.matchReason, matchedId: dupResult.matchedLeadId });
        } else {
          newLeads.push(raw);
          // Adiciona em memória para evitar duplicatas dentro do mesmo lote
          existingList.push({
            name: raw.name,
            city: raw.city,
            address: raw.address,
            phone: raw.phone,
            google_place_id: raw.google_place_id,
            directory_id: raw.directory_id,
          });
        }
      }

      console.log(`[DiscoveryWorkflow] Candidatos: ${rawLeads.length}, Novos: ${newLeads.length}, Duplicados: ${duplicates.length}`);
      return { newLeads, duplicatesCount: duplicates.length };
    });

    // 4. Cadastrar novos leads no CRM via lote atômico com ignore-duplicates
    const createdLeadIds = await step.do<string[]>('persist-new-leads', async () => {
      if (!filteredResults.newLeads.length) return [];
      const leadsToCreate = filteredResults.newLeads.map((item) => {
        const hasPhone = Boolean(item.phone);
        const hasInsta = Boolean(item.instagram);
        const hasAddress = Boolean(item.address);
        let score = 20;
        if (hasPhone) score += 35;
        if (hasInsta) score += 25;
        if (hasAddress) score += 10;
        const isQualified = score >= 50;

        return {
          name: item.name,
          city: item.city,
          state: item.state,
          address: item.address,
          phone: item.phone,
          email: item.email,
          website: item.website,
          instagram: item.instagram,
          google_place_id: item.google_place_id,
          directory_id: item.directory_id,
          terreiro_id: item.terreiro_id,
          source: item.source,
          score,
          status: (isQualified ? 'qualified' : 'discovered') as any,
        };
      });

      const createdLeads = await crm.createLeadsBatch(leadsToCreate);
      return createdLeads.map((l) => l.id).filter(Boolean);
    });

    // 5. Enviar IDs para Queue de enriquecimento e análise
    await step.do<{ dispatched: number }>('dispatch-to-enrichment-queue', async () => {
      let dispatched = 0;
      if (this.env.ENRICHMENT_QUEUE && createdLeadIds.length > 0) {
        for (const leadId of createdLeadIds) {
          try {
            await this.env.ENRICHMENT_QUEUE.send({
              leadId,
              source: config.providerCode,
              timestamp: Date.now(),
            });
            dispatched++;
          } catch (qErr) {
            console.warn(`[DiscoveryWorkflow] Falha ao enfileirar lead ${leadId}:`, qErr);
          }
        }
      }
      return { dispatched };
    });

    // 6. Registrar métricas e finalizar execução
    return await step.do('finalize-execution', async () => {
      console.log(`[DiscoveryWorkflow] Finalizado com sucesso. Novos leads criados: ${createdLeadIds.length}`);
      await crm.updateSourceDiscoveryTime(config.providerCode, createdLeadIds.length);
      return {
        success: true,
        provider: config.providerCode,
        totalFetched: rawLeads.length,
        createdCount: createdLeadIds.length,
        duplicatesCount: filteredResults.duplicatesCount,
      };
    });
  }
}

export interface DiscoveryQueryPayload {
  providerCode?: string;
  city?: string;
  state?: string;
  limit?: number;
}

export interface WorkflowStepRunner {
  do<T>(name: string, callbackOrConfig: any, callback?: () => Promise<T>): Promise<T>;
}
