import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingOrUnknownTable } from "./adminConsoleAuth.js";

export const FOUNDER_STATUSES = ["pending", "contacted", "accepted", "rejected"] as const;
export type FounderStatus = (typeof FOUNDER_STATUSES)[number];

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
};

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
    .select(
      "id, created_at, nome_casa, cidade, estado, tradicao, whatsapp, nome_contato, email, mensagem, autoriza_perfil_publico, autoriza_depoimento, status"
    )
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

  return {
    available: true,
    rows: (data || []) as FounderApplicationRow[],
    notice: "",
  };
}

export async function updateFounderApplicationStatus(
  sb: SupabaseClient,
  id: string,
  status: FounderStatus
): Promise<FounderApplicationRow> {
  const { data, error } = await sb
    .from("founder_applications")
    .update({ status })
    .eq("id", id)
    .select(
      "id, created_at, nome_casa, cidade, estado, tradicao, whatsapp, nome_contato, email, mensagem, autoriza_perfil_publico, autoriza_depoimento, status"
    )
    .single();

  if (error) throw error;
  if (!data) throw new Error("Inscrição não encontrada.");
  return data as FounderApplicationRow;
}
