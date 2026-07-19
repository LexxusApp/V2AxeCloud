/**
 * Webhook de alerta para queda de score / problemas.
 *
 * Detecta o formato (Discord/Slack) pela URL e formata o payload.
 * Falhas são silenciosas — apenas logadas, nunca propagam para o caller.
 */

import { assertSafeExternalUrl } from "../ssrfGuard.js";

type AlertPayload = {
  url: string;
  label?: string | null;
  total: number | null;
  grade: string | null;
  previousTotal?: number | null;
  delta?: number | null;
  threshold: number;
  reason: string;
  issues?: number;
  brokenLinks?: number;
};

function isDiscord(url: string): boolean {
  return /discord(?:app)?\.com\/api\/webhooks\//i.test(url);
}
function isSlack(url: string): boolean {
  return /hooks\.slack\.com\/services\//i.test(url);
}

function gradeEmoji(grade: string | null | undefined): string {
  switch ((grade || "").toUpperCase()) {
    case "A+":
    case "A":
      return "🟢";
    case "B":
      return "🔵";
    case "C":
      return "🟡";
    case "D":
      return "🟠";
    case "F":
      return "🔴";
    default:
      return "⚪";
  }
}

function buildDiscord(p: AlertPayload): unknown {
  const color =
    p.grade === "F" ? 0xff3b30 : p.grade === "D" ? 0xff9500 : p.grade === "C" ? 0xffcc00 : 0x34c759;
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "URL", value: p.url, inline: false },
  ];
  if (p.label) fields.unshift({ name: "Alvo", value: p.label, inline: true });
  fields.push({
    name: "Score",
    value: `${gradeEmoji(p.grade)} **${p.total ?? "n/d"}** (${p.grade || "n/d"})`,
    inline: true,
  });
  if (p.previousTotal != null) {
    fields.push({
      name: "Anterior",
      value: `${p.previousTotal} (Δ ${p.delta != null ? (p.delta >= 0 ? "+" : "") + p.delta : "0"})`,
      inline: true,
    });
  }
  fields.push({ name: "Limite alerta", value: String(p.threshold), inline: true });
  if (typeof p.issues === "number") fields.push({ name: "Issues", value: String(p.issues), inline: true });
  if (typeof p.brokenLinks === "number")
    fields.push({ name: "Links quebrados", value: String(p.brokenLinks), inline: true });
  return {
    username: "AxéCloud Audit",
    embeds: [
      {
        title: "⚠️ Alerta de auditoria",
        description: p.reason,
        color,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function buildSlack(p: AlertPayload): unknown {
  const head = `*${gradeEmoji(p.grade)} Alerta de auditoria* — ${p.label || p.url}`;
  const lines = [
    `*Score:* ${p.total ?? "n/d"} (${p.grade || "n/d"})`,
    p.previousTotal != null ? `*Anterior:* ${p.previousTotal} (Δ ${p.delta != null ? (p.delta >= 0 ? "+" : "") + p.delta : "0"})` : null,
    `*Limite:* ${p.threshold}`,
    p.reason ? `*Motivo:* ${p.reason}` : null,
    p.issues != null ? `*Issues:* ${p.issues}` : null,
    p.brokenLinks != null ? `*Links quebrados:* ${p.brokenLinks}` : null,
    `*URL:* ${p.url}`,
  ].filter(Boolean);
  return { text: `${head}\n${lines.join("\n")}` };
}

export async function sendAuditWebhook(url: string, payload: AlertPayload): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: "URL invalida" };
  const body = isDiscord(url) ? buildDiscord(payload) : isSlack(url) ? buildSlack(payload) : payload;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await assertSafeExternalUrl(url);
    const res = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}
