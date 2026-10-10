import type { ProspectingEnv } from '../../types.js';
import { AiGatewayClient } from '../ai/aiGatewayClient.js';
import { CrmService } from '../crm/crmService.js';

export interface LearnedPattern {
  id?: string;
  topic: string;
  pattern_type: string;
  lead_question_pattern: string;
  winning_response_example: string;
  outcome_score: number;
}

export interface AutonomousGuidelines {
  version: number;
  guidelines_text: string;
  summary?: string;
  conversations_analyzed: number;
  last_optimized_at: string;
}

export class AutonomousLearningService {
  private crm: CrmService;
  private ai: AiGatewayClient;
  private supabaseUrl: string;
  private serviceKey: string;

  constructor(private env: ProspectingEnv) {
    this.crm = new CrmService(env);
    this.ai = new AiGatewayClient(env);
    this.supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  /**
   * Obtém as diretrizes vivas e os exemplos vencedores para enriquecer o prompt da IA.
   */
  async getActiveLearnedContext(): Promise<{ guidelinesText: string; winningExamples: LearnedPattern[] }> {
    try {
      const [guidelinesRes, patternsRes] = await Promise.all([
        fetch(`${this.supabaseUrl}/rest/v1/prospecting_autonomous_guidelines?is_active=eq.true&order=version.desc&limit=1`, {
          headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` },
        }),
        fetch(`${this.supabaseUrl}/rest/v1/prospecting_learned_patterns?order=outcome_score.desc,times_used.desc&limit=4`, {
          headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` },
        }),
      ]);

      const guidelines = guidelinesRes.ok ? (await guidelinesRes.json())[0] : null;
      const patterns = patternsRes.ok ? (await patternsRes.json()) : [];

      const fallbackGuidelines =
        '1. Converse como um membro real e prestativo da equipe AxéCloud.\n' +
        '2. Mantenha as mensagens curtas (1 ou 2 parágrafos leves), sem listas nem tópicos.\n' +
        '3. Mostre entendimento prático da rotina de terreiro.\n' +
        '4. Não force "Axé" em toda frase e não seja agressivo na venda.';

      return {
        guidelinesText: guidelines?.guidelines_text || fallbackGuidelines,
        winningExamples: Array.isArray(patterns) ? patterns : [],
      };
    } catch (e) {
      console.warn('[AutonomousLearning] Falha ao carregar contexto de aprendizado:', e);
      return {
        guidelinesText:
          '1. Converse como um membro real e prestativo da equipe AxéCloud.\n' +
          '2. Mantenha as mensagens curtas (1 ou 2 parágrafos leves), sem listas nem tópicos.\n' +
          '3. Mostre entendimento prático da rotina de terreiro.\n' +
          '4. Não force "Axé" em toda frase e não seja agressivo na venda.',
        winningExamples: [],
      };
    }
  }

  /**
   * Registra um padrão vitorioso de pergunta/resposta quando a conversa tem sucesso.
   */
  async recordWinningPattern(pattern: Omit<LearnedPattern, 'id' | 'outcome_score'> & { score?: number }): Promise<void> {
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/prospecting_learned_patterns`, {
        method: 'POST',
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          topic: pattern.topic || 'geral',
          pattern_type: pattern.pattern_type || 'effective_response',
          lead_question_pattern: pattern.lead_question_pattern,
          winning_response_example: pattern.winning_response_example,
          outcome_score: pattern.score || 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn('[AutonomousLearning] Erro ao registrar padrão vitorioso:', err);
    }
  }

  /**
   * Ciclo autônomo de auto-crítica e aprimoramento contínuo:
   * Analisa as conversas reais acumuladas, detecta padrões de alta e baixa conversão,
   * e sintetiza uma nova versão evoluída das diretrizes de comunicação.
   */
  async runAutonomousSelfOptimization(): Promise<{ success: boolean; version?: number; summary?: string }> {
    try {
      // 1. Busca as últimas conversas com suas mensagens
      const convRes = await fetch(
        `${this.supabaseUrl}/rest/v1/admin_whatsapp_conversations?select=id,phone_e164,contact_name,status,created_at&order=last_message_at.desc&limit=15`,
        { headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` } },
      );
      if (!convRes.ok) return { success: false };
      const convs = (await convRes.json()) as Array<{ id: string; phone_e164: string; contact_name?: string }>;

      if (!convs.length) return { success: true, summary: 'Nenhuma conversa recente para análise.' };

      // Carrega mensagens das conversas recentes
      const conversationTranscripts: string[] = [];
      for (const c of convs.slice(0, 8)) {
        const msgRes = await fetch(
          `${this.supabaseUrl}/rest/v1/admin_whatsapp_messages?conversation_id=eq.${c.id}&order=created_at.asc&limit=10`,
          { headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` } },
        );
        if (msgRes.ok) {
          const msgs = (await msgRes.json()) as Array<{ direction: string; body: string }>;
          if (msgs.length >= 2) {
            const dialogue = msgs.map((m) => `${m.direction === 'inbound' ? 'Terreiro' : 'AxéCloud'}: ${m.body}`).join('\n');
            conversationTranscripts.push(`--- Conversa com ${c.contact_name || c.phone_e164} ---\n${dialogue}`);
          }
        }
      }

      if (!conversationTranscripts.length) {
        return { success: true, summary: 'Poucas mensagens para auto-otimização no momento.' };
      }

      // 2. IA auto-reflete sobre as conversas reais
      const prompt = `Você é o Diretor de Comunicação e Qualidade do AxéCloud (SaaS para Terreiros de Umbanda e Candomblé).
Sua missão é realizar uma auto-crítica analítica sobre conversas reais recentes de WhatsApp para que nosso atendente virtual pareça CADA VEZ MAIS uma pessoa de verdade, com empatia, naturalidade e zero tom de robô.

CONVERSAS REAIS ANALISADAS:
${conversationTranscripts.join('\n\n')}

TAREFA:
1. Avalie o que soou bem e gerou acolhimento.
2. Identifique o que soou artificial, longo demais, robótico ou precipitado.
3. Elabore um conjunto atualizado e refinado de 5 a 7 DIRETRIZES DE ESTILO PRÁTICAS para guiar o agente nas próximas conversas.
4. Extraia até 2 exemplos curtos de perguntas reais e a melhor forma humana de responder.

Responda ESTRITAMENTE em formato JSON:
{
  "summary": "Resumo executivo em 1 parágrafo do aprendizado deste ciclo",
  "guidelinesText": "Texto completo das 5 a 7 diretrizes numeradas",
  "extractedPatterns": [
    {
      "topic": "nome_do_tema",
      "leadQuestion": "pergunta típica que o terreiro fez",
      "winningResponse": "resposta ideal humanizada e natural"
    }
  ]
}`;

      const analysis = await this.ai.generateJson<{
        summary: string;
        guidelinesText: string;
        extractedPatterns?: Array<{ topic: string; leadQuestion: string; winningResponse: string }>;
      }>(prompt, {
        temperature: 0.6,
      });

      if (!analysis || !analysis.guidelinesText) {
        return { success: false };
      }

      // 3. Atualiza versão das diretrizes
      const lastGuidelineRes = await fetch(
        `${this.supabaseUrl}/rest/v1/prospecting_autonomous_guidelines?order=version.desc&limit=1`,
        { headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` } },
      );
      const lastGuideline = lastGuidelineRes.ok ? (await lastGuidelineRes.json())[0] : null;
      const nextVersion = (lastGuideline?.version || 1) + 1;

      // Desativa anteriores e insere nova
      await fetch(`${this.supabaseUrl}/rest/v1/prospecting_autonomous_guidelines?is_active=eq.true`, {
        method: 'PATCH',
        headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });

      await fetch(`${this.supabaseUrl}/rest/v1/prospecting_autonomous_guidelines`, {
        method: 'POST',
        headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: nextVersion,
          is_active: true,
          guidelines_text: analysis.guidelinesText,
          summary: analysis.summary,
          conversations_analyzed: conversationTranscripts.length,
          last_optimized_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }),
      });

      // Salva novos padrões identificados
      if (Array.isArray(analysis.extractedPatterns)) {
        for (const p of analysis.extractedPatterns) {
          if (p.leadQuestion && p.winningResponse) {
            await this.recordWinningPattern({
              topic: p.topic || 'geral',
              pattern_type: 'effective_response',
              lead_question_pattern: p.leadQuestion,
              winning_response_example: p.winningResponse,
              score: 15,
            });
          }
        }
      }

      console.log(`[AutonomousLearning] Auto-otimização concluída! Versão ${nextVersion} gerada: ${analysis.summary}`);
      return { success: true, version: nextVersion, summary: analysis.summary };
    } catch (err: any) {
      console.error('[AutonomousLearning] Falha no ciclo de auto-otimização:', err);
      return { success: false, summary: err.message };
    }
  }
}
