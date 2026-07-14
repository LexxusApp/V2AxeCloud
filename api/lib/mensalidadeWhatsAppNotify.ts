import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import { sendWhatsAppForTenant } from "./whatsappSendCore.js";

export async function notifyMensalidadeConfirmadaWhatsApp(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    zeladorId: string;
    filhoId: string;
    nome: string;
    valor: number;
    competencia: string;
  }
): Promise<void> {
  const { data: profile } = await sb
    .from("perfil_lider")
    .select("nome_terreiro")
    .eq("id", args.zeladorId)
    .maybeSingle();

  const competenciaFmt = args.competencia.includes("-")
    ? format(parseISO(args.competencia), "MM/yyyy")
    : args.competencia;

  await sendWhatsAppForTenant(sb, {
    tenantId: args.zeladorId,
    tipo: "mensalidade_confirmada",
    filhoId: args.filhoId,
    variables: {
      nome_filho: args.nome,
      valor: args.valor.toFixed(2),
      competencia: competenciaFmt,
      nome_terreiro: String(profile?.nome_terreiro || "Terreiro"),
    },
  });
}
