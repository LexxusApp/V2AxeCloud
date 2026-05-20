import webpush from "web-push";
import { sendEvolutionTextByInstance, CONSOLE_ADMIN_INSTANCE_NAME } from "../../src/services/evolution.service.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { listConsoleTenants } from "./listConsoleTenants.js";

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  "BEKar2pRRjBhX5Pz-EtX1QT07JbDBhSBx_-t5mAPZ3TevskbdG0w9JJNz-TbR-TzuIigtXTg27vCX_8GElZUM7Y";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  process.env.VITE_VAPID_PRIVATE_KEY ||
  "QsB2TftnfoqwCo7UhYYmmLMNR2yoorTI-FKjsmgrjA0";

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  try {
    webpush.setVapidDetails("mailto:contato@axecloud.com.br", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidReady = true;
  } catch {
    /* noop */
  }
}

async function sendPushToTenant(
  supabaseAdmin: any,
  tenantId: string,
  payload: { title: string; body: string; url: string }
): Promise<number> {
  ensureVapid();
  const { data: filhos } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("user_id")
    .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`);
  const userIds = [...new Set((filhos || []).map((f: { user_id?: string }) => f.user_id).filter(Boolean))];
  if (!userIds.length) return 0;

  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("subscription_object")
    .in("user_id", userIds);
  if (!subscriptions?.length) return 0;

  let sent = 0;
  await Promise.all(
    subscriptions.map((sub: { subscription_object: webpush.PushSubscription }) =>
      webpush
        .sendNotification(sub.subscription_object, JSON.stringify(payload))
        .then(() => {
          sent++;
        })
        .catch(() => undefined)
    )
  );
  return sent;
}

export async function publishGlobalNotice(
  supabaseAdmin: any,
  input: {
    titulo: string;
    conteudo: string;
    categoria?: string;
    sendPush?: boolean;
  }
): Promise<{ noticesCreated: number; tenantsTotal: number; pushSent: number; errors: string[] }> {
  const titulo = String(input.titulo || "").trim();
  const conteudo = String(input.conteudo || "").trim();
  if (!titulo || !conteudo) {
    throw new Error("Título e conteúdo são obrigatórios.");
  }

  const tenants = await listConsoleTenants(supabaseAdmin);
  const categoria = String(input.categoria || "Sistema").trim() || "Sistema";
  const baseRow = {
    titulo,
    conteudo,
    categoria,
    data_publicacao: new Date().toISOString(),
    expiracao: null,
  };

  let noticesCreated = 0;
  let pushSent = 0;
  const errors: string[] = [];

  for (const t of tenants) {
    const tid = String(t.id);
    const { error } = await supabaseAdmin.from("mural_avisos").insert({ ...baseRow, tenant_id: tid });
    if (error) {
      errors.push(`${t.nome_terreiro || tid}: ${error.message || "erro"}`);
      continue;
    }
    noticesCreated++;
    if (input.sendPush) {
      pushSent += await sendPushToTenant(supabaseAdmin, tid, {
        title: `Aviso: ${titulo}`,
        body: conteudo.slice(0, 120) + (conteudo.length > 120 ? "…" : ""),
        url: "/mural",
      });
    }
  }

  return { noticesCreated, tenantsTotal: tenants.length, pushSent, errors };
}

export async function broadcastPlatformPush(
  supabaseAdmin: any,
  input: { title: string; body: string; url?: string }
): Promise<{ sent: number; targets: number }> {
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  if (!title || !body) throw new Error("Título e mensagem são obrigatórios.");

  ensureVapid();
  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("subscription_object");
  if (error) throw error;
  const subs = subscriptions || [];
  if (!subs.length) return { sent: 0, targets: 0 };

  const payload = JSON.stringify({ title, body, url: input.url || "/mural" });
  let sent = 0;
  await Promise.all(
    subs.map((sub: { subscription_object: webpush.PushSubscription }) =>
      webpush
        .sendNotification(sub.subscription_object, payload)
        .then(() => {
          sent++;
        })
        .catch(() => undefined)
    )
  );
  return { sent, targets: subs.length };
}

export async function broadcastWhatsAppToLeaders(
  supabaseAdmin: any,
  message: string
): Promise<{ sent: number; skipped: number; failed: number; tenantsTotal: number }> {
  const text = String(message || "").trim();
  if (!text) throw new Error("Mensagem é obrigatória.");

  const tenants = await listConsoleTenants(supabaseAdmin);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const t of tenants) {
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(t.id);
    if (authErr || !authUser?.user) {
      skipped++;
      continue;
    }
    const meta = (authUser.user.user_metadata || {}) as Record<string, unknown>;
    const raw = String(meta.whatsapp || meta.phone || "").trim();
    const msisdn = normalizeBrazilMsisdn(raw);
    if (!msisdn) {
      skipped++;
      continue;
    }
    try {
      await sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, msisdn, text);
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed, tenantsTotal: tenants.length };
}

export type FinancialReportRow = {
  id: string;
  terreiro: string;
  tenant_id: string;
  tipo: string;
  valor: number;
  categoria: string;
  data: string;
  descricao: string;
  status: string;
};

export async function buildFinancialReport(supabaseAdmin: any): Promise<{
  rows: FinancialReportRow[];
  summary: { entradas: number; saidas: number; saldo: number; lancamentos: number };
  generatedAt: string;
}> {
  const tenants = await listConsoleTenants(supabaseAdmin);
  const nameById = new Map<string, string>();
  for (const t of tenants) {
    nameById.set(t.id, String(t.nome_terreiro || t.email || t.id).trim());
  }

  const { data: fin, error } = await supabaseAdmin
    .from("financeiro")
    .select("id, tenant_id, lider_id, tipo, valor, categoria, data, descricao, status")
    .order("data", { ascending: false })
    .limit(15000);
  if (error) throw error;

  let entradas = 0;
  let saidas = 0;
  const rows: FinancialReportRow[] = [];

  for (const r of fin || []) {
    const tid = String(r.tenant_id || r.lider_id || "");
    const tipo = String(r.tipo || "").toLowerCase();
    const valor = Number(r.valor) || 0;
    if (tipo === "entrada") entradas += valor;
    else if (tipo === "saida" || tipo === "saída") saidas += valor;

    rows.push({
      id: String(r.id),
      terreiro: nameById.get(tid) || tid.slice(0, 8) || "—",
      tenant_id: tid,
      tipo: String(r.tipo || ""),
      valor,
      categoria: String(r.categoria || ""),
      data: String(r.data || "").slice(0, 10),
      descricao: String(r.descricao || "").slice(0, 200),
      status: String(r.status || ""),
    });
  }

  return {
    rows,
    summary: {
      entradas,
      saidas,
      saldo: entradas - saidas,
      lancamentos: rows.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
