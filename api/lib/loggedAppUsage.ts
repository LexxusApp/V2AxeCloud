/**
 * Uso autenticado do painel (zelador + filho de santo): login ou entrada (session.activity).
 * Não inclui visitantes do site público nem cliques do diretório.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingOrUnknownTable, isRememberedMissingTable } from "./adminConsoleAuth.js";
import { brazilDate, brazilMonthStart } from "./brazilCalendar.js";

const PAGE = 1000;
const SHADOW_FILHO_EMAIL = /(^f_[a-f0-9-]{8,}@|@axecloud\.internal$)/i;

export type LoggedAppUsageStats = {
  available: boolean;
  /** Usuários únicos (zelador/filho) que logaram ou entraram no mês civil SP */
  uniqueUsersCurrentMonth: number;
  /** Soma de logins + entradas no mês */
  eventsCurrentMonth: number;
  loginsCurrentMonth: number;
  entriesCurrentMonth: number;
  uniqueUsersToday: number;
  eventsToday: number;
};

function isFilhoEmail(email?: string | null): boolean {
  return typeof email === "string" && SHADOW_FILHO_EMAIL.test(email);
}

function dayKey(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return brazilDate(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

async function fetchAllPages<T extends Record<string, unknown>>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string; code?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await fetchPage(offset, offset + PAGE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
    if (offset > 100_000) break;
  }
  return rows;
}

export async function fetchLoggedAppUsageStats(sb: SupabaseClient): Promise<LoggedAppUsageStats> {
  const empty: LoggedAppUsageStats = {
    available: false,
    uniqueUsersCurrentMonth: 0,
    eventsCurrentMonth: 0,
    loginsCurrentMonth: 0,
    entriesCurrentMonth: 0,
    uniqueUsersToday: 0,
    eventsToday: 0,
  };

  const now = new Date();
  const monthStart = brazilMonthStart(now);
  const today = brazilDate(now);
  // created_at is timestamptz — use start of month in SP as UTC lower bound with buffer
  const monthStartUtc = new Date(`${monthStart}T00:00:00-03:00`).toISOString();

  const userKeys = new Set<string>();
  const userKeysToday = new Set<string>();
  let logins = 0;
  let entries = 0;
  let eventsToday = 0;
  let available = false;

  const rememberUser = (userId: string | null | undefined, email: string | null | undefined, day: string) => {
    const id = String(userId || "").trim();
    const em = String(email || "").trim().toLowerCase();
    const key = id || (em ? `email:${em}` : "");
    if (!key) return;
    userKeys.add(key);
    if (day === today) userKeysToday.add(key);
  };

  if (!isRememberedMissingTable("audit_logs")) {
    try {
      const loginRows = await fetchAllPages<{
        created_at?: string;
        user_id?: string | null;
        user_email?: string | null;
        details?: { mode?: string; email?: string } | null;
      }>(async (from, to) => {
        const res = await sb
          .from("audit_logs")
          .select("created_at, user_id, user_email, details")
          .eq("action", "auth.login_success")
          .gte("created_at", monthStartUtc)
          .order("created_at", { ascending: true })
          .range(from, to);
        return res;
      });

      available = true;
      for (const row of loginRows) {
        const mode = String(row.details?.mode || "").toLowerCase();
        // Só zelador e filho; ignora admin / desconhecido
        if (mode && mode !== "zelador" && mode !== "filho") continue;
        if (!mode) {
          // Sem mode: aceita se e-mail for filho interno ou se houver user_id (painel autenticado)
          const email = row.user_email || row.details?.email;
          if (!row.user_id && !email) continue;
        }
        const day = dayKey(row.created_at);
        if (!day || day < monthStart) continue;
        logins++;
        if (day === today) eventsToday++;
        rememberUser(row.user_id, row.user_email || row.details?.email, day);
      }
    } catch (err: unknown) {
      if (!isMissingOrUnknownTable(err as { message?: string }, "audit_logs")) throw err;
    }
  }

  if (!isRememberedMissingTable("access_logs")) {
    try {
      const entryRows = await fetchAllPages<{
        created_at?: string;
        user_id?: string | null;
        user_email?: string | null;
        event_type?: string | null;
      }>(async (from, to) => {
        const res = await sb
          .from("access_logs")
          .select("created_at, user_id, user_email, event_type")
          .in("event_type", ["session.activity", "access.session.activity"])
          .not("user_id", "is", null)
          .gte("created_at", monthStartUtc)
          .order("created_at", { ascending: true })
          .range(from, to);
        return res;
      });

      available = true;
      for (const row of entryRows) {
        // track-activity só roda no app autenticado (zelador/filho)
        if (!row.user_id) continue;
        const day = dayKey(row.created_at);
        if (!day || day < monthStart) continue;
        entries++;
        if (day === today) eventsToday++;
        rememberUser(row.user_id, row.user_email, day);
      }
    } catch (err: unknown) {
      if (!isMissingOrUnknownTable(err as { message?: string }, "access_logs")) throw err;
    }
  }

  return {
    available,
    uniqueUsersCurrentMonth: userKeys.size,
    eventsCurrentMonth: logins + entries,
    loginsCurrentMonth: logins,
    entriesCurrentMonth: entries,
    uniqueUsersToday: userKeysToday.size,
    eventsToday,
  };
}

/** @deprecated helper for tests */
export function classifyLoggedAppActor(email: string | null | undefined, mode?: string | null): "zelador" | "filho" | "other" {
  const m = String(mode || "").toLowerCase();
  if (m === "filho" || isFilhoEmail(email)) return "filho";
  if (m === "zelador") return "zelador";
  if (m === "admin") return "other";
  if (email && !isFilhoEmail(email)) return "zelador";
  return "other";
}
