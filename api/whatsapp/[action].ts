/**
 * WhatsApp (Evolution): config, send, start/connect, status, logout, test-message, webhook.
 */
import { applyDiscreteRouteCors } from "../lib/corsOrigins.js";
import { handleWhatsappRoute } from "../lib/whatsappRouter.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const action = String(req.query?.action || "").trim();
  if (!action) {
    res.status(400).json({ error: "Parâmetro action obrigatório na URL" });
    return;
  }

  await handleWhatsappRoute(action, req, res);
}
