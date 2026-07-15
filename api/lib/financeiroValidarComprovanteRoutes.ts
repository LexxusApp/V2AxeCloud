import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { requireAuthOrRespond } from "./requireAuth.js";
import {
  assertUserCanAccessTenant,
  normalizeFilhoRequestTenantId,
  normalizeQueryTenantId,
} from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";
import { comprovanteVisionRateLimit } from "./rateLimit.js";
import {
  extractComprovanteFieldsFromImage,
  normalizeCpfDigits,
  valoresMensalidadeCoincidem,
} from "./comprovanteVisionExtract.js";
import {
  comprovanteBeneficiarioMatches,
  isComprovanteDateCompatible,
  normalizeComprovanteDate,
  normalizeComprovanteTransactionId,
} from "./comprovanteValidation.js";

type LiquidarFn = (
  supabaseAdmin: SupabaseClient,
  resolveLeaderId: (id: string) => Promise<string>,
  userId: string,
  tenantId: string,
  financeiroId: string,
  valorOverride?: number
) => Promise<{ ok: true }>;

type Deps = {
  supabaseAdmin: SupabaseClient;
  resolveLeaderId: (id: string) => Promise<string>;
  liquidarMensalidadePendente: LiquidarFn;
  notifyMensalidadeConfirmadaWhatsApp: (
    sb: SupabaseClient,
    args: {
      tenantId: string;
      zeladorId: string;
      filhoId: string;
      nome: string;
      valor: number;
      competencia: string;
    }
  ) => Promise<void>;
};

type FilhoRow = {
  id: string;
  nome: string | null;
  cpf: string | null;
  tenant_id: string | null;
  lider_id: string | null;
  user_id: string | null;
  email: string | null;
};

type FinanceiroMensalidadeRow = {
  id: string;
  valor: number;
  status: string | null;
  categoria: string | null;
  filho_id: string | null;
  descricao: string | null;
  tenant_id: string | null;
  lider_id: string | null;
  data: string | null;
  data_vencimento: string | null;
};

function extractFilhoIdFromDescricao(descricao: string | null | undefined): string | null {
  const m = String(descricao || "").match(/\(ID:([0-9a-fA-F-]{36})\)/);
  return m ? m[1].toLowerCase() : null;
}

function deriveFilhoId(row: FinanceiroMensalidadeRow): string | null {
  const direct = row.filho_id;
  if (direct != null && String(direct).trim() !== "") return String(direct).trim().toLowerCase();
  return extractFilhoIdFromDescricao(row.descricao);
}

async function loadFilhoRecordForUser(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<FilhoRow | null> {
  const selectCols = "id, nome, cpf, tenant_id, lider_id, user_id, email";

  let { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select(selectCols)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!child && user.email) {
    const { data: emailChild } = await supabaseAdmin
      .from("filhos_de_santo")
      .select(selectCols)
      .ilike("email", String(user.email).trim().toLowerCase())
      .maybeSingle();
    child = emailChild;
  }

  if (!child) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(user.id);
      const email = String(data?.user?.email || "").trim().toLowerCase();
      if (email) {
        const { data: emailChild } = await supabaseAdmin
          .from("filhos_de_santo")
          .select(selectCols)
          .ilike("email", email)
          .maybeSingle();
        child = emailChild;
      }
    } catch {
      /* ignore */
    }
  }

  return (child as FilhoRow | null) ?? null;
}

async function findPendingMensalidadeForFilho(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  resolvedTenant: string,
  filhoId: string,
  valorEsperado: number,
  paymentDate: string
): Promise<FinanceiroMensalidadeRow | null> {
  const { data, error } = await supabaseAdmin
    .from("financeiro")
    .select("id, valor, status, categoria, filho_id, descricao, tenant_id, lider_id, data, data_vencimento")
    .eq("categoria", "Mensalidade")
    .eq("status", "pendente")
    .or(
      [
        `tenant_id.eq.${tenantId}`,
        `tenant_id.eq.${resolvedTenant}`,
        `lider_id.eq.${tenantId}`,
        `lider_id.eq.${resolvedTenant}`,
      ].join(",")
    );

  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("status") && (msg.includes("does not exist") || msg.includes("schema cache"))) {
      return null;
    }
    throw error;
  }

  const rows = (data || []) as FinanceiroMensalidadeRow[];
  const matches = rows.filter((row) => {
    const fid = deriveFilhoId(row);
    if (fid !== filhoId) return false;
    if (!valoresMensalidadeCoincidem(Number(row.valor) || 0, valorEsperado)) return false;
    const competenceDate = String(row.data_vencimento || row.data || "").slice(0, 10);
    return isComprovanteDateCompatible(paymentDate, competenceDate);
  });

  if (matches.length === 0) return null;
  matches.sort((a, b) =>
    String(a.data_vencimento || a.data || "").localeCompare(String(b.data_vencimento || b.data || ""))
  );
  return matches[0];
}

function readImageBufferFromRequest(req: Request): { buffer: Buffer; contentType: string } | null {
  const body = (req.body || {}) as Record<string, unknown>;
  const fileData = body.fileData ?? body.image ?? body.comprovante;
  if (fileData != null && String(fileData).trim() !== "") {
    const raw = String(fileData);
    const base64 = raw.includes(",") ? raw.split(",").pop()! : raw;
    const buffer = Buffer.from(base64, "base64");
    const contentType = String(body.contentType || body.mimeType || "image/jpeg");
    return { buffer, contentType };
  }

  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    const contentType = String(req.headers["content-type"] || "image/jpeg");
    return { buffer: req.body, contentType };
  }

  return null;
}

export function registerFinanceiroValidarComprovanteRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin, resolveLeaderId, liquidarMensalidadePendente, notifyMensalidadeConfirmadaWhatsApp } =
    deps;

  app.post(
    "/api/v1/financeiro/validar-comprovante",
    comprovanteVisionRateLimit,
    async (req: Request, res: Response) => {
      try {
        const user = await requireAuthOrRespond(supabaseAdmin, req, res);
        if (!user) return;

        const filho = await loadFilhoRecordForUser(supabaseAdmin, user);
        if (!filho?.id) {
          return res.status(403).json({
            success: false,
            error: "Apenas filhos de santo podem enviar comprovante de mensalidade.",
          });
        }

        const body = (req.body || {}) as Record<string, unknown>;
        let tenantId = normalizeQueryTenantId(body.tenant_id ?? body.tenantId);
        if (!tenantId) {
          tenantId = String(filho.lider_id || filho.tenant_id || "").trim();
        }
        tenantId = await normalizeFilhoRequestTenantId(supabaseAdmin, user, tenantId);
        if (!tenantId) {
          return res.status(400).json({ error: "tenant_id é obrigatório." });
        }

        const canAccess = await assertUserCanAccessTenant(supabaseAdmin, user, tenantId);
        if (!canAccess) {
          return res.status(403).json({ error: "Acesso negado a este terreiro." });
        }

        const imagePayload = readImageBufferFromRequest(req);
        if (!imagePayload) {
          return res.status(400).json({ error: "Envie a imagem do comprovante (fileData em base64)." });
        }

        const arquivoSha256 = createHash("sha256").update(imagePayload.buffer).digest("hex");
        const { data: usedFile, error: usedFileError } = await supabaseAdmin
          .from("financeiro_comprovantes")
          .select("id")
          .eq("arquivo_sha256", arquivoSha256)
          .maybeSingle();
        if (usedFileError) throw usedFileError;
        if (usedFile) {
          return res.status(409).json({
            success: false,
            error: "Este comprovante já foi utilizado para confirmar uma mensalidade.",
          });
        }

        const extracted = await extractComprovanteFieldsFromImage(
          imagePayload.buffer,
          imagePayload.contentType
        );

        const filhoCpf = normalizeCpfDigits(filho.cpf || "");
        const extractedCpf = normalizeCpfDigits(extracted.cpf_pagador);
        if (filhoCpf.length !== 11) {
          return res.status(422).json({
            success: false,
            error: "Seu CPF precisa estar completo no cadastro antes da validação automática.",
          });
        }
        if (extractedCpf.length !== 11 || filhoCpf !== extractedCpf) {
          return res.status(422).json({
            success: false,
            error: "O CPF do comprovante não corresponde ao seu cadastro no terreiro.",
          });
        }

        const filhoId = String(filho.id).toLowerCase();
        const resolvedTenant = await resolveLeaderId(tenantId);
        const { data: pixConfig, error: pixConfigError } = await supabaseAdmin
          .from("configuracoes_pix")
          .select("nome_beneficiario")
          .or(`terreiro_id.eq.${resolvedTenant},terreiro_id.eq.${tenantId}`)
          .maybeSingle();
        if (pixConfigError) throw pixConfigError;
        const expectedBeneficiario = String(pixConfig?.nome_beneficiario || "").trim();
        if (!expectedBeneficiario) {
          return res.status(422).json({
            success: false,
            error: "O zelador precisa configurar o nome do beneficiário Pix antes da validação automática.",
          });
        }
        if (!comprovanteBeneficiarioMatches(expectedBeneficiario, extracted.beneficiario)) {
          return res.status(422).json({
            success: false,
            error: "O beneficiário do comprovante não corresponde ao Pix configurado pelo terreiro.",
          });
        }

        const transactionId = normalizeComprovanteTransactionId(extracted.id_transacao);
        if (transactionId.length < 10) {
          return res.status(422).json({
            success: false,
            error: "Não foi possível identificar com segurança o ID da transação no comprovante.",
          });
        }
        const paymentDate = normalizeComprovanteDate(extracted.data);
        if (!paymentDate) {
          return res.status(422).json({
            success: false,
            error: "Não foi possível identificar uma data válida no comprovante.",
          });
        }
        const pendente = await findPendingMensalidadeForFilho(
          supabaseAdmin,
          tenantId,
          resolvedTenant,
          filhoId,
          extracted.valor,
          paymentDate
        );

        if (!pendente) {
          return res.status(404).json({
            success: false,
            error:
              "Nenhuma mensalidade pendente com o valor do comprovante foi encontrada para você. Confira o valor pago e tente novamente.",
          });
        }

        const competenceDate = String(pendente.data_vencimento || pendente.data || "").slice(0, 10);
        if (!isComprovanteDateCompatible(paymentDate, competenceDate)) {
          return res.status(422).json({
            success: false,
            error: "A data do pagamento não é compatível com a mensalidade em aberto.",
          });
        }

        const zeladorActorId = String(
          pendente.lider_id || filho.lider_id || resolvedTenant || tenantId
        ).trim();

        const { data: receiptReservation, error: receiptError } = await supabaseAdmin
          .from("financeiro_comprovantes")
          .insert({
            tenant_id: resolvedTenant || tenantId,
            financeiro_id: pendente.id,
            filho_id: filhoId,
            arquivo_sha256: arquivoSha256,
            id_transacao_norm: transactionId,
            valor: extracted.valor,
            data_pagamento: paymentDate,
            beneficiario_lido: extracted.beneficiario,
          })
          .select("id")
          .single();
        if (receiptError) {
          if (receiptError.code === "23505") {
            return res.status(409).json({
              success: false,
              error: "Este comprovante ou ID de transação já foi utilizado.",
            });
          }
          throw receiptError;
        }

        try {
          await liquidarMensalidadePendente(
            supabaseAdmin,
            resolveLeaderId,
            zeladorActorId,
            tenantId,
            pendente.id,
            extracted.valor
          );
          await supabaseAdmin
            .from("financeiro_comprovantes")
            .update({ status: "aceito", accepted_at: new Date().toISOString() })
            .eq("id", receiptReservation.id);
        } catch (liquidationError) {
          await supabaseAdmin.from("financeiro_comprovantes").delete().eq("id", receiptReservation.id);
          throw liquidationError;
        }

        const filhoNome = String(filho.nome || "Filho").trim() || "Filho";
        const competencia = String(
          pendente.data_vencimento || pendente.data || paymentDate || ""
        ).slice(0, 10);

        void notifyMensalidadeConfirmadaWhatsApp(supabaseAdmin, {
          tenantId,
          zeladorId: zeladorActorId,
          filhoId,
          nome: filhoNome,
          valor: extracted.valor,
          competencia: competencia || extracted.data,
        }).catch((err) => {
          console.error("[financeiro/validar-comprovante WA]:", err?.message || err);
        });

        res.setHeader("Cache-Control", "private, no-store");
        return res.json({
          success: true,
          mensalidade_id: pendente.id,
          filho_id: filhoId,
          filho_nome: filhoNome,
          valor: extracted.valor,
          data_pagamento: paymentDate,
        });
      } catch (e: unknown) {
        console.error("[financeiro/validar-comprovante]", e);
        const msg = safeErrorMessage(e, "Erro ao validar comprovante.");
        const status =
          msg.includes("comprovante") || msg.includes("Imagem") || msg.includes("CPF") ? 422 : 500;
        return res.status(status).json({ success: false, error: msg });
      }
    }
  );
}
