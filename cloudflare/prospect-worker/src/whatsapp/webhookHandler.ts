import type { ProspectingEnv, QueueConversationMessage } from '../types.js';

export async function verifyMetaHmacSha256(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !appSecret || !rawBody) return false;
  if (!signatureHeader.startsWith('sha256=')) return false;

  const providedHash = signatureHeader.slice(7).trim().toLowerCase();
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const messageData = encoder.encode(rawBody);

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const expectedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();

    return expectedHash === providedHash;
  } catch (e) {
    console.error('[webhookHandler] Erro ao validar assinatura HMAC:', e);
    return false;
  }
}

export function handleMetaWebhookChallenge(
  url: URL,
  expectedVerifyToken: string,
): Response {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === expectedVerifyToken && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('Forbidden', { status: 403 });
}

export interface InboundMetaMessage {
  from: string;
  name?: string;
  externalId: string;
  body: string;
  timestamp: number;
}

export function extractInboundMessagesFromMetaPayload(payload: any): InboundMetaMessage[] {
  const out: InboundMetaMessage[] = [];
  if (!payload || payload.object !== 'whatsapp_business_account') return out;

  const entries = payload.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const val = change?.value;
      const messages = val?.messages;
      const contacts = val?.contacts;
      if (!Array.isArray(messages)) continue;

      const contactNameMap = new Map<string, string>();
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          if (c?.wa_id && c?.profile?.name) {
            contactNameMap.set(String(c.wa_id), String(c.profile.name));
          }
        }
      }

      for (const m of messages) {
        if (!m || typeof m !== 'object') continue;
        const from = String(m.from || '').replace(/\D/g, '');
        const externalId = String(m.id || '');
        const timestamp = Number(m.timestamp) ? Number(m.timestamp) * 1000 : Date.now();

        let body = '';
        if (m.type === 'text') {
          body = String(m.text?.body || '').trim();
        } else if (m.type === 'button') {
          body = String(m.button?.text || m.button?.payload || '').trim();
        } else if (m.type === 'interactive') {
          body = String(
            m.interactive?.button_reply?.title ||
              m.interactive?.list_reply?.title ||
              m.interactive?.button_reply?.id ||
              '',
          ).trim();
        }

        if (from && body) {
          out.push({
            from,
            name: contactNameMap.get(from),
            externalId,
            body,
            timestamp,
          });
        }
      }
    }
  }

  return out;
}

export interface MetaStatusUpdate {
  externalId: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

function formatMetaStatusError(errors: unknown): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const message = errors
    .map((error) => {
      if (!error || typeof error !== 'object') return '';
      const item = error as {
        code?: string | number;
        title?: string;
        message?: string;
        error_data?: { details?: string };
      };
      const code = item.code != null ? `#${item.code}` : '';
      const title = String(item.title || item.message || '').trim();
      const details = String(item.error_data?.details || '').trim();
      return [code, title, details].filter(Boolean).join(' — ');
    })
    .filter(Boolean)
    .join('; ');
  return message || null;
}

export function extractStatusesFromMetaPayload(payload: any): MetaStatusUpdate[] {
  const out: MetaStatusUpdate[] = [];
  if (!payload || payload.object !== 'whatsapp_business_account') return out;
  const entries = payload.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = change?.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const st of statuses) {
        if (st?.id && st?.status) {
          const firstError = Array.isArray(st.errors) ? st.errors[0] : null;
          out.push({
            externalId: String(st.id),
            status: String(st.status),
            errorCode: firstError?.code != null ? String(firstError.code) : null,
            errorMessage: formatMetaStatusError(st.errors),
          });
        }
      }
    }
  }
  return out;
}
