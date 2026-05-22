import rateLimit from "express-rate-limit";
import type { Request } from "express";

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  return String(raw || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

/** Opções compatíveis com Vercel/serverless (evita ValidationError de IP). */
const serverlessRateLimit = {
  standardHeaders: true as const,
  legacyHeaders: false,
  validate: { ip: false, xForwardedForHeader: false },
};

export const authRateLimit = rateLimit({
  ...serverlessRateLimit,
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `auth:${clientIp(req)}`,
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
});

export const filhoLoginRateLimit = rateLimit({
  ...serverlessRateLimit,
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `filho:${clientIp(req)}`,
  message: { error: "Muitas tentativas de login. Aguarde alguns minutos." },
});

export const checkoutRateLimit = rateLimit({
  ...serverlessRateLimit,
  windowMs: 10 * 60 * 1000,
  max: 40,
  keyGenerator: (req) => `checkout:${clientIp(req)}`,
  message: { error: "Limite de requisições de checkout excedido." },
});

export const webhookRateLimit = rateLimit({
  ...serverlessRateLimit,
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => `webhook:${clientIp(req)}`,
  message: { error: "Rate limit exceeded" },
});

export const apiReadRateLimit = rateLimit({
  ...serverlessRateLimit,
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => `read:${clientIp(req)}`,
  message: { error: "Limite de requisições excedido." },
});
