import nodemailer from "nodemailer";

export type SupportTicketPayload = {
  nomeZelador: string;
  nomeTerreiro: string;
  whatsapp: string;
  mensagem: string;
  accountEmail?: string | null;
  userId?: string | null;
  tenantId?: string | null;
};

function env(name: string, fallback = ""): string {
  return String(process.env[name] || fallback).trim();
}

export function supportMailConfigured(): boolean {
  return Boolean(env("SMTP_USER") && env("SMTP_PASS"));
}

export function supportInboxEmail(): string {
  return env("SUPPORT_TO_EMAIL", "axeagendado@gmail.com");
}

function buildTransport() {
  const host = env("SMTP_HOST", "smtp.gmail.com");
  const port = Number(env("SMTP_PORT", "587")) || 587;
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS").replace(/\s+/g, "");
  if (!user || !pass) {
    throw new Error("SMTP não configurado (SMTP_USER / SMTP_PASS).");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendSupportTicketEmail(payload: SupportTicketPayload): Promise<{ messageId: string }> {
  const to = supportInboxEmail();
  const fromUser = env("SMTP_USER");
  const fromName = env("SMTP_FROM_NAME", "AxéCloud Suporte");
  const transport = buildTransport();

  const subject = `[Suporte AxéCloud] ${payload.nomeTerreiro} — ${payload.nomeZelador}`;
  const text = [
    "Novo pedido de suporte pelo painel AxéCloud",
    "",
    `Zelador(a): ${payload.nomeZelador}`,
    `Terreiro: ${payload.nomeTerreiro}`,
    `WhatsApp: ${payload.whatsapp}`,
    payload.accountEmail ? `E-mail da conta: ${payload.accountEmail}` : null,
    payload.tenantId ? `Tenant ID: ${payload.tenantId}` : null,
    payload.userId ? `User ID: ${payload.userId}` : null,
    "",
    "Mensagem:",
    payload.mensagem,
  ]
    .filter((line) => line != null)
    .join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#171A16">
      <h2 style="margin:0 0 12px">Novo pedido de suporte</h2>
      <p style="margin:0 0 16px;color:#665F55">Enviado pelo painel AxéCloud</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;font-weight:700;width:140px">Zelador(a)</td><td>${escapeHtml(payload.nomeZelador)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">Terreiro</td><td>${escapeHtml(payload.nomeTerreiro)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:700">WhatsApp</td><td>${escapeHtml(payload.whatsapp)}</td></tr>
        ${payload.accountEmail ? `<tr><td style="padding:6px 0;font-weight:700">E-mail da conta</td><td>${escapeHtml(payload.accountEmail)}</td></tr>` : ""}
      </table>
      <div style="margin-top:18px;padding:14px;border-radius:12px;background:#F5F0E5;border:1px solid #DED8CB">
        <p style="margin:0 0 8px;font-weight:700">Mensagem</p>
        <p style="margin:0;white-space:pre-wrap">${escapeHtml(payload.mensagem)}</p>
      </div>
    </div>
  `;

  const info = await transport.sendMail({
    from: `"${fromName}" <${fromUser}>`,
    to,
    replyTo: payload.accountEmail || undefined,
    subject,
    text,
    html,
  });

  return { messageId: String(info.messageId || "") };
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
