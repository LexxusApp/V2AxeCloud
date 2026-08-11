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
  const whatsapp = env("GROWTH_WHATSAPP_NUMBER", "551152950746").replace(/\D/g, "");
  const site = env("APP_PUBLIC_URL", "https://axecloud.com.br").replace(/\/$/, "");
  const waText = encodeURIComponent(`Olá! Sou responsável pelo ${input.terreiroNome} e quero conhecer o AxéCloud.`);
  const whatsappUrl = `https://wa.me/${whatsapp}?text=${waText}`;
  const subject = `Uma ideia para facilitar a organização do ${input.terreiroNome}`;
  const message = `Olá, equipe do ${input.terreiroNome}!

Meu nome é Lucas, sou de Suzano e criei o AxéCloud pensando na rotina dos terreiros: membros cadastrados em vários lugares, agenda, mensalidades, financeiro e comunicados difíceis de acompanhar.

O AxéCloud reúne essa organização em um só sistema, com respeito à forma de trabalho de cada casa.

Posso liberar um teste gratuito de 30 dias, sem cartão, e mostrar rapidamente como funciona: ${site}/cadastro

Se quiser conhecer, é só iniciar a conversa comigo pelo WhatsApp: ${whatsappUrl}

Caso este assunto não seja do interesse da casa, basta responder “não tenho interesse” e não faremos outro contato.

Axé,
Lucas
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
    <p>Meu nome é Lucas, sou de Suzano e criei o AxéCloud pensando na rotina dos terreiros: membros cadastrados em vários lugares, agenda, mensalidades, financeiro e comunicados difíceis de acompanhar.</p>
    <p>O AxéCloud reúne essa organização em um só sistema, com respeito à forma de trabalho de cada casa.</p>
    <p>Posso liberar um <a href="${escapeHtml(env("APP_PUBLIC_URL", "https://axecloud.com.br").replace(/\/$/, ""))}/cadastro">teste gratuito de 30 dias</a>, sem cartão, e mostrar rapidamente como funciona.</p>
    <p><a href="${escapeHtml(whatsappUrl)}">Iniciar uma conversa comigo pelo WhatsApp</a></p>
    <p style="color:#6b665d;font-size:13px">Caso este assunto não seja do interesse da casa, basta responder “não tenho interesse” e não faremos outro contato.</p>
    <p>Axé,<br>Lucas<br>AxéCloud — tecnologia com respeito ao sagrado.</p>
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
