import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

import { applyDiscreteRouteCors } from "./corsOrigins.js";
import { filhoLoginRateLimit } from "./rateLimit.js";
import { isValidUuid } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

dotenv.config();

const viteEnv = (import.meta as any).env || {};

function getServerEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key] || viteEnv[key];
    if (value) return value;
  }
  return undefined;
}

const SUPABASE_URL = getServerEnv("VITE_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getServerEnv(
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY"
);

const supabaseAdmin: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(body));
}

function generateFilhoPassword(): string {
  return `Axe-${randomBytes(12).toString("base64url")}`;
}

async function findChildByIdPrefix(
  sb: SupabaseClient,
  childIdInput: string
): Promise<{ child: any | null; ambiguous: boolean }> {
  const childId = String(childIdInput || "").trim();
  if (isValidUuid(childId)) {
    const { data, error } = await sb
      .from("filhos_de_santo")
      .select("id, cpf, user_id, nome")
      .eq("id", childId)
      .maybeSingle();
    if (error) throw error;
    return { child: data, ambiguous: false };
  }

  const prefix = childId.toLowerCase().replace(/-/g, "");
  if (prefix.length < 8) return { child: null, ambiguous: false };

  const { data, error } = await sb
    .from("filhos_de_santo")
    .select("id, cpf, user_id, nome")
    .ilike("id", `${prefix.slice(0, 8)}%`)
    .limit(5);
  if (error) throw error;

  const rows = data || [];
  const matches = rows.filter((c) => String(c.id || "").toLowerCase().startsWith(prefix));
  if (matches.length === 1) return { child: matches[0], ambiguous: false };
  if (matches.length > 1) return { child: null, ambiguous: true };
  return { child: null, ambiguous: false };
}

export async function handleFilhoLoginRoute(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  await new Promise<void>((resolve, reject) => {
    filhoLoginRateLimit(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
  }).catch(() => undefined);
  if (res.headersSent) return;

  if (!supabaseAdmin) {
    return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    let { childId, cpfPrefix } = body as { childId?: string; cpfPrefix?: string };

    childId = String(childId || "").trim();
    cpfPrefix = String(cpfPrefix || "").replace(/\D/g, "");

    if (!childId || cpfPrefix.length !== 4) {
      return sendJson(res, 400, { error: "ID e os 4 primeiros dígitos do CPF são obrigatórios." });
    }

    if (childId.includes("-")) {
      const parts = childId.split("-");
      childId = parts[parts.length - 1];
    }

    const { child, ambiguous } = await findChildByIdPrefix(supabaseAdmin, childId);
    if (ambiguous) {
      return sendJson(res, 409, { error: "ID ambíguo. Informe o UUID completo do filho." });
    }
    if (!child) {
      return sendJson(res, 404, { error: "Filho de santo não encontrado com este ID." });
    }

    if (!child.cpf) {
      return sendJson(res, 400, { error: "Este filho de santo não possui CPF cadastrado." });
    }

    const cleanCpf = String(child.cpf).replace(/\D/g, "");
    if (!cleanCpf.startsWith(cpfPrefix)) {
      return sendJson(res, 401, { error: "CPF incorreto." });
    }

    const fakeEmail = `f_${child.id}@axecloud.internal`;
    const generatedPassword = generateFilhoPassword();
    let authUser: any = null;

    if (child.user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(child.user_id);
      if (userData?.user) authUser = userData.user;
    }

    if (!authUser) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      authUser = (usersData?.users || []).find((u: any) => u.email === fakeEmail);
    }

    if (authUser) {
      const updateFields: any = {
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { nome: child.nome, role: "filho" },
      };

      if (authUser.email !== fakeEmail) {
        updateFields.email = fakeEmail;
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, updateFields);
      if (updateError) throw updateError;

      if (child.user_id !== authUser.id) {
        await supabaseAdmin.from("filhos_de_santo").update({ user_id: authUser.id }).eq("id", child.id);
      }

      return sendJson(res, 200, { email: fakeEmail, password: generatedPassword });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { nome: child.nome, role: "filho" },
    });

    if (createError) throw createError;

    await supabaseAdmin.from("filhos_de_santo").update({ user_id: newUser.user.id }).eq("id", child.id);

    return sendJson(res, 200, { email: fakeEmail, password: generatedPassword });
  } catch (error: any) {
    console.error("[AUTH] Erro no Login do Filho:", error);
    return sendJson(res, 500, { error: safeErrorMessage(error, "Erro ao processar login.") });
  }
}
