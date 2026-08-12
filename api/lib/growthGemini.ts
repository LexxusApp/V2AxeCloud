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

export function isCompleteSalesReply(text: string): boolean {
  const value = String(text || "").trim();
  if (value.length < 20) return false;
  if (/[.!?…][\])'\"]?$/.test(value)) return true;
  return /https?:\/\/\S+$/.test(value);
}

export function completeSalesReplyPrefix(text: string): string | null {
  const value = String(text || "").trim();
  const matches = [...value.matchAll(/[.!?…](?=\s|$)/g)];
  const last = matches.at(-1);
  if (!last || last.index === undefined) return null;
  const prefix = value.slice(0, last.index + last[0].length).trim();
  return prefix.length >= 40 ? prefix : null;
}

function cleanSalesReply(text: string): string {
  return String(text || "")
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
    .slice(0, 1000);
}

export function salesGreetingInstruction(history: Array<{ direction: string; body: string }>): string {
  const alreadyReplied = history.some((message) => message.direction !== "inbound");
  if (alreadyReplied) {
    return "A conversa já começou: não repita 'Axé', olá, bom dia ou outra saudação. Continue diretamente do assunto.";
  }
  return "Esta é a primeira resposta: uma única saudação curta com 'Axé' é opcional, sem usar o nome automático do perfil.";
}

export function fallbackSalesReply(input: {
  history: Array<{ direction: string; body: string }>;
  monthlyPriceLabel: string;
  registrationUrl: string;
}): string {
  const latestInbound = [...input.history].reverse().find((message) => message.direction === "inbound")?.body || "";
  const value = latestInbound.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/teste|testar|cadastro|como faco|comecar|iniciar/.test(value)) {
    return `Você pode iniciar agora o teste gratuito de 30 dias, sem cartão: ${input.registrationUrl}. Se tiver alguma dificuldade no cadastro, me avise por aqui.`;
  }
  if (/preco|valor|plano|mensalidade/.test(value)) {
    return `O teste é gratuito por 30 dias, sem cartão. Depois, o plano Premium custa ${input.monthlyPriceLabel} por mês. Quer que eu envie o link para começar o teste?`;
  }
  if (/financeiro|pix|mensalidade|recebimento/.test(value)) {
    return "O AxéCloud centraliza mensalidades e recebimentos via Pix para facilitar o acompanhamento do que foi pago e do que está pendente. Quer conhecer o teste gratuito?";
  }
  return "O AxéCloud organiza membros, giras, financeiro, mensalidades, comunicados e outras rotinas da casa em um só lugar. Qual parte você gostaria de conhecer primeiro?";
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
- ${salesGreetingInstruction(input.history)}
- Nunca use o nome recebido automaticamente do perfil do WhatsApp. Só use um nome se a própria pessoa se apresentar no texto da conversa.
- Se pedirem para parar, não responda com venda.
- Se houver dúvida religiosa, jurídica, negociação especial, reclamação séria ou algo que não saiba, diga que vai chamar o Lucas.
- Se houver interesse em testar, envie o link de cadastro.
- Não use markdown complexo e não diga que é humano.

Terreiro: ${input.terreiroNome}
A pessoa ainda não informou como prefere ser chamada.
Conversa:
${history}

Escreva apenas a próxima mensagem do AxéCloud.`;
  let firstText = "";
  try {
    const payload = await generateContent(prompt, false);
    firstText = cleanSalesReply(responseText(payload));
    if (isCompleteSalesReply(firstText)) return firstText;

    const retryPrompt = `${prompt}\n\nA resposta anterior foi interrompida: ${JSON.stringify(firstText)}\nEscreva novamente do zero. Termine a mensagem com uma frase ou pergunta completa.`;
    const retryPayload = await generateContent(retryPrompt, false);
    const retryText = cleanSalesReply(responseText(retryPayload));
    if (isCompleteSalesReply(retryText)) return retryText;

    const completeText = completeSalesReplyPrefix(retryText) || completeSalesReplyPrefix(firstText);
    if (completeText) return completeText;
  } catch (error) {
    console.warn("[GROWTH AI] usando resposta comercial de contingência:", error instanceof Error ? error.message : error);
  }
  return fallbackSalesReply(input);
}
