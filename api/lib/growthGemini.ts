type GroundedContact = {
  email: string | null;
  websiteUrl: string | null;
  contactFormUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  sources: string[];
};

function apiKey(): string {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
}

function modelName(): string {
  return String(process.env.GROWTH_GEMINI_MODEL || "gemini-2.5-flash").trim();
}

function firstJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeHttpUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeEmail(value: unknown): string | null {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 200) : null;
}

async function generateContent(prompt: string, useSearch: boolean): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error("GEMINI_API_KEY não configurada para o agente comercial.");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName())}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: useSearch ? 0.1 : 0.35, maxOutputTokens: useSearch ? 1200 : 500 },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(payload?.error?.message || `Gemini HTTP ${response.status}`);
    throw new Error(message);
  }
  return payload;
}

function responseText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((part) => String(part?.text || "")).join("\n").trim() : "";
}

export async function researchPublicContact(input: {
  nome: string;
  cidade: string;
  endereco?: string | null;
  mapsUrl?: string | null;
}): Promise<GroundedContact> {
  const prompt = [
    "Pesquise os canais oficiais públicos desta organização religiosa brasileira.",
    `Nome: ${input.nome}`,
    `Cidade: ${input.cidade}`,
    input.endereco ? `Endereço público: ${input.endereco}` : null,
    input.mapsUrl ? `Google Maps: ${input.mapsUrl}` : null,
    "Localize somente informações comerciais/publicadas pela própria organização: e-mail, site, formulário de contato, Instagram e Facebook.",
    "Não deduza e não invente. Não retorne dados pessoais encontrados em listas de terceiros.",
    'Responda apenas JSON: {"email":null,"websiteUrl":null,"contactFormUrl":null,"instagramUrl":null,"facebookUrl":null}.',
  ].filter(Boolean).join("\n");
  const payload = await generateContent(prompt, true);
  const parsed = firstJsonObject(responseText(payload)) || {};
  const chunks = payload?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const groundedSources = Array.isArray(chunks)
    ? chunks.map((chunk: any) => safeHttpUrl(chunk?.web?.uri)).filter(Boolean)
    : [];
  return {
    email: safeEmail(parsed.email),
    websiteUrl: safeHttpUrl(parsed.websiteUrl),
    contactFormUrl: safeHttpUrl(parsed.contactFormUrl),
    instagramUrl: safeHttpUrl(parsed.instagramUrl),
    facebookUrl: safeHttpUrl(parsed.facebookUrl),
    sources: [...new Set(groundedSources as string[])].slice(0, 12),
  };
}

export async function generateSalesReply(input: {
  terreiroNome: string;
  contactName?: string | null;
  history: Array<{ direction: string; body: string }>;
  monthlyPriceLabel: string;
  registrationUrl: string;
}): Promise<string> {
  const history = input.history.slice(-16).map((m) => `${m.direction === "inbound" ? "Zelador" : "AxéCloud"}: ${m.body}`).join("\n");
  const prompt = `Você é o assistente comercial oficial do AxéCloud e conversa em português do Brasil com respeito às tradições de matriz africana.

Objetivo: entender a necessidade da casa, explicar o produto e ajudar o zelador a iniciar o teste. Nunca pressione, nunca invente recursos e nunca afirme que o contrato foi fechado sem confirmação explícita.

Dados corretos do produto:
- Sistema de gestão para terreiros de Umbanda, Candomblé e Jurema.
- Recursos: cadastro de membros, calendário de giras, financeiro/Pix/mensalidades, comunicados por WhatsApp, galeria, obrigações e portal do membro.
- Teste gratuito de 30 dias, sem cartão.
- Plano Premium atual: ${input.monthlyPriceLabel} por mês.
- Cadastro: ${input.registrationUrl}

Regras:
- Responda somente à última mensagem, em no máximo 500 caracteres.
- Faça no máximo uma pergunta por mensagem.
- Se pedirem para parar, não responda com venda.
- Se houver dúvida religiosa, jurídica, negociação especial, reclamação séria ou algo que não saiba, diga que vai chamar o Lucas.
- Se houver interesse em testar, envie o link de cadastro.
- Não use markdown complexo e não diga que é humano.

Terreiro: ${input.terreiroNome}
Contato: ${input.contactName || "zelador(a)"}
Conversa:
${history}

Escreva apenas a próxima mensagem do AxéCloud.`;
  const payload = await generateContent(prompt, false);
  const text = responseText(payload).replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!text) throw new Error("A IA não gerou resposta comercial.");
  return text.slice(0, 1000);
}
