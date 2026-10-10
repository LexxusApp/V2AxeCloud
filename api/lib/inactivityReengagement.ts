import type { SupabaseClient } from "@supabase/supabase-js";
import { logAndSendWhatsApp } from "./whatsappSendCore.js";
import { normalizeBrWhatsAppMsisdn } from "../../src/lib/whatsappPhone.js";

/**
 * Reengajamento humanizado de terreiros sem login recente (14+ dias de inatividade).
 * Dispara sugestões litúrgicas úteis e link direto de login, deduplicado a cada 30 dias.
 */
export async function runInactivityReengagement(
  sb: SupabaseClient,
  daysInactiveThreshold = 14
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const cutoffDate = new Date(Date.now() - daysInactiveThreshold * 24 * 60 * 60 * 1000).toISOString();
    const dedupeCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Busca terreiros ativos
    const { data: profiles, error: profErr } = await sb
      .from("perfil_lider")
      .select("id, nome_terreiro, cargo, whatsapp_publico, is_blocked")
      .eq("is_blocked", false)
      .limit(100);

    if (profErr || !profiles) return { sent, skipped, errors };

    for (const profile of profiles) {
      const tenantId = profile.id;

      // 2. Verifica se o zelador acessou recentemente
      const authUserRes = await sb.auth.admin.getUserById(tenantId).catch(() => null);
      const authUser = authUserRes?.data?.user;
      if (!authUser) {
        skipped++;
        continue;
      }

      const lastSignIn = authUser.last_sign_in_at;
      if (lastSignIn && lastSignIn > cutoffDate) {
        // Acessou recentemente
        skipped++;
        continue;
      }

      // 3. Deduplicação nos últimos 30 dias
      const { data: existingLogs } = await sb
        .from("whatsapp_logs")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("tipo", "reengajamento_inativo")
        .gte("created_at", dedupeCutoff)
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        skipped++;
        continue;
      }

      const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
      let rawPhone = String(meta.whatsapp || profile.whatsapp_publico || "").replace(/\D/g, "");
      if (!rawPhone) {
        skipped++;
        continue;
      }

      try {
        const phone = normalizeBrWhatsAppMsisdn(rawPhone);
        const nomeZelador = String(profile.cargo || meta.nome_zelador || "Zelador(a)").trim();
        const nomeTerreiro = String(profile.nome_terreiro || "Seu Terreiro").trim();

        const msg =
          `Olá, ${nomeZelador}! Axé. 🙏\n\n` +
          `Notamos que faz alguns dias que você não acessa o painel do *${nomeTerreiro}* no AxéCloud.\n\n` +
          `💡 *Dica:* Em menos de 2 minutos você pode:\n` +
          `• Agendar a próxima gira e gerar a lista de presença\n` +
          `• Consultar o mural de recados dos filhos de santo\n` +
          `• Visualizar os preceitos ativos da corrente\n\n` +
          `Se precisar de qualquer apoio ou tiver dúvidas, basta responder a esta mensagem!\n\n` +
          `Acesse seu painel: https://axecloud.com.br/entrar`;

        await logAndSendWhatsApp(sb, {
          tenantId,
          filhoId: null,
          tipo: "reengajamento_inativo",
          phone,
          message: msg,
          nomeMembro: nomeZelador,
          nomeTerreiro,
          idTerreiro: tenantId,
          variables: {
            nome_membro: nomeZelador,
            nome_terreiro: nomeTerreiro,
          },
        });

        sent++;
        console.log(`[Reengajamento WA] Enviado para ${nomeZelador} (${nomeTerreiro})`);
      } catch (childErr) {
        errors++;
        console.warn(`[Reengajamento WA] Erro tenant=${tenantId}:`, childErr);
      }
    }
  } catch (err) {
    console.error("[Reengajamento WA] Falha geral:", err);
  }

  return { sent, skipped, errors };
}
