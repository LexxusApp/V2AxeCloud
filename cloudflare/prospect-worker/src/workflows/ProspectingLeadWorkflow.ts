import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import type { ProspectingEnv, ProspectingLead } from '../types.js';
import { CrmService } from '../services/crm/crmService.js';
import { LeadAnalyzer } from '../services/ai/leadAnalyzer.js';

export interface LeadWorkflowParams {
  leadId: string;
  forceReanalyze?: boolean;
}

export class ProspectingLeadWorkflow extends WorkflowEntrypoint<ProspectingEnv, LeadWorkflowParams> {
  async run(event: WorkflowEvent<LeadWorkflowParams>, step: WorkflowStep) {
    const leadId = event.payload?.leadId;
    if (!leadId) {
      throw new Error('[ProspectingLeadWorkflow] leadId não informado.');
    }

    const crm = new CrmService(this.env);

    // 1. Etapa de Enriquecimento (discovered -> enriching)
    await step.do<ProspectingLead | null>('enrich-lead', async () => {
      const current = await crm.getLeadById(leadId);
      if (!current) throw new Error(`Lead ${leadId} não encontrado.`);

      // Se já passou da fase de enriquecimento, não reexecuta
      if (['analyzed', 'qualified', 'waiting_contact', 'contacted', 'replied', 'interested', 'trial', 'customer'].includes(current.status)) {
        console.log(`[LeadWorkflow] Lead ${leadId} já enriquecido/analisado (status=${current.status}), prosseguindo.`);
        return current;
      }

      await crm.updateLead(leadId, {
        status: 'enriching',
      });

      await crm.recordEvent({
        lead_id: leadId,
        event_type: 'lead_enriching_started',
        description: 'Ciclo individual de enriquecimento e validação iniciado.',
      });

      return await crm.getLeadById(leadId);
    });

    // 2. Etapa de Análise de IA (enriching -> analyzed)
    await step.do<{ score: number; skipped: boolean }>('analyze-with-ai', { retries: { limit: 2, delay: '3 seconds' } }, async () => {
      const current = await crm.getLeadById(leadId);
      if (!current) throw new Error(`Lead ${leadId} não encontrado.`);

      // Se já foi analisado e não está forçando reanálise, aproveita resultado
      if (!event.payload.forceReanalyze && ['analyzed', 'qualified', 'waiting_contact', 'contacted', 'replied', 'interested', 'trial', 'customer'].includes(current.status)) {
        console.log(`[LeadWorkflow] Lead ${leadId} já possui análise de IA válida.`);
        return { score: current.score, skipped: true };
      }

      const analyzer = new LeadAnalyzer(this.env);
      const analysis = await analyzer.analyze(current);

      await crm.recordAiAnalysis({
        lead_id: leadId,
        score: analysis.score,
        confidence: analysis.confidence,
        summary: analysis.summary,
        business_signals: analysis.businessSignals,
        possible_needs: analysis.possibleNeeds,
        digital_presence: analysis.digitalPresence,
        recommended_next_action: analysis.recommendedNextAction,
        raw_response: analysis as unknown as Record<string, unknown>,
      });

      return { score: analysis.score, skipped: false };
    });

    // 3. Etapa de Qualificação (analyzed -> qualified)
    return await step.do('evaluate-qualification', async () => {
      const current = await crm.getLeadById(leadId);
      if (!current) throw new Error(`Lead ${leadId} não encontrado.`);

      const isQualified = current.score >= 50;
      const targetStatus = isQualified ? 'qualified' : 'analyzed';

      if (current.status !== targetStatus && current.status !== 'qualified') {
        await crm.updateLead(leadId, {
          status: targetStatus,
          next_action_at: isQualified ? new Date(Date.now() + 86400000).toISOString() : null,
        });

        await crm.recordEvent({
          lead_id: leadId,
          event_type: isQualified ? 'lead_qualified' : 'lead_analyzed_not_qualified',
          to_status: targetStatus,
          description: isQualified
            ? `Lead qualificado automaticamente (score: ${current.score}/100)`
            : `Lead analisado sem pontuação suficiente para qualificação automática (score: ${current.score}/100)`,
        });
      }

      return {
        leadId,
        status: targetStatus,
        score: current.score,
        isQualified,
      };
    });
  }
}
