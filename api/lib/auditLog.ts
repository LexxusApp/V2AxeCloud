/**
 * Helper de auditoria. Grava eventos em `public.access_logs` (ver supabase/migrations).
 *
 * Características:
 *  - Nunca quebra a request: erros são engolidos para warning no console.
 *  - Se a tabela ainda não foi criada no Supabase (cache de schema PGRST), o helper
 *    desativa-se SILENCIOSAMENTE para não inundar os logs do servidor. Quando você
 *    aplicar a migration, basta reiniciar o backend que ele volta a gravar.
 *  - "Best effort": pode ser chamado com `void` para não bloquear a resposta.
 */

export type LogEventInput = {
  /** Identificador curto e estável (ex.: "tenant.created", "filho.login"). */
  eventType: string;
  /** Quem disparou — geralmente o `req.user.id` (admin) ou null se for um evento anônimo. */
  userId?: string | null;
  userEmail?: string | null;
  /** Tipo do alvo: "tenant", "filho", "subscription", "whatsapp", "global_settings", etc. */
  targetType?: string | null;
  targetId?: string | null;
  /** Descrição amigável (PT-BR). */
  description?: string | null;
  /** Tenant relacionado (para filtrar logs por terreiro). */
  tenantId?: string | null;
  /** Qualquer payload extra. NÃO incluir segredos como senha em claro. */
  metadata?: Record<string, unknown> | null;
  /** Request Express opcional — extrai IP/User-Agent automaticamente. */
  req?: any;
};

let disabled = false;
let lastDisabledReason = "";

export function getAuditLogDisabled(): { disabled: boolean; reason: string } {
  return { disabled, reason: lastDisabledReason };
}

export function resetAuditLogState() {
  disabled = false;
  lastDisabledReason = "";
}

function extractIp(req: any): string | null {
  try {
    const xff = String(req?.headers?.["x-forwarded-for"] || "");
    if (xff) return xff.split(",")[0]?.trim() || null;
    const ip = req?.ip || req?.socket?.remoteAddress || null;
    return ip ? String(ip).replace(/^::ffff:/, "") : null;
  } catch {
    return null;
  }
}

function extractUserAgent(req: any): string | null {
  try {
    const ua = String(req?.headers?.["user-agent"] || "").trim();
    return ua || null;
  } catch {
    return null;
  }
}

function looksLikeMissingTable(err: { message?: string; details?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = `${String(err.message || "")} ${String(err.details || "")}`.toLowerCase();
  if (!m.includes("access_logs")) return false;
  if (String(err.code || "") === "PGRST205") return true;
  return /schema cache|does not exist|could not find|undefined relation|unknown table|not find the table/i.test(m);
}

/**
 * Insere um evento. Devolve sempre void; nunca lança.
 * Use com `void logEvent(...)` quando não quiser aguardar.
 */
export async function logEvent(supabaseAdmin: { from: (t: string) => any }, ev: LogEventInput): Promise<void> {
  if (disabled) return;
  if (!ev?.eventType) return;
  try {
    const ip = ev.req ? extractIp(ev.req) : null;
    const ua = ev.req ? extractUserAgent(ev.req) : null;
    const payload = {
      event_type: String(ev.eventType).slice(0, 80),
      user_id: ev.userId || null,
      user_email: ev.userEmail ? String(ev.userEmail).toLowerCase().slice(0, 200) : null,
      target_type: ev.targetType || null,
      target_id: ev.targetId ? String(ev.targetId).slice(0, 100) : null,
      description: ev.description ? String(ev.description).slice(0, 500) : null,
      tenant_id: ev.tenantId || null,
      metadata: ev.metadata || null,
      ip,
      user_agent: ua ? ua.slice(0, 500) : null,
    };

    const { error } = await supabaseAdmin.from("access_logs").insert(payload);
    if (error) {
      if (looksLikeMissingTable(error)) {
        disabled = true;
        lastDisabledReason = error.message || "tabela access_logs ausente";
        console.warn(
          "[auditLog] Tabela 'access_logs' ainda não existe — eventos não serão gravados até aplicar a migration. " +
            "Veja supabase/migrations/20260513192500_access_logs.sql."
        );
        return;
      }
      console.warn("[auditLog] insert falhou:", error.message || error);
    }
  } catch (e: any) {
    console.warn("[auditLog] exception:", e?.message || e);
  }
}
