import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingOrUnknownTable } from "./adminConsoleAuth.js";

export const FOUNDER_STATUSES = ["pending", "contacted", "accepted", "rejected"] as const;
export type FounderStatus = (typeof FOUNDER_STATUSES)[number];

const FOUNDER_SELECT =
  "id, created_at, nome_casa, cidade, estado, tradicao, whatsapp, nome_contato, email, mensagem, autoriza_perfil_publico, autoriza_depoimento, status, leader_id";

export type FounderApplicationRow = {
  id: string;
  created_at: string;
  nome_casa: string;
  cidade: string;
  estado: string;
  tradicao: string;
  whatsapp: string;
  nome_contato: string | null;
  email: string | null;
  mensagem: string | null;
  autoriza_perfil_publico: boolean;
  autoriza_depoimento: boolean;
  status: FounderStatus;
  leader_id: string | null;
  /** Preenchido na listagem quando leader_id está ligado a perfil_lider. */
  linked_nome_terreiro?: string | null;
  linked_tenant_id?: string | null;
};

export type FounderApplicationPatch = {
  status?: FounderStatus;
  leader_id?: string | null;
};

function normalizeEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Resolve perfil_lider.id pelo e-mail do zelador (inscrição ou terreiro existente). */
export async function resolveLeaderIdByEmail(
  sb: SupabaseClient,
  email: string | null | undefined
): Promise<string | null> {
  const em = normalizeEmail(email);
  if (!em || !em.includes("@")) return null;

  const { data, error } = await sb
    .from("perfil_lider")
    .select("id")
    .ilike("email", em)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingOrUnknownTable(error, "perfil_lider")) return null;
    throw error;
  }
  return data?.id ? String(data.id) : null;
}

async function enrichFounderRows(
  sb: SupabaseClient,
  rows: FounderApplicationRow[]
): Promise<FounderApplicationRow[]> {
  const ids = [...new Set(rows.map((r) => r.leader_id).filter(Boolean))] as string[];
  if (ids.length === 0) return rows;

  const { data: profiles } = await sb
    .from("perfil_lider")
    .select("id, nome_terreiro, tenant_id")
    .in("id", ids);

  const byId = new Map(
    (profiles || []).map((p: { id: string; nome_terreiro: string | null; tenant_id: string | null }) => [
      p.id,
      p,
    ])
  );

  return rows.map((row) => {
    if (!row.leader_id) return row;
    const p = byId.get(row.leader_id);
    if (!p) return row;
    return {
      ...row,
      linked_nome_terreiro: p.nome_terreiro ?? null,
      linked_tenant_id: p.tenant_id ?? p.id,
    };
  });
}

const TRADICAO_LABEL: Record<string, string> = {
  umbanda: "Umbanda",
  candomble: "Candomblé",
  jurema: "Jurema",
  mista: "Tradição mista",
  outra: "Outra",
};

export function founderTradicaoLabel(value: string): string {
  return TRADICAO_LABEL[value] || value;
}

export function founderWhatsappUrl(digits: string): string {
  const n = String(digits || "").replace(/\D/g, "");
  if (!n) return "";
  const withCountry = n.startsWith("55") ? n : `55${n}`;
  return `https://wa.me/${withCountry}`;
}

export async function countFounderApplications(sb: SupabaseClient, statuses?: FounderStatus[]): Promise<number> {
  let q = sb.from("founder_applications").select("id", { count: "exact", head: true });
  if (statuses?.length) q = q.in("status", statuses);
  const { count, error } = await q;
  if (error) {
    if (isMissingOrUnknownTable(error, "founder_applications")) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function getFounderApplicationStats(sb: SupabaseClient) {
  const tableMissing = async () => {
    const { error } = await sb.from("founder_applications").select("id", { count: "exact", head: true }).limit(0);
    return Boolean(error && isMissingOrUnknownTable(error, "founder_applications"));
  };

  if (await tableMissing()) {
    return {
      available: false,
      total: 0,
      pending: 0,
      contacted: 0,
      accepted: 0,
      rejected: 0,
      maxSlots: 20,
      remainingSlots: 20,
    };
  }

  const [total, pending, contacted, accepted, rejected] = await Promise.all([
    countFounderApplications(sb),
    countFounderApplications(sb, ["pending"]),
    countFounderApplications(sb, ["contacted"]),
    countFounderApplications(sb, ["accepted"]),
    countFounderApplications(sb, ["rejected"]),
  ]);

  const maxSlots = 20;
  const usedSlots = pending + contacted + accepted;

  return {
    available: true,
    total,
    pending,
    contacted,
    accepted,
    rejected,
    maxSlots,
    remainingSlots: Math.max(0, maxSlots - usedSlots),
  };
}

export async function listFounderApplications(
  sb: SupabaseClient,
  opts: { status?: string; limit?: number } = {}
) {
  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 200));
  let q = sb
    .from("founder_applications")
    .select(FOUNDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  const status = String(opts.status || "").trim().toLowerCase();
  if (status && (FOUNDER_STATUSES as readonly string[]).includes(status)) {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingOrUnknownTable(error, "founder_applications")) {
      return { available: false, rows: [] as FounderApplicationRow[], notice: "Tabela founder_applications não encontrada." };
    }
    throw error;
  }

  const rows = await enrichFounderRows(sb, (data || []) as FounderApplicationRow[]);

  return {
    available: true,
    rows,
    notice: "",
  };
}

export async function getFounderApplicationById(
  sb: SupabaseClient,
  id: string
): Promise<FounderApplicationRow | null> {
  const { data, error } = await sb.from("founder_applications").select(FOUNDER_SELECT).eq("id", id).maybeSingle();
  if (error) {
    if (isMissingOrUnknownTable(error, "founder_applications")) return null;
    throw error;
  }
  if (!data) return null;
  const [row] = await enrichFounderRows(sb, [data as FounderApplicationRow]);
  return row ?? null;
}

/** Liga inscrição a terreiro já existente pelo e-mail da inscrição. */
export async function linkFounderApplicationToExistingLeader(
  sb: SupabaseClient,
  id: string
): Promise<FounderApplicationRow> {
  const current = await getFounderApplicationById(sb, id);
  if (!current) throw new Error("Inscrição não encontrada.");

  if (current.leader_id) {
    const [enriched] = await enrichFounderRows(sb, [current]);
    return enriched;
  }

  const leaderId = await resolveLeaderIdByEmail(sb, current.email);
  if (!leaderId) {
    throw new Error(
      "Nenhum terreiro encontrado com este e-mail. Crie o terreiro no console ou confira o e-mail da inscrição."
    );
  }

  return updateFounderApplication(sb, id, { leader_id: leaderId });
}

export async function updateFounderApplication(
  sb: SupabaseClient,
  id: string,
  patch: FounderApplicationPatch
): Promise<FounderApplicationRow> {
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.leader_id !== undefined) update.leader_id = patch.leader_id;

  if (Object.keys(update).length === 0) {
    const row = await getFounderApplicationById(sb, id);
    if (!row) throw new Error("Inscrição não encontrada.");
    return row;
  }

  const { data, error } = await sb
    .from("founder_applications")
    .update(update)
    .eq("id", id)
    .select(FOUNDER_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este terreiro já está vinculado a outra inscrição activa do Programa Fundador.");
    }
    throw error;
  }
  if (!data) throw new Error("Inscrição não encontrada.");
  const [row] = await enrichFounderRows(sb, [data as FounderApplicationRow]);
  return row;
}

/** @deprecated Use updateFounderApplication */
export async function updateFounderApplicationStatus(
  sb: SupabaseClient,
  id: string,
  status: FounderStatus
): Promise<FounderApplicationRow> {
  return updateFounderApplication(sb, id, { status });
}
