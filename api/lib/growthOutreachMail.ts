import nodemailer from "nodemailer";

function env(name: string, fallback = ""): string {
  return String(process.env[name] || fallback).trim();
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function growthMailConfigured(): boolean {
  return Boolean(env("SMTP_USER") && env("SMTP_PASS"));
}

export function buildGrowthIntro(input: { terreiroNome: string; cidade: string }) {
  const whatsapp = env("GROWTH_WHATSAPP_NUMBER", "5511912276156").replace(/\D/g, "");
  const site = env("APP_PUBLIC_URL", "https://axecloud.com.br").replace(/\/$/, "");
  const waText = encodeURIComponent(`Olá! Sou responsável pelo ${input.terreiroNome} e quero conhecer o AxéCloud.`);
  const whatsappUrl = `https://wa.me/${whatsapp}?text=${waText}`;
  const subject = `${input.terreiroNome}: organização da casa em um só lugar`;
  const message = `Olá, equipe do ${input.terreiroNome}!

Encontramos o contato público da casa durante um levantamento de terreiros de ${input.cidade}. O AxéCloud é um sistema criado para facilitar cadastro de membros, giras, mensalidades, financeiro, obrigações e comunicação da casa.

Vocês podem conhecer e testar gratuitamente por 30 dias, sem cartão: ${site}/cadastro

Se preferirem conversar, iniciem o atendimento pelo WhatsApp: ${whatsappUrl}

Se não quiserem receber outro contato do AxéCloud, basta responder “não tenho interesse”.

AxéCloud — tecnologia com respeito ao sagrado.`;
  return { subject, message, whatsappUrl };
}

export async function sendGrowthIntroEmail(input: {
  to: string;
  terreiroNome: string;
  cidade: string;
}): Promise<{ messageId: string; subject: string; message: string }> {
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS").replace(/\s+/g, "");
  if (!user || !pass) throw new Error("SMTP não configurado para prospecção por e-mail.");
  const port = Number(env("SMTP_PORT", "587")) || 587;
  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST", "smtp.gmail.com"),
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const { subject, message, whatsappUrl } = buildGrowthIntro(input);
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#25231f;max-width:620px">
    <p>Olá, equipe do <strong>${escapeHtml(input.terreiroNome)}</strong>!</p>
    <p>Encontramos o contato público da casa durante um levantamento de terreiros de ${escapeHtml(input.cidade)}. O AxéCloud facilita cadastro de membros, giras, mensalidades, financeiro, obrigações e comunicação da casa.</p>
    <p><a href="${escapeHtml(env("APP_PUBLIC_URL", "https://axecloud.com.br").replace(/\/$/, ""))}/cadastro">Conhecer e testar gratuitamente por 30 dias</a>, sem cartão.</p>
    <p><a href="${escapeHtml(whatsappUrl)}">Iniciar uma conversa no WhatsApp</a></p>
    <p style="color:#6b665d;font-size:13px">Se não quiserem receber outro contato do AxéCloud, basta responder “não tenho interesse”.</p>
    <p>AxéCloud — tecnologia com respeito ao sagrado.</p>
  </div>`;
  const info = await transport.sendMail({
    from: `"${env("GROWTH_FROM_NAME", "AxéCloud")}" <${user}>`,
    to: input.to,
    replyTo: env("GROWTH_REPLY_TO", user),
    subject,
    text: message,
    html,
  });
  return { messageId: String(info.messageId || ""), subject, message };
}
