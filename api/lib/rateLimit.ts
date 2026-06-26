import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientIp(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const xf = req.headers?.["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  return String(raw || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

export function consumeRateLimit(
  req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } },
  opts: { windowMs: number; max: number; keyPrefix: string }
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${opts.keyPrefix}:${clientIp(req as any)}`;
  const now = Date.now();
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

export const whatsappResendWelcomeRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: "wa-resend-welcome",
  message: { error: "Limite de reenvio de boas-vindas excedido. Tente mais tarde." },
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
