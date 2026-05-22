import rateLimit from "express-rate-limit";
import type { Request } from "express";

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  return String(raw || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `auth:${clientIp(req)}`,
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
});

export const filhoLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `filho:${clientIp(req)}`,
  message: { error: "Muitas tentativas de login. Aguarde alguns minutos." },
});

export const checkoutRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `checkout:${clientIp(req)}`,
  message: { error: "Limite de requisições de checkout excedido." },
});

export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `webhook:${clientIp(req)}`,
  message: { error: "Rate limit exceeded" },
});

export const apiReadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `read:${clientIp(req)}`,
  message: { error: "Limite de requisições excedido." },
});
