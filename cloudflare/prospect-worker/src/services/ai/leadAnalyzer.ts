import type { ProspectingEnv, ProspectingLead, ProspectAiAnalysisResult } from '../../types.js';
import { AiGatewayClient } from './aiGatewayClient.js';

export class LeadAnalyzer {
  private client: AiGatewayClient;

  constructor(private env: ProspectingEnv) {
    this.client = new AiGatewayClient(env);
  }

  async analyze(lead: ProspectingLead): Promise<ProspectAiAnalysisResult> {
    const systemPrompt = `Você é um analista operacional e comercial sênior do AxéCloud (software de gestão administrativa para terreiros, centros e casas de axé).
Sua missão é analisar dados públicos de um terreiro/organização e identificar a maturidade operacional e potencial de adoção do software.

REGRA ABSOLUTA E INEGOCIÁVEL:
- O score comercial NUNCA pode ser baseado em vertente religiosa, tamanho espiritual, doutrina, tradição, nação ou qualquer julgamento religioso ou litúrgico. Todos os cultos e casas têm igual respeito e valor.
- Avalie EXCLUSIVAMENTE sinais operacionais, logísticos e comerciais verificáveis:
  1. Presença Digital: existência de site próprio, perfil ativo no Instagram, página no Google Maps.
  2. Formas Públicas de Contato: telefone celular, WhatsApp direto, e-mail de contato, endereço físico público.
  3. Gestão e Agenda de Eventos: se realizam giras/festas/sessões com público (necessidade de controle de senhas de consulentes, frequência de médiuns, calendário).
  4. Organização Interna: potencial para controle financeiro (mensalidades, caixa), cadastro de filhos de santo e controle de estoque de velas/ervas.
  5. Fit com o AxéCloud: terreiros com médiuns e consulentes se beneficiam muito das automações via WhatsApp e relatórios.

Você DEVE responder ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "score": número de 0 a 100 indicando a aderência/maturidade operacional para o AxéCloud,
  "summary": "resumo claro de 2 a 3 frases sobre a presença pública e contexto operacional do terreiro",
  "businessSignals": ["lista", "de", "sinais", "operacionais", "identificados"],
  "possibleNeeds": ["necessidades prováveis", "ex: controle de senhas para consulentes", "gestão de mensalidades dos médiuns"],
  "digitalPresence": {
    "hasWebsite": boolean,
    "hasInstagram": boolean,
    "hasPhone": boolean,
    "hasAddress": boolean,
    "details": "comentário sobre a presença online"
  },
  "recommendedNextAction": "ação sugerida para a equipe comercial (ex: aguardar opt-in, convidar para demonstração se houver contato)",
  "confidence": número de 0.0 a 1.0 indicando a precisão baseada nos dados disponíveis
}`;

    const userPrompt = `Analise os dados deste terreiro para o AxéCloud:
Nome: ${lead.name}
Cidade: ${lead.city || 'Não informada'}
Estado: ${lead.state || 'Não informado'}
Endereço: ${lead.address || 'Não informado'}
Telefone: ${lead.phone || 'Não informado'}
E-mail: ${lead.email || 'Não informado'}
Website: ${lead.website || 'Não informado'}
Instagram: ${lead.instagram || 'Não informado'}
Place ID Google: ${lead.google_place_id || 'Não informado'}
Fonte do Lead: ${lead.source}
Status Atual: ${lead.status}

Retorne exclusivamente o JSON estruturado.`;

    try {
      const result = await this.client.generateJson<ProspectAiAnalysisResult>(userPrompt, {
        systemPrompt,
        temperature: 0.15,
      });

      // Sanitização e validações rígidas de limites
      return {
        score: Math.max(0, Math.min(100, Math.round(Number(result.score) || 0))),
        summary: String(result.summary || 'Análise concluída com base nas informações públicas.').trim(),
        businessSignals: Array.isArray(result.businessSignals) ? result.businessSignals.map(String) : [],
        possibleNeeds: Array.isArray(result.possibleNeeds) ? result.possibleNeeds.map(String) : [],
        digitalPresence: result.digitalPresence && typeof result.digitalPresence === 'object' ? result.digitalPresence : {},
        recommendedNextAction: String(result.recommendedNextAction || 'Aguardar contato inbound com consentimento.').trim(),
        confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.7)),
      };
    } catch (error) {
      console.warn('[LeadAnalyzer] Fallback determinístico devido a erro na IA:', error);
      // Fallback determinístico seguro caso a API de IA esteja offline
      const hasPhone = Boolean(lead.phone);
      const hasInsta = Boolean(lead.instagram);
      const hasSite = Boolean(lead.website);
      let calculatedScore = 20;
      if (hasPhone) calculatedScore += 35;
      if (hasInsta) calculatedScore += 25;
      if (hasSite) calculatedScore += 20;

      return {
        score: calculatedScore,
        summary: `Terreiro ${lead.name} em ${lead.city || 'SP'}. Possui ${[hasPhone && 'telefone', hasInsta && 'Instagram', hasSite && 'site'].filter(Boolean).join(', ') || 'dados públicos básicos'}.`,
        businessSignals: [
          hasPhone ? 'Possui telefone para contato' : 'Sem telefone direto',
          hasInsta ? 'Presença ativa no Instagram' : 'Sem Instagram cadastrado',
          lead.address ? 'Endereço físico identificado' : 'Sem endereço público',
        ],
        possibleNeeds: [
          'Gestão de filhos e médiuns da corrente',
          'Controle de presença em giras e calendário',
          'Controle de mensalidades e caixa do terreiro',
        ],
        digitalPresence: {
          hasWebsite: hasSite,
          hasInstagram: hasInsta,
          hasPhone,
          hasAddress: Boolean(lead.address),
          details: 'Presença calculada via metadados locais de fallback.',
        },
        recommendedNextAction: hasPhone ? 'Verificar opt-in para envio de convite comercial' : 'Pesquisar canais públicos de contato',
        confidence: 0.6,
      };
    }
  }
}
