import { isIP } from "node:net";

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

function headerValue(headers: RequestLike["headers"], name: string): string {
  const value = headers?.[name];
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

function normalizeIp(value: string): string {
  const candidate = value.split(",")[0].trim().replace(/^\[|\]$/g, "");
  const unwrapped = candidate.startsWith("::ffff:") ? candidate.slice(7) : candidate;
  return isIP(unwrapped) ? unwrapped : "";
}

/**
 * Retorna IP validado sem confiar em X-Forwarded-For fornecido pelo cliente.
 *
 * Na VPS, o Caddy só escreve x-axecloud-client-ip após validar o peer contra
 * as faixas oficiais da Cloudflare. Em outros ambientes usamos o socket, salvo
 * na Vercel, cujo header dedicado é controlado pela plataforma.
 */
export function resolveClientIp(req: RequestLike): string | null {
  if (process.env.TRUST_PROXY_CLIENT_IP === "1") {
    const trusted = normalizeIp(headerValue(req.headers, "x-axecloud-client-ip"));
    if (trusted) return trusted;
  }

  if (process.env.VERCEL === "1") {
    const vercelIp = normalizeIp(headerValue(req.headers, "x-vercel-forwarded-for"));
    if (vercelIp) return vercelIp;
  }

  return normalizeIp(String(req.socket?.remoteAddress || "")) || null;
}
