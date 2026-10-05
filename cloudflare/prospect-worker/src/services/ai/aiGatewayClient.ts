import type { ProspectingEnv } from '../../types.js';

export interface AiGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseSchema?: Record<string, unknown>;
}

export class AiGatewayClient {
  constructor(private env: ProspectingEnv) {}

  async generate(prompt: string, options: AiGenerationOptions = {}): Promise<string> {
    const apiKey = String(this.env.GEMINI_API_KEY || '').trim();
    const gatewayUrl = String(this.env.CLOUDFLARE_AI_GATEWAY_URL || '').trim();

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no ambiente Cloudflare.');
    }

    // Se houver Cloudflare AI Gateway configurado, usa a URL do gateway como proxy
    let endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
    if (gatewayUrl) {
      endpoint = `${gatewayUrl.replace(/\/$/, '')}/v1beta/models/gemini-3.5-flash-lite:generateContent`;
    }

    const contents = [];
    if (options.systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `INSTRUÇÃO DE SISTEMA:\n${options.systemPrompt}` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Entendido. Agirei estritamente de acordo com as instruções fornecidas.' }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxTokens ?? 1500,
          responseMimeType: options.responseSchema ? 'application/json' : 'text/plain',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`AI Gateway HTTP ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Resposta vazia da IA.');
    }

    return text.trim();
  }

  async generateJson<T>(prompt: string, options: AiGenerationOptions = {}): Promise<T> {
    const raw = await this.generate(prompt, { ...options, responseSchema: {} });
    return this.extractJsonObject<T>(raw);
  }

  extractJsonObject<T>(raw: string): T {
    const cleaned = String(raw || '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start < 0 || end <= start) {
      throw new Error(`Resposta não contém JSON válido: ${cleaned.slice(0, 100)}...`);
    }

    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return parsed as T;
    } catch (e) {
      throw new Error(`Falha ao decodificar JSON da IA: ${(e as Error).message}`);
    }
  }
}
