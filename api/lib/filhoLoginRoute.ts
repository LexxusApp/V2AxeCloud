import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

import { applyDiscreteRouteCors } from "./corsOrigins.js";
import {
  clearFilhoLoginFailures,
  filhoLoginIsLocked,
  recordFilhoLoginFailure,
} from "./filhoLoginGuard.js";
import { filhoLoginRateLimit } from "./rateLimit.js";
import {
  filhoLoginRateLimitKey,
  isValidFilhoLoginId,
  parseFilhoLoginId,
} from "../../lib/filhoMatricula.js";
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
const SUPABASE_ANON_KEY = getServerEnv(
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
);

const supabaseAdmin: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const FILHO_LOGIN_DENIED = "Registro ou CPF incorretos.";
const CPF_PREFIX_LEN = 6;
const LEGACY_ID_PREFIX_LEN = 12;

function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(body));
}

function generateFilhoPassword(): string {
  return `Axe-${randomBytes(12).toString("base64url")}`;
}

function matriculaEntryYear(dataEntrada: string | null | undefined): number | null {
  if (!dataEntrada) return null;
  const year = new Date(String(dataEntrada)).getFullYear();
  return Number.isFinite(year) ? year : null;
}

async function filterMatchesByMatriculaYear(
  sb: SupabaseClient,
  matches: Array<{ id: string }>,
  matriculaYear: number
): Promise<Array<{ id: string; cpf: string | null; user_id: string | null; nome: string | null }>> {
  if (!matches.length) return [];

  const { data: rows, error } = await sb
    .from("filhos_de_santo")
    .select("id, data_entrada")
    .in(
      "id",
      matches.map((m) => m.id)
    );
  if (error) throw error;

  const yearOk = new Set(
    (rows || [])
      .filter((row) => matriculaEntryYear(row.data_entrada) === matriculaYear)
      .map((row) => row.id)
  );
  return matches.filter((m) => yearOk.has(m.id)) as Array<{
    id: string;
    cpf: string | null;
    user_id: string | null;
    nome: string | null;
  }>;
}

async function findChildByIdPrefix(
  sb: SupabaseClient,
  childIdInput: string,
  cpfPrefix: string
): Promise<{ child: any | null; ambiguous: boolean }> {
  const parsed = parseFilhoLoginId(childIdInput);
  const cpfDigits = String(cpfPrefix || "").replace(/\D/g, "");
  if (!parsed) return { child: null, ambiguous: false };

  if (parsed.kind === "uuid") {
    const lookupId = parsed.uuidPrefix;
    const { data, error } = await sb
      .from("filhos_de_santo")
      .select("id, cpf, user_id, nome")
      .eq("id", lookupId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { child: null, ambiguous: false };
    const cleanCpf = String(data.cpf || "").replace(/\D/g, "");
    if (!cleanCpf.startsWith(cpfDigits)) return { child: null, ambiguous: false };
    return { child: data, ambiguous: false };
  }

  const prefix = parsed.uuidPrefix.replace(/-/g, "");
  const minPrefixLen = parsed.kind === "prefix" ? LEGACY_ID_PREFIX_LEN : 4;
  if (prefix.length < minPrefixLen) return { child: null, ambiguous: false };

  const { data, error } = await sb.rpc("find_filhos_for_login", {
    p_id_prefix: prefix,
    p_cpf_prefix: cpfDigits,
  });
  if (error) throw error;

  let matches = data || [];
  if (parsed.kind === "matricula" && parsed.matriculaYear) {
    matches = await filterMatchesByMatriculaYear(sb, matches, parsed.matriculaYear);
  }

  if (matches.length === 1) return { child: matches[0], ambiguous: false };
  if (matches.length > 1) return { child: null, ambiguous: true };
  return { child: null, ambiguous: false };
}

function legacyFilhoEmails(child: { id: string }, childIdShort: string): string[] {
  const id = String(child.id || "");
  const short = String(childIdShort || id.substring(0, 4)).toLowerCase();
  return [
    `f_${id}@axecloud.internal`,
    `filho_${short}@axecloud.com`,
    `filho_${id}@axecloud.com`,
  ];
}

async function findAuthUserByEmail(sb: SupabaseClient, email: string): Promise<any | null> {
  const target = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = (data?.users ?? []).find((u) => (u.email || "").toLowerCase() === target);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function resolveFilhoAuthUser(
  sb: SupabaseClient,
  child: { id: string; user_id?: string | null; nome?: string | null },
  childIdShort: string
): Promise<any | null> {
  const emails = legacyFilhoEmails(child, childIdShort);

  if (child.user_id) {
    const { data: userData } = await sb.auth.admin.getUserById(child.user_id);
    if (userData?.user) return userData.user;
  }

  for (const email of emails) {
    const byEmail = await findAuthUserByEmail(sb, email);
    if (byEmail) return byEmail;
  }
  return null;
}

/** perfil_lider fantasma ("Meu Terreiro") quebra ACL de filho — remove no login. */
async function cleanupShadowFilhoPerfilLider(sb: SupabaseClient, userId: string): Promise<void> {
  if (!userId) return;
  try {
    await sb
      .from("perfil_lider")
      .delete()
      .eq("id", userId)
      .eq("nome_terreiro", "Meu Terreiro");
  } catch {
    /* best-effort */
  }
}

async function issueFilhoSession(
  email: string,
  password: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase anon key não configurada no servidor.");
  }
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw error || new Error("Falha ao criar sessão do filho.");
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in ?? 3600,
    token_type: data.session.token_type ?? "bearer",
  };
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

  let childIdRaw = "";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    let { childId, cpfPrefix } = body as { childId?: string; cpfPrefix?: string };

    const childIdStr = String(childId || "").trim();
    childIdRaw = filhoLoginRateLimitKey(childIdStr);
    cpfPrefix = String(cpfPrefix || "").replace(/\D/g, "");

    if (!childIdStr || cpfPrefix.length !== CPF_PREFIX_LEN) {
      return sendJson(res, 400, {
        error: `Registro (AXC-ANO-CÓDIGO) e os ${CPF_PREFIX_LEN} primeiros dígitos do CPF são obrigatórios.`,
      });
    }

    if (!isValidFilhoLoginId(childIdStr)) {
      return sendJson(res, 400, {
        error: "Informe o registro completo (ex.: AXC-2021-B2CA).",
      });
    }

    // #region agent log
    fetch('http://127.0.0.1:7309/ingest/95de0aad-8532-45db-9a8e-839f8db87925',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'37bbb6'},body:JSON.stringify({sessionId:'37bbb6',location:'filhoLoginRoute.ts:parse',message:'filho login id parsed',data:{kind:parseFilhoLoginId(childIdStr)?.kind,rateKey:childIdRaw},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    if (filhoLoginIsLocked(childIdRaw, req)) {
      return sendJson(res, 429, {
        error: "Muitas tentativas incorretas para este ID. Aguarde 30 minutos.",
      });
    }

    const { child, ambiguous } = await findChildByIdPrefix(supabaseAdmin, childIdStr, cpfPrefix);
    // #region agent log
    fetch('http://127.0.0.1:7309/ingest/95de0aad-8532-45db-9a8e-839f8db87925',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'37bbb6'},body:JSON.stringify({sessionId:'37bbb6',location:'filhoLoginRoute.ts:lookup',message:'filho login lookup',data:{found:!!child,ambiguous},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    if (ambiguous) {
      recordFilhoLoginFailure(childIdRaw, req);
      return sendJson(res, 401, { error: FILHO_LOGIN_DENIED });
    }
    if (!child) {
      recordFilhoLoginFailure(childIdRaw, req);
      return sendJson(res, 401, { error: FILHO_LOGIN_DENIED });
    }

    if (!child.cpf) {
      return sendJson(res, 400, { error: "Este filho de santo não possui CPF cadastrado." });
    }

    const cleanCpf = String(child.cpf).replace(/\D/g, "");
    if (!cleanCpf.startsWith(cpfPrefix)) {
      recordFilhoLoginFailure(childIdRaw, req);
      return sendJson(res, 401, { error: FILHO_LOGIN_DENIED });
    }

    clearFilhoLoginFailures(childIdRaw, req);

    const fakeEmail = `f_${child.id}@axecloud.internal`;
    const generatedPassword = generateFilhoPassword();
    const authUser = await resolveFilhoAuthUser(supabaseAdmin, child, childIdRaw);

    if (authUser) {
      const updateFields: any = {
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { nome: child.nome, role: "filho" },
      };

      if (String(authUser.email || "").toLowerCase() !== fakeEmail) {
        updateFields.email = fakeEmail;
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, updateFields);
      if (updateError) throw updateError;

      if (child.user_id !== authUser.id) {
        await supabaseAdmin.from("filhos_de_santo").update({ user_id: authUser.id }).eq("id", child.id);
      }

      await cleanupShadowFilhoPerfilLider(supabaseAdmin, authUser.id);

      const session = await issueFilhoSession(fakeEmail, generatedPassword);
      return sendJson(res, 200, session);
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { nome: child.nome, role: "filho" },
    });

    if (createError) {
      const msg = String(createError.message || "").toLowerCase();
      if (msg.includes("already")) {
        const recovered = await resolveFilhoAuthUser(supabaseAdmin, child, childIdRaw);
        if (recovered) {
          const { error: retryUpdateError } = await supabaseAdmin.auth.admin.updateUserById(recovered.id, {
            password: generatedPassword,
            email: fakeEmail,
            email_confirm: true,
            user_metadata: { nome: child.nome, role: "filho" },
          });
          if (retryUpdateError) throw retryUpdateError;
          await supabaseAdmin.from("filhos_de_santo").update({ user_id: recovered.id }).eq("id", child.id);
          await cleanupShadowFilhoPerfilLider(supabaseAdmin, recovered.id);
          const session = await issueFilhoSession(fakeEmail, generatedPassword);
          return sendJson(res, 200, session);
        }
      }
      throw createError;
    }

    await supabaseAdmin.from("filhos_de_santo").update({ user_id: newUser.user.id }).eq("id", child.id);

    await cleanupShadowFilhoPerfilLider(supabaseAdmin, newUser.user.id);

    const session = await issueFilhoSession(fakeEmail, generatedPassword);
    return sendJson(res, 200, session);
  } catch (error: any) {
    console.error("[AUTH] Erro no Login do Filho:", error);
    return sendJson(res, 500, { error: safeErrorMessage(error, "Erro ao processar login.") });
  }
}
