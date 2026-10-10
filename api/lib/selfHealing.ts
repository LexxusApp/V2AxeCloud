/**
 * Sistema Autônomo de Auto-Cura (Self-Healing) do AxéCloud.
 *
 * Monitora falhas pendentes em `tenant_feature_failures`, executa reteste ativo
 * de integridade para o terreiro e módulo afetado, e auto-resolve falhas transitórias
 * (cold-starts, micro-quedas de rede e reinício de deploys) mantendo o monitor limpo
 * e alertando apenas problemas persistentes reais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeErrorMessage } from "./safeError.js";

export type TenantFailureRecord = {
  id: string;
  created_at: string;
  tenant_id: string | null;
  feature: string;
  route: string | null;
  http_status: number | null;
  source: string;
  error_message: string;
  error_fingerprint?: string | null;
  metadata?: Record<string, unknown> | null;
  resolved_at?: string | null;
};

export type SelfHealingDiagnosticResult = {
  isHealed: boolean;
  reason: string;
  diagnostic?: string;
};

export type SelfHealingTickResult = {
  ok: boolean;
  checked: number;
  resolved: number;
  persistent: number;
  results: Array<{
    id: string;
    feature: string;
    tenantId: string | null;
    isHealed: boolean;
    reason: string;
  }>;
};

/**
 * Diagnostica e verifica se a causa da falha já foi sanada ou se era transitória.
 */
export async function diagnoseAndVerifyFailure(
  sb: SupabaseClient,
  failure: TenantFailureRecord
): Promise<SelfHealingDiagnosticResult> {
  const { tenant_id, feature, route, error_message, metadata } = failure;
  const action = String(metadata?.action || route || "").trim();
  const errorMessage = String(error_message || "").toLowerCase();

  // 1. Falhas transitórias de infraestrutura (Gateway Timeout, 502, 504, rede, reinício de container)
  if (
    /gateway timeout|504|502|econnreset|socket hang up|timeout|docker:deploy/i.test(errorMessage) ||
    /gateway timeout/i.test(action)
  ) {
    try {
      const { data, error } = await sb.from("perfil_lider").select("id").limit(1);
      if (!error && data) {
        return {
          isHealed: true,
          reason: "Instabilidade transitória de container/gateway finalizada; banco e API respondendo normalmente.",
        };
      }
    } catch (e: unknown) {
      return {
        isHealed: false,
        reason: "Banco de dados ainda indisponível para diagnóstico.",
        diagnostic: safeErrorMessage(e),
      };
    }
  }

  // 2. Se a falha tiver escopo de terreiro (tenant_id)
  if (tenant_id) {
    // A) Agenda e Giras (/api/events, /api/calendario)
    if (feature === "agenda" || /events|calendario|gira/i.test(action)) {
      try {
        const { error } = await sb
          .from("calendario_axe")
          .select("id")
          .or(`tenant_id.eq.${tenant_id},lider_id.eq.${tenant_id}`)
          .limit(5);
        if (!error) {
          return {
            isHealed: true,
            reason: "Módulo de Agenda/Giras verificado com sucesso; dados e tabelas operando normalmente.",
          };
        }
        return {
          isHealed: false,
          reason: "Falha persistente ao consultar agenda: erro na consulta.",
          diagnostic: error.message || String(error),
        };
      } catch (e: unknown) {
        return {
          isHealed: false,
          reason: "Falha persistente ao consultar agenda.",
          diagnostic: safeErrorMessage(e),
        };
      }
    }

    // B) Atendimentos e Pedidos de Reza (/api/v1/atendimentos/pedidos-reza)
    if (/pedidos-reza|atendimentos/i.test(action) || (feature === "geral" && /reza/i.test(action))) {
      try {
        const { error } = await sb
          .from("pedidos_reza")
          .select("id")
          .or(`tenant_id.eq.${tenant_id},lider_id.eq.${tenant_id}`)
          .limit(5);
        if (!error) {
          return {
            isHealed: true,
            reason: "Módulo de Atendimentos/Pedidos de Reza verificado com sucesso em produção.",
          };
        }
        return {
          isHealed: false,
          reason: "Falha persistente em pedidos de reza: erro na consulta.",
          diagnostic: error.message || String(error),
        };
      } catch (e: unknown) {
        return {
          isHealed: false,
          reason: "Falha persistente em pedidos de reza.",
          diagnostic: safeErrorMessage(e),
        };
      }
    }

    // C) Membros e Filhos de Santo (/api/children, /api/filhos)
    if (feature === "membros" || /children|filhos/i.test(action)) {
      try {
        const { error } = await sb
          .from("filhos_de_santo")
          .select("id")
          .or(`tenant_id.eq.${tenant_id},lider_id.eq.${tenant_id}`)
          .limit(5);
        if (!error) {
          return {
            isHealed: true,
            reason: "Módulo de Membros e Corrente mediúnica verificado com sucesso.",
          };
        }
        return {
          isHealed: false,
          reason: "Falha persistente no módulo de membros: erro na consulta.",
          diagnostic: error.message || String(error),
        };
      } catch (e: unknown) {
        return {
          isHealed: false,
          reason: "Falha persistente no módulo de membros.",
          diagnostic: safeErrorMessage(e),
        };
      }
    }

    // D) Financeiro e Mensalidades (/api/v1/financial/*)
    if (feature === "financeiro" || /financial|mensalidades|cobranca/i.test(action)) {
      try {
        const { data, error } = await sb
          .from("perfil_lider")
          .select("id, tenant_id")
          .or(`id.eq.${tenant_id},tenant_id.eq.${tenant_id}`)
          .limit(1);
        if (!error && data && data.length > 0) {
          return {
            isHealed: true,
            reason: "Integridade financeira e identificação do terreiro validadas com sucesso.",
          };
        }
      } catch (e: unknown) {
        return {
          isHealed: false,
          reason: "Falha persistente no módulo financeiro.",
          diagnostic: safeErrorMessage(e),
        };
      }
    }

    // E) Geral, Configurações ou Acesso
    if (feature === "configuracoes" || feature === "geral" || feature === "acesso") {
      try {
        const { data, error } = await sb
          .from("perfil_lider")
          .select("id")
          .or(`id.eq.${tenant_id},tenant_id.eq.${tenant_id}`)
          .limit(1);
        if (!error && data && data.length > 0) {
          return {
            isHealed: true,
            reason: "Perfil e configuração do terreiro validados com sucesso.",
          };
        }
      } catch (e: unknown) {
        return {
          isHealed: false,
          reason: "Falha persistente no perfil do terreiro.",
          diagnostic: safeErrorMessage(e),
        };
      }
    }
  }

  // Falhas genéricas não vinculadas a um tenant específico
  if (!tenant_id && (feature === "api" || feature === "geral")) {
    try {
      const { data, error } = await sb.from("perfil_lider").select("id").limit(1);
      if (!error && data) {
        return {
          isHealed: true,
          reason: "Conexão global com o banco e API reestabelecida com sucesso.",
        };
      }
    } catch (e: unknown) {
      return {
        isHealed: false,
        reason: "Serviço geral ainda apresentando falhas.",
        diagnostic: safeErrorMessage(e),
      };
    }
  }

  return {
    isHealed: false,
    reason: "Falha requer acompanhamento ou correção específica.",
  };
}

/**
 * Executa uma rodada do ciclo autônomo de auto-cura.
 */
export async function runSelfHealingTick(
  sb: SupabaseClient,
  options?: { maxBatch?: number }
): Promise<SelfHealingTickResult> {
  const maxBatch = Math.min(50, Math.max(1, options?.maxBatch || 20));

  // Busca as falhas não resolvidas mais antigas
  const { data: failures, error } = await sb
    .from("tenant_feature_failures")
    .select("id, created_at, tenant_id, feature, route, http_status, source, error_message, metadata")
    .is("resolved_at", null)
    .order("created_at", { ascending: true })
    .limit(maxBatch);

  if (error) {
    console.error("[SELF-HEALING] Erro ao buscar falhas pendentes:", error.message);
    return { ok: false, checked: 0, resolved: 0, persistent: 0, results: [] };
  }

  if (!failures || failures.length === 0) {
    return { ok: true, checked: 0, resolved: 0, persistent: 0, results: [] };
  }

  let resolved = 0;
  let persistent = 0;
  const results: SelfHealingTickResult["results"] = [];

  const now = Date.now();

  for (const failure of failures as TenantFailureRecord[]) {
    // Permite um intervalo mínimo de 20 segundos desde a ocorrência para estabilização
    const createdAtMs = new Date(failure.created_at).getTime();
    if (now - createdAtMs < 20_000) {
      continue;
    }

    try {
      const diag = await diagnoseAndVerifyFailure(sb, failure);
      if (diag.isHealed) {
        const nowIso = new Date().toISOString();
        const updatedMeta = {
          ...(failure.metadata || {}),
          auto_healed: true,
          resolved_by: "self_healing_runner",
          resolution_reason: diag.reason,
          auto_healed_at: nowIso,
        };

        const { error: updateErr } = await sb
          .from("tenant_feature_failures")
          .update({
            resolved_at: nowIso,
            metadata: updatedMeta,
          })
          .eq("id", failure.id);

        if (!updateErr) {
          resolved++;
          results.push({
            id: failure.id,
            feature: failure.feature,
            tenantId: failure.tenant_id,
            isHealed: true,
            reason: diag.reason,
          });
          console.log(`[SELF-HEALING] Falha ${failure.id} (${failure.feature}) auto-resolvida: ${diag.reason}`);
        } else {
          console.warn(`[SELF-HEALING] Falha ao atualizar ${failure.id}:`, updateErr.message);
        }
      } else {
        persistent++;
        results.push({
          id: failure.id,
          feature: failure.feature,
          tenantId: failure.tenant_id,
          isHealed: false,
          reason: diag.reason,
        });
        console.warn(`[SELF-HEALING PERSISTENTE] Falha ${failure.id} (${failure.feature}): ${diag.reason}`);

        // Fase 2: Alerta proativo no WhatsApp de Operações (Lucas) se ainda não tiver alertado
        if (!failure.metadata?.ops_alerted_at) {
          const nowIso = new Date().toISOString();
          try {
            const { notifyOpsPersistentFailure } = await import("./opsAlertWhatsApp.js");
            void notifyOpsPersistentFailure({
              failureId: failure.id,
              feature: failure.feature,
              route: failure.route,
              error_message: failure.error_message,
              tenant_nome: (failure.metadata as any)?.terreiro_nome || null,
            });

            await sb
              .from("tenant_feature_failures")
              .update({
                metadata: {
                  ...(failure.metadata || {}),
                  ops_alerted_at: nowIso,
                  self_healing_status: "persistent_requires_code_patch",
                  last_diagnostic: diag.reason,
                },
              })
              .eq("id", failure.id);
          } catch (alertErr) {
            console.warn(`[SELF-HEALING] Erro ao disparar alerta WhatsApp:`, alertErr);
          }
        }
      }
    } catch (err: unknown) {
      persistent++;
      console.error(`[SELF-HEALING] Erro ao avaliar falha ${failure.id}:`, err);
    }
  }

  return {
    ok: true,
    checked: failures.length,
    resolved,
    persistent,
    results,
  };
}
