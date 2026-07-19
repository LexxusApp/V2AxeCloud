import type { NextFunction, Request, Response } from "express";
import { resolveClientIp } from "./clientIp.js";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;
let requestsSinceCleanup = 0;

function clientIp(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  return resolveClientIp(req) || "unknown";
}

function cleanupBuckets(now: number): void {
  requestsSinceCleanup += 1;
  if (requestsSinceCleanup < 1_000 && buckets.size < MAX_BUCKETS) return;
  requestsSinceCleanup = 0;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

export function consumeRateLimit(
  req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } },
  opts: { windowMs: number; max: number; keyPrefix: string }
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${opts.keyPrefix}:${clientIp(req as any)}`;
  const now = Date.now();
  cleanupBuckets(now);
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= opts.max,
    remaining: Math.max(0, opts.max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function createRateLimit(opts: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message: Record<string, string>;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `${opts.keyPrefix}:${clientIp(req)}`;
      const now = Date.now();
      cleanupBuckets(now);
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + opts.windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      res.setHeader("RateLimit-Limit", String(opts.max));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));
      res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
      if (bucket.count > opts.max) {
        return res.status(429).json(opts.message);
      }
      next();
    } catch {
      next();
    }
  };
}

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyPrefix: "auth",
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
});

export const filhoLoginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyPrefix: "filho",
  message: { error: "Muitas tentativas de login. Aguarde alguns minutos." },
});

export const checkoutRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  keyPrefix: "checkout",
  message: { error: "Limite de requisições de checkout excedido." },
});

export const webhookRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: "webhook",
  message: { error: "Rate limit exceeded" },
});

export const apiReadRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyPrefix: "read",
  message: { error: "Limite de requisições excedido." },
});

export const auditLogRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: "audit",
  message: { error: "Muitas tentativas de registro. Aguarde alguns minutos." },
});

export const sensitiveActionRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyPrefix: "sensitive",
  message: { error: "Limite de ações sensíveis excedido. Aguarde alguns minutos." },
});

export const comprovanteVisionRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyPrefix: "comprovante-vision",
  message: { error: "Limite de validação de comprovantes excedido. Aguarde alguns minutos." },
});

export const whatsappSendRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 25,
  keyPrefix: "wa-send",
  message: { error: "Limite de envios WhatsApp excedido. Tente mais tarde." },
});

export const whatsappBroadcastRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 4,
  keyPrefix: "wa-broadcast",
  message: { error: "Limite de transmissões excedido. Tente mais tarde." },
});

export const whatsappTestRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: "wa-test",
  message: { error: "Limite de testes WhatsApp excedido. Tente mais tarde." },
});

export const whatsappResendDadosAcessoRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: "wa-resend-dados-acesso",
  message: { error: "Limite de reenvio de dados de acesso excedido. Tente mais tarde." },
});

export const pushDirectRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyPrefix: "push-direct",
  message: { error: "Limite de notificações diretas excedido." },
});

export const publicFormRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyPrefix: "public-form",
  message: { error: "Muitas tentativas. Aguarde alguns minutos antes de enviar novamente." },
});
