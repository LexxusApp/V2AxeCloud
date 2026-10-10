/**
 * Detector de mensagens automáticas de WhatsApp Business (mensagens de ausência,
 * saudações automáticas e respostas programadas de empresas/terreiros).
 */
const AUTO_RESPONDER_PATTERNS = [
  // Agradecimento pelo contato ou mensagem (singular ou plural)
  /agradece(mos)?\s+(o\s+|a\s+|seu\s+|o\s+seu\s+|sua\s+|pelo\s+|pela\s+)?(contato|mensagem)/i,
  /obrigad[oa]\s+(por\s+entrar\s+em\s+contato|pelo\s+contato|por\s+nos\s+contatar|pela\s+mensagem|pela\s+sua\s+mensagem|por\s+sua\s+mensagem)/i,

  // Recebimento, confirmação e ausência
  /sua\s+mensagem\s+foi\s+recebida/i,
  /recebemos\s+(a\s+|sua\s+)?mensagem/i,
  /(em\s+breve|assim\s+que\s+poss[íi]vel|logo)\s+(retornaremos|entraremos\s+em\s+contato|responderemos|daremos\s+retorno)/i,
  /n[ãa]o\s+estamos\s+dispon[íi]veis/i,
  /no\s+momento\s+estamos\s+ausentes/i,
  /estamos\s+ausentes/i,
  /n[ãa]o\s+podemos\s+atender\s+no\s+momento/i,
  /fora\s+do\s+hor[áa]rio/i,
  /hor[áa]rio\s+de\s+atendimento\s*:/i,
  /deixe\s+(sua\s+mensagem|seu\s+recado)/i,

  // Saudações automáticas programadas de WhatsApp Business e templos
  /como\s+podemos\s+(te\s+|lhe\s+)?ajudar\??/i,
  /no\s+que\s+poss[oe]\s+(te\s+|lhe\s+)?(ajudar|auxiliar)\s+hoje\??/i,
  /em\s+sua\s+caminhada\s+espiritual/i,
  /seja\s+bem-vind[oa].*(caminhada\s+espiritual|como\s+podemos\s+ajudar|no\s+que\s+posso|em\s+breve|ausentes)/i,

  // Mensagens automáticas declaradas
  /esta\s+[ée]\s+uma\s+mensagem\s+autom[áa]tica/i,
  /resposta\s+autom[áa]tica/i,
  /mensagem\s+autom[áa]tica/i,
  /mensagem\s+programada/i,
  /atendimento\s+autom[áa]tico/i,
];

export function isAutoResponderMessage(message: string): boolean {
  const norm = String(message || '').trim();
  if (!norm) return false;
  return AUTO_RESPONDER_PATTERNS.some((pattern) => pattern.test(norm));
}
