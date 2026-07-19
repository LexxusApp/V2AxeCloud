import type { Request } from "express";

export function captureWebhookRawBody(req: Request, _res: unknown, buffer: Buffer): void {
  const path = String(req.originalUrl || req.url || "").split("?", 1)[0];
  if (path === "/api/whatsapp/webhook") {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  }
}

export function rawBodyForSignature(req: Request, parsedBody: unknown): Buffer | string {
  const raw = (req as Request & { rawBody?: Buffer | string }).rawBody;
  if (Buffer.isBuffer(raw) || typeof raw === "string") return raw;
  return JSON.stringify(parsedBody ?? {});
}
