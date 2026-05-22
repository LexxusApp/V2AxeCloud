import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  return String(raw || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
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
  max: 20,
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
