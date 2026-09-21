/**
 * Disparo manual de aviso de gira pelo console admin (terreiro + evento + template).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchGiraWhatsApp } from "./cronWhatsAppJobs.js";
import { isMetaCloudDirectConfigured } from "./metaCloudSend.js";
import { resolveMetaTemplateName } from "./whatsappMetaCloud.js";

export type AdminGiraTemplateOption = {
  id: string;
  name: string;
  label: string;
  description: string;
  isDefault: boolean;
};

export type AdminGiraTenantRow = {
  id: string;
  nomeTerreiro: string;
  email: string | null;
  upcomingEvents: number;
};

export type AdminGiraEventRow = {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string | null;
  eventoPublico: boolean;
  bannerUrl: string | null;
};

const TEMPLATE_OPTIONS: Omit<AdminGiraTemplateOption, "isDefault">[] = [
  {
    id: "lembrete_membro",
    name: "aviso_gira_lembrete_membro_axecloud",
    label: "Lembrete humanizado",
    description: "Olá + nome + quando + terreiro + gira + horário",
  },
];

export function listAdminGiraTemplateOptions(): AdminGiraTemplateOption[] {
  const current = resolveMetaTemplateName("aviso_gira");
  return TEMPLATE_OPTIONS.map((t) => ({
    ...t,
    isDefault: t.name === current,
  }));
}

export async function listAdminGiraTenants(
  sb: SupabaseClient,
  opts?: { q?: string; limit?: number }
): Promise<{ tenants: AdminGiraTenantRow[]; metaConfigured: boolean }> {
  const limit = Math.min(Math.max(Number(opts?.limit) || 80, 1), 200);
  const q = String(opts?.q || "").trim().toLowerCase();

  const { data: profiles, error } = await sb
    .from("perfil_lider")
    .select("id, nome_terreiro, email, deleted_at")
    .is("deleted_at", null)
    .order("nome_terreiro", { ascending: true })
    .limit(400);
  if (error) throw error;

  let rows = (profiles || []).filter((p) => {
    if (!q) return true;
    const hay = `${p.nome_terreiro || ""} ${p.email || ""} ${p.id}`.toLowerCase();
    return hay.includes(q);
  });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const upcomingByTenant = new Map<string, number>();

  const ids = rows.map((r) => String(r.id));
  if (ids.length) {
    // Contagem aproximada: eventos futuros por tenant/lider
    const { data: events } = await sb
      .from("calendario_axe")
      .select("id, tenant_id, lider_id, data")
      .gte("data", today)
      .limit(2000);
    for (const ev of events || []) {
      for (const key of [ev.tenant_id, ev.lider_id]) {
        const id = String(key || "").trim();
        if (!id) continue;
        upcomingByTenant.set(id, (upcomingByTenant.get(id) || 0) + 1);
      }
    }
  }

  // Preferir quem tem gira futura quando não há busca
  if (!q) {
    rows = [...rows].sort((a, b) => {
      const ca = upcomingByTenant.get(String(a.id)) || 0;
      const cb = upcomingByTenant.get(String(b.id)) || 0;
      if (cb !== ca) return cb - ca;
      return String(a.nome_terreiro || "").localeCompare(String(b.nome_terreiro || ""), "pt-BR");
    });
  }

  const tenants: AdminGiraTenantRow[] = rows.slice(0, limit).map((p) => ({
    id: String(p.id),
    nomeTerreiro: String(p.nome_terreiro || "Terreiro"),
    email: p.email ? String(p.email) : null,
    upcomingEvents: upcomingByTenant.get(String(p.id)) || 0,
  }));

  return { tenants, metaConfigured: isMetaCloudDirectConfigured() };
}

export async function listAdminGiraEvents(
  sb: SupabaseClient,
  tenantId: string,
  opts?: { includePast?: boolean; limit?: number }
): Promise<AdminGiraEventRow[]> {
  const id = String(tenantId || "").trim();
  if (!id) return [];
  const limit = Math.min(Math.max(Number(opts?.limit) || 40, 1), 100);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  let query = sb
    .from("calendario_axe")
    .select("id, titulo, data, hora, tipo, evento_publico, banner_url, tenant_id, lider_id")
    .or(`tenant_id.eq.${id},lider_id.eq.${id}`)
    .order("data", { ascending: true })
    .limit(limit);

  if (!opts?.includePast) {
    query = query.gte("data", today);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((ev) => ({
    id: String(ev.id),
    titulo: String(ev.titulo || "Gira"),
    data: String(ev.data || "").slice(0, 10),
    hora: String(ev.hora || "").slice(0, 5),
    tipo: ev.tipo ? String(ev.tipo) : null,
    eventoPublico: Boolean(ev.evento_publico),
    bannerUrl: ev.banner_url ? String(ev.banner_url) : null,
  }));
}

export async function sendAdminGiraDispatch(
  sb: SupabaseClient,
  input: {
    tenantId: string;
    eventId: string;
    templateName?: string | null;
    onProgress?: (p: { sent: number; errors: number; eligible: number; index: number }) => void;
  }
): Promise<{
  sent: number;
  errors: number;
  eligible: number;
  status: string;
  templateName: string;
  event: { id: string; titulo: string; data: string; hora: string };
}> {
  const tenantId = String(input.tenantId || "").trim();
  const eventId = String(input.eventId || "").trim();
  if (!tenantId || !eventId) {
    const err = new Error("Informe terreiro e evento.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const allowed = new Set(TEMPLATE_OPTIONS.map((t) => t.name));
  const requested = String(input.templateName || "").trim();
  const templateName = requested && allowed.has(requested) ? requested : resolveMetaTemplateName("aviso_gira");

  const { data: event, error } = await sb
    .from("calendario_axe")
    .select("id, titulo, data, hora, banner_url, tenant_id, lider_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!event) {
    const err = new Error("Evento não encontrado.") as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const scopeOk =
    String(event.tenant_id || "") === tenantId || String(event.lider_id || "") === tenantId;
  if (!scopeOk) {
    const err = new Error("Evento não pertence a este terreiro.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const eventSummary = {
    id: String(event.id),
    titulo: String(event.titulo || "Gira"),
    data: String(event.data || "").slice(0, 10),
    hora: String(event.hora || "").slice(0, 5),
  };

  const result = await dispatchGiraWhatsApp(
    sb,
    tenantId,
    {
      id: String(event.id),
      titulo: String(event.titulo || "Gira"),
      data: String(event.data || ""),
      hora: String(event.hora || ""),
      banner_url: event.banner_url ? String(event.banner_url) : null,
    },
    {
      bypassFanoutCooldown: true,
      notifyZeladorSummary: false,
      metaTemplateName: templateName,
      messageSuffix: `admin:${templateName}`,
      onProgress: input.onProgress,
    }
  );

  return {
    sent: result.sent,
    errors: result.errors,
    eligible: result.eligible,
    status: result.status,
    templateName,
    event: eventSummary,
  };
}

export type AdminGiraDispatchLogRow = {
  id: string;
  tenantId: string;
  nomeTerreiro: string | null;
  filhoId: string | null;
  filhoNome: string | null;
  telefone: string;
  telefoneMasked: string;
  status: string;
  externalId: string | null;
  preview: string;
  failureHint: string | null;
  createdAt: string;
};

function maskPhone(digits: string): string {
  const d = String(digits || "").replace(/\D/g, "");
  if (d.length < 8) return d || "—";
  return `+${d.slice(0, 2)} ${d.slice(2, -4).replace(/\d/g, "•")}${d.slice(-4)}`;
}

function extractFailureHint(mensagem: string): string | null {
  const m = String(mensagem || "").match(/\[meta:falha\s*([^\]]+)\]/i);
  if (!m) return null;
  return m[1].trim().slice(0, 160) || null;
}

export async function listAdminGiraDispatchLog(
  sb: SupabaseClient,
  opts?: { tenantId?: string; limit?: number }
): Promise<AdminGiraDispatchLogRow[]> {
  const limit = Math.min(Math.max(Number(opts?.limit) || 40, 1), 100);
  const tenantFilter = String(opts?.tenantId || "").trim();

  let query = sb
    .from("whatsapp_logs")
    .select("id, tenant_id, filho_id, telefone, mensagem, status, external_id, created_at")
    .eq("tipo", "aviso_gira")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tenantFilter) query = query.eq("tenant_id", tenantFilter);

  const { data, error } = await query;
  if (error) throw error;

  const tenantIds = [...new Set((data || []).map((r) => String(r.tenant_id || "")).filter(Boolean))];
  const filhoIds = [...new Set((data || []).map((r) => String(r.filho_id || "")).filter(Boolean))];
  const names = new Map<string, string>();
  const filhoNames = new Map<string, string>();

  if (tenantIds.length) {
    const { data: profs } = await sb.from("perfil_lider").select("id, nome_terreiro").in("id", tenantIds);
    for (const p of profs || []) names.set(String(p.id), String(p.nome_terreiro || ""));
  }
  if (filhoIds.length) {
    const { data: filhos } = await sb.from("filhos_de_santo").select("id, nome").in("id", filhoIds);
    for (const f of filhos || []) filhoNames.set(String(f.id), String(f.nome || "").trim());
  }

  return (data || []).map((row) => {
    const phone = String(row.telefone || "");
    const preview = String(row.mensagem || "")
      .replace(/\n*\[fp:[^\]]+\]/gi, "")
      .replace(/\n*\[meta:falha[^\]]*\]/gi, "")
      .trim();
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id || ""),
      nomeTerreiro: names.get(String(row.tenant_id || "")) || null,
      filhoId: row.filho_id ? String(row.filho_id) : null,
      filhoNome: row.filho_id ? filhoNames.get(String(row.filho_id)) || null : null,
      telefone: phone,
      telefoneMasked: maskPhone(phone),
      status: String(row.status || "sent"),
      externalId: row.external_id ? String(row.external_id) : null,
      preview: preview.slice(0, 220),
      failureHint: extractFailureHint(String(row.mensagem || "")),
      createdAt: String(row.created_at || ""),
    };
  });
}

/** Reenvia aviso de gira para um único membro (ex.: falha Meta #131049). */
export async function retryAdminGiraDispatch(
  sb: SupabaseClient,
  input: {
    tenantId: string;
    eventId: string;
    filhoId: string;
    templateName?: string | null;
  }
): Promise<{
  sent: number;
  errors: number;
  eligible: number;
  status: string;
  templateName: string;
  event: { id: string; titulo: string; data: string; hora: string };
}> {
  const tenantId = String(input.tenantId || "").trim();
  const eventId = String(input.eventId || "").trim();
  const filhoId = String(input.filhoId || "").trim();
  if (!tenantId || !eventId || !filhoId) {
    const err = new Error("Informe terreiro, evento e membro.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const allowed = new Set(TEMPLATE_OPTIONS.map((t) => t.name));
  const requested = String(input.templateName || "").trim();
  const templateName =
    requested && allowed.has(requested) ? requested : resolveMetaTemplateName("aviso_gira");

  const { data: event, error } = await sb
    .from("calendario_axe")
    .select("id, titulo, data, hora, banner_url, tenant_id, lider_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!event) {
    const err = new Error("Evento não encontrado.") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  const scopeOk =
    String(event.tenant_id || "") === tenantId || String(event.lider_id || "") === tenantId;
  if (!scopeOk) {
    const err = new Error("Evento não pertence a este terreiro.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const result = await dispatchGiraWhatsApp(
    sb,
    tenantId,
    {
      id: String(event.id),
      titulo: String(event.titulo || "Gira"),
      data: String(event.data || ""),
      hora: String(event.hora || ""),
      banner_url: event.banner_url ? String(event.banner_url) : null,
    },
    {
      bypassFanoutCooldown: true,
      notifyZeladorSummary: false,
      metaTemplateName: templateName,
      onlyFilhoIds: [filhoId],
      messageSuffix: `admin-retry:${Date.now()}`,
    }
  );

  return {
    sent: result.sent,
    errors: result.errors,
    eligible: result.eligible,
    status: result.status,
    templateName,
    event: {
      id: String(event.id),
      titulo: String(event.titulo || "Gira"),
      data: String(event.data || "").slice(0, 10),
      hora: String(event.hora || "").slice(0, 5),
    },
  };
}

export type AdminGiraDispatchJob = {
  id: string;
  phase: "queued" | "running" | "done" | "failed";
  sent: number;
  errors: number;
  eligible: number;
  index: number;
  status: string;
  templateName: string;
  event: { id: string; titulo: string; data: string; hora: string } | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

const giraDispatchJobs = new Map<string, AdminGiraDispatchJob>();

function pruneGiraJobs(now = Date.now()) {
  for (const [id, job] of giraDispatchJobs) {
    const started = Date.parse(job.startedAt) || 0;
    if (now - started > 2 * 60 * 60 * 1000) giraDispatchJobs.delete(id);
  }
}

export function getAdminGiraDispatchJob(jobId: string): AdminGiraDispatchJob | null {
  pruneGiraJobs();
  return giraDispatchJobs.get(String(jobId || "").trim()) || null;
}

/** Inicia disparo em background e devolve jobId imediatamente (evita timeout do browser). */
export async function startAdminGiraDispatchJob(
  sb: SupabaseClient,
  input: {
    tenantId: string;
    eventId: string;
    templateName?: string | null;
  }
): Promise<AdminGiraDispatchJob> {
  pruneGiraJobs();
  const tenantId = String(input.tenantId || "").trim();
  const eventId = String(input.eventId || "").trim();
  if (!tenantId || !eventId) {
    const err = new Error("Informe terreiro e evento.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const allowed = new Set(TEMPLATE_OPTIONS.map((t) => t.name));
  const requested = String(input.templateName || "").trim();
  const templateName = requested && allowed.has(requested) ? requested : resolveMetaTemplateName("aviso_gira");

  const { data: event, error } = await sb
    .from("calendario_axe")
    .select("id, titulo, data, hora, tenant_id, lider_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!event) {
    const err = new Error("Evento não encontrado.") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  const scopeOk =
    String(event.tenant_id || "") === tenantId || String(event.lider_id || "") === tenantId;
  if (!scopeOk) {
    const err = new Error("Evento não pertence a este terreiro.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `gira_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const job: AdminGiraDispatchJob = {
    id,
    phase: "queued",
    sent: 0,
    errors: 0,
    eligible: 0,
    index: 0,
    status: "queued",
    templateName,
    event: {
      id: String(event.id),
      titulo: String(event.titulo || "Gira"),
      data: String(event.data || "").slice(0, 10),
      hora: String(event.hora || "").slice(0, 5),
    },
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  giraDispatchJobs.set(id, job);

  void (async () => {
    job.phase = "running";
    job.status = "running";
    try {
      const result = await sendAdminGiraDispatch(sb, {
        tenantId,
        eventId,
        templateName,
        onProgress: (p) => {
          job.sent = p.sent;
          job.errors = p.errors;
          job.eligible = p.eligible;
          job.index = p.index;
        },
      });
      job.sent = result.sent;
      job.errors = result.errors;
      job.eligible = result.eligible;
      job.status = result.status;
      job.templateName = result.templateName;
      job.event = result.event;
      job.phase = "done";
      job.finishedAt = new Date().toISOString();
    } catch (e) {
      job.phase = "failed";
      job.status = "failed";
      job.error = e instanceof Error ? e.message : String(e);
      job.finishedAt = new Date().toISOString();
    }
  })();

  return job;
}
