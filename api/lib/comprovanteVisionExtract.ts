import { GoogleGenerativeAI } from "@google/generative-ai";

export type ComprovanteExtracted = {
  valor: number;
  data: string;
  cpf_pagador: string;
};

const VISION_PROMPT =
  'Analise este comprovante de pagamento Pix/Bancário e extraia as seguintes informações em formato JSON estrito: { valor: float, data: string, cpf_pagador: string }.';

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    null
  );
}

function getVisionModelName(): string {
  return process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.0-flash";
}

export function normalizeComprovanteMime(contentType: string | undefined): string {
  const ct = String(contentType || "image/jpeg")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return ALLOWED_MIME.has(ct) ? ct : "image/jpeg";
}

export function assertComprovanteImageBuffer(buffer: Buffer, contentType: string): void {
  if (!buffer.length) throw new Error("Imagem vazia.");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Imagem maior que 5 MB.");
  const ct = normalizeComprovanteMime(contentType);
  if (!ALLOWED_MIME.has(ct)) {
    throw new Error("Formato de imagem não suportado. Use JPEG, PNG ou WebP.");
  }
}

function parseVisionJson(text: string): ComprovanteExtracted | null {
  const trimmed = String(text || "").trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }

  const valorRaw = parsed.valor ?? parsed.amount ?? parsed.valor_pago;
  const valor = typeof valorRaw === "number" ? valorRaw : parseFloat(String(valorRaw ?? "").replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const data = String(parsed.data ?? parsed.date ?? "").trim();
  if (!data) return null;

  const cpf_pagador = String(parsed.cpf_pagador ?? parsed.cpf ?? "").trim();
  if (!cpf_pagador) return null;

  return { valor, data, cpf_pagador };
}

export async function extractComprovanteFieldsFromImage(
  buffer: Buffer,
  contentType: string
): Promise<ComprovanteExtracted> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Serviço de leitura de comprovante indisponível.");
  }

  assertComprovanteImageBuffer(buffer, contentType);
  const mimeType = normalizeComprovanteMime(contentType);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getVisionModelName(),
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType, data: buffer.toString("base64") } },
    { text: VISION_PROMPT },
  ]);

  const text = result.response.text();
  const extracted = parseVisionJson(text);
  if (!extracted) {
    throw new Error("Não foi possível extrair dados do comprovante.");
  }
  return extracted;
}

export function normalizeCpfDigits(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

export function valoresMensalidadeCoincidem(expected: number, extracted: number): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(extracted)) return false;
  return Math.abs(expected - extracted) < 0.02;
}
