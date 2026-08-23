import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { apiReadRateLimit, sensitiveActionRateLimit } from "./rateLimit.js";
import { assertZeladorOrGlobalAdmin, normalizeQueryTenantId } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

const RESOURCE_TYPES = new Set([
  "patrimonio",
  "documentos",
  "consulentes",
  "atendimentos",
  "caminhada",
  "liturgico",
  "desenvolvimento",
  "camarinha",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_BUCKET = "biblioteca_estudos";
const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type Deps = { supabaseAdmin: SupabaseClient };

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
}

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function nullableDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > 12_000) throw new Error("Dados complementares muito extensos.");
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  delete parsed.__proto__;
  delete parsed.constructor;
  delete parsed.prototype;
  return parsed;
}

function safeStorageName(value: unknown): string {
  const raw = String(value || "arquivo").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const extension = raw.includes(".") ? `.${raw.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  const basename = raw.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "arquivo";
  return `${basename}${extension.slice(0, 10)}`;
}

function documentStoragePath(metadata: unknown, tenantId: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const path = text((metadata as Record<string, unknown>).storage_path, 500).replace(/\\/g, "/");
  return path.startsWith(`${tenantId}/gestao-documentos/`) ? path : null;
}

async function withSignedDocumentUrl(sb: SupabaseClient, item: Record<string, unknown>, tenantId: string) {
  const metadata = safeMetadata(item.metadata);
  const path = documentStoragePath(metadata, tenantId);
  if (!path) return item;
  const { data } = await sb.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 3600);
  return { ...item, metadata: { ...metadata, arquivo_url: data?.signedUrl || null } };
}

function parseRecord(body: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  if (!partial || "titulo" in body) {
    const titulo = text(body.titulo, 160);
    if (titulo.length < 2) throw new Error("Informe um título com pelo menos 2 caracteres.");
    out.titulo = titulo;
  }
  if (!partial || "descricao" in body) out.descricao = text(body.descricao, 5_000) || null;
  if (!partial || "status" in body) out.status = text(body.status || "ativo", 40) || "ativo";
  if (!partial || "data_inicio" in body) out.data_inicio = nullableDate(body.data_inicio);
  if (!partial || "data_fim" in body) out.data_fim = nullableDate(body.data_fim);
  if (!partial || "filho_id" in body) {
    const filhoId = text(body.filho_id, 40);
    if (filhoId && !UUID_RE.test(filhoId)) throw new Error("Membro vinculado inválido.");
    out.filho_id = filhoId || null;
  }
  if (!partial || "valor" in body) {
    const valor = body.valor == null || body.valor === "" ? null : Number(body.valor);
    if (valor != null && (!Number.isFinite(valor) || valor < 0 || valor > 999_999_999)) {
      throw new Error("Valor inválido.");
    }
    out.valor = valor;
  }
  if (!partial || "metadata" in body) out.metadata = safeMetadata(body.metadata);
  const start = out.data_inicio as string | null | undefined;
  const end = out.data_fim as string | null | undefined;
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
    throw new Error("A data final não pode ser anterior à data inicial.");
  }
  return out;
}

async function requireManager(sb: SupabaseClient, req: Request, res: Response, rawTenantId: unknown) {
  const user = await requireAuthOrRespond(sb, req, res);
  if (!user) return null;
  const tenantId = normalizeQueryTenantId(rawTenantId);
  if (!UUID_RE.test(tenantId)) {
    res.status(400).json({ error: "tenantId inválido." });
    return null;
  }
  if (!(await assertZeladorOrGlobalAdmin(sb, user, tenantId))) {
    res.status(403).json({ error: "Acesso negado." });
    return null;
  }
  return { user, tenantId };
}

async function buildReports(sb: SupabaseClient, tenantId: string) {
  const scope = `tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`;
  const today = new Date().toISOString().slice(0, 10);
  const [children, finance, calendar, inventory, advanced] = await Promise.all([
    sb.from("filhos_de_santo").select("id,status").or(scope),
    sb.from("financeiro").select("tipo,valor,status,categoria,data").or(scope).limit(2_000),
    sb.from("calendario_axe").select("id,tipo,data").or(scope).gte("data", today).limit(500),
    sb.from("almoxarifado").select("id,quantidade_atual,quantidade_minima").or(scope).limit(1_000),
    sb.from("gestao_registros").select("tipo,status,data_inicio,data_fim,valor").eq("tenant_id", tenantId).limit(2_000),
  ]);
  const financeRows = finance.data || [];
  const receitas = financeRows
    .filter((row) => ["entrada", "receita"].includes(String(row.tipo || "").toLowerCase()))
    .reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const despesas = financeRows
    .filter((row) => ["saida", "saída", "despesa"].includes(String(row.tipo || "").toLowerCase()))
    .reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const mensalidadesPendentes = financeRows.filter(
    (row) => String(row.categoria || "").toLowerCase() === "mensalidade" &&
      !["pago", "paid", "confirmado"].includes(String(row.status || "").toLowerCase()),
  ).length;
  const advancedRows = advanced.data || [];
  const moduleCounts = Object.fromEntries(
    [...RESOURCE_TYPES].map((kind) => [kind, advancedRows.filter((row) => row.tipo === kind).length]),
  );
  const now = Date.now();
  const inThirtyDays = now + 30 * 86_400_000;
  const normalizedStatus = (row: { status?: unknown }) => String(row.status || '').trim().toLocaleLowerCase('pt-BR');
  const dateTime = (value: unknown) => {
    const time = value ? new Date(String(value)).getTime() : Number.NaN;
    return Number.isFinite(time) ? time : null;
  };
  const openStatuses = new Set(['agendado', 'confirmado', 'retorno']);
  const upcomingAppointments = advancedRows.filter((row) => {
    const start = dateTime(row.data_inicio);
    return row.tipo === 'atendimentos' && openStatuses.has(normalizedStatus(row)) && start != null && start >= now && start <= inThirtyDays;
  }).length;
  const followUps = advancedRows.filter((row) => row.tipo === 'atendimentos' && normalizedStatus(row) === 'retorno').length;
  const documentDeadlines = advancedRows.filter((row) => {
    const end = dateTime(row.data_fim);
    return row.tipo === 'documentos' && !['arquivado'].includes(normalizedStatus(row)) && end != null && end <= inThirtyDays;
  }).length;
  const maintenanceItems = advancedRows.filter((row) => row.tipo === 'patrimonio' && normalizedStatus(row) === 'manutenção').length;
  const activeFormation = advancedRows.filter((row) =>
    ['caminhada', 'desenvolvimento', 'camarinha'].includes(String(row.tipo || '')) &&
    ['em andamento', 'em recolhimento'].includes(normalizedStatus(row)),
  ).length;
  return {
    activeChildren: (children.data || []).filter((row) => !["inativo", "desligado", "falecido"].includes(String(row.status || "").toLowerCase())).length,
    upcomingEvents: (calendar.data || []).length,
    upcomingObligations: (calendar.data || []).filter((row) => String(row.tipo || "").toLowerCase().includes("obriga")).length,
    lowStock: (inventory.data || []).filter((row) => Number(row.quantidade_atual || 0) <= Number(row.quantidade_minima || 0)).length,
    receitas,
    despesas,
    saldo: receitas - despesas,
    mensalidadesPendentes,
    moduleCounts,
    attention: {
      upcomingAppointments,
      followUps,
      documentDeadlines,
      maintenanceItems,
      activeFormation,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function registerAdvancedManagementRoutes(app: Express, { supabaseAdmin: sb }: Deps) {
  app.get("/api/v1/gestao/:resource", apiReadRateLimit, async (req, res) => {
    try {
      const resource = text(req.params.resource, 40);
      const scope = await requireManager(sb, req, res, req.query.tenantId);
      if (!scope) return;
      if (resource === "relatorios") return res.json({ report: await buildReports(sb, scope.tenantId) });
      if (!RESOURCE_TYPES.has(resource)) return res.status(404).json({ error: "Módulo não encontrado." });
      const { data, error } = await sb
        .from("gestao_registros")
        .select("id,tipo,titulo,descricao,status,data_inicio,data_fim,filho_id,valor,metadata,created_at,updated_at")
        .eq("tenant_id", scope.tenantId)
        .eq("tipo", resource)
        .order("data_inicio", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const items = resource === "documentos"
        ? await Promise.all((data || []).map((item) => withSignedDocumentUrl(sb, item, scope.tenantId)))
        : data || [];
      return res.json({ items });
    } catch (error: unknown) {
      console.error("[gestao/get]", error);
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar módulo.") });
    }
  });

  app.post("/api/v1/gestao/:resource", sensitiveActionRateLimit, async (req, res) => {
    try {
      const resource = text(req.params.resource, 40);
      if (!RESOURCE_TYPES.has(resource)) return res.status(404).json({ error: "Módulo não encontrado." });
      const body = bodyOf(req);
      const scope = await requireManager(sb, req, res, body.tenantId);
      if (!scope) return;
      const payload = parseRecord(body);
      const { data, error } = await sb.from("gestao_registros").insert({
        ...payload,
        tenant_id: scope.tenantId,
        tipo: resource,
        criado_por: scope.user.id,
      }).select("*").single();
      if (error) throw error;
      return res.status(201).json({ item: data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      const validation = message.includes("Informe") || message.includes("inválid");
      return res.status(validation ? 400 : 500).json({ error: validation ? message : safeErrorMessage(error, "Erro ao criar registro.") });
    }
  });

  app.post("/api/v1/gestao/documentos/upload-url", sensitiveActionRateLimit, async (req, res) => {
    try {
      const body = bodyOf(req);
      const scope = await requireManager(sb, req, res, body.tenantId);
      if (!scope) return;
      const fileName = text(body.fileName, 180);
      const contentType = text(body.contentType, 150).toLowerCase();
      const fileSize = Number(body.fileSize || 0);
      const extension = fileName.split(".").pop()?.toLowerCase() || "";
      if (!fileName || !DOCUMENT_MIME_TYPES.has(contentType) || DOCUMENT_MIME_BY_EXTENSION[extension] !== contentType) {
        return res.status(400).json({ error: "Envie um arquivo PDF, Word, JPG, PNG ou WebP." });
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > DOCUMENT_MAX_BYTES) {
        return res.status(400).json({ error: "O arquivo deve ter no máximo 20 MB." });
      }
      const path = `${scope.tenantId}/gestao-documentos/${Date.now()}-${crypto.randomUUID()}-${safeStorageName(fileName)}`;
      const { data, error } = await sb.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return res.json({ bucket: DOCUMENT_BUCKET, path, token: data.token, contentType });
    } catch (error: unknown) {
      console.error("[gestao/documentos/upload-url]", error);
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao preparar o envio do documento.") });
    }
  });

  app.all("/api/v1/gestao/:resource/:id", sensitiveActionRateLimit, async (req, res) => {
    if (req.method !== "PATCH" && req.method !== "DELETE") return res.status(405).json({ error: "Método não permitido." });
    try {
      const resource = text(req.params.resource, 40);
      const id = text(req.params.id, 40);
      if (!RESOURCE_TYPES.has(resource) || !UUID_RE.test(id)) return res.status(400).json({ error: "Registro inválido." });
      const body = bodyOf(req);
      const scope = await requireManager(sb, req, res, body.tenantId || req.query.tenantId);
      if (!scope) return;
      if (req.method === "DELETE") {
        const { data: existing } = resource === "documentos"
          ? await sb.from("gestao_registros").select("metadata").eq("id", id).eq("tenant_id", scope.tenantId).eq("tipo", resource).maybeSingle()
          : { data: null };
        const { error } = await sb.from("gestao_registros").delete().eq("id", id).eq("tenant_id", scope.tenantId).eq("tipo", resource);
        if (error) throw error;
        const oldPath = documentStoragePath(existing?.metadata, scope.tenantId);
        if (oldPath) await sb.storage.from(DOCUMENT_BUCKET).remove([oldPath]);
        return res.json({ success: true });
      }
      const payload = parseRecord(body, true);
      const { data: existing } = resource === "documentos" && payload.metadata
        ? await sb.from("gestao_registros").select("metadata").eq("id", id).eq("tenant_id", scope.tenantId).eq("tipo", resource).maybeSingle()
        : { data: null };
      const { data, error } = await sb.from("gestao_registros").update(payload)
        .eq("id", id).eq("tenant_id", scope.tenantId).eq("tipo", resource).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Registro não encontrado." });
      const oldPath = documentStoragePath(existing?.metadata, scope.tenantId);
      const newPath = documentStoragePath(data.metadata, scope.tenantId);
      if (oldPath && newPath && oldPath !== newPath) await sb.storage.from(DOCUMENT_BUCKET).remove([oldPath]);
      return res.json({ item: resource === "documentos" ? await withSignedDocumentUrl(sb, data, scope.tenantId) : data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      const validation = message.includes("inválid");
      return res.status(validation ? 400 : 500).json({ error: validation ? message : safeErrorMessage(error, "Erro ao atualizar registro.") });
    }
  });
}
