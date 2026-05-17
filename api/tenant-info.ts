/**
 * Rota isolada para Vercel: sem imports de /src, apenas process.env (não import.meta).
 * Planos/constantes usadas na resposta estão inline abaixo.
 *
 * CORS é aplicado inline (sem helper externo) para evitar que o bundler da Vercel
 * exclua a pasta api/_lib/ (prefix "_" não é deployado como função, e o import
 * pode falhar em runtime gerando 500).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";

dotenv.config();

// --- Valores alinhados ao app (não importar de src) ---
function consoleAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_CONSOLE_EMAILS || process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
const SHARED_TENANT_ID_SUPER = "6588b6c9-ce84-4140-a69a-f487a0c61dab";
// Slugs de plano alinhados ao app: premium, vita, cortesia (sem import de src)

/**
 * Normaliza slug do plano gravado no banco. Inline para não importar /src no bundle da Vercel.
 * Espelha src/constants/plans.ts → canonicalPlanSlug, mas restrito aos slugs ativos.
 */
function canonicalPlanSlug(plan: string | undefined | null): string {
  if (!plan) return "premium";
  const stripped = String(plan).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const p = stripped.toLowerCase().trim().replace(/\s+/g, " ");
  const compact = p.replace(/[\s_-]/g, "");
  if (p === "vita" || p === "plano vita" || compact === "planovita") return "vita";
  if (p === "cortesia" || compact === "cortesia") return "cortesia";
  if (p === "premium" || compact === "premium") return "premium";
  // Planos legados (axe/oro/free) caem em premium para manter acesso.
  return "premium";
}
function isLifetimePlanSlug(slug: string): boolean {
  return slug === "vita" || slug === "cortesia";
}

const PERFIL_LIDER_BASE_SELECT =
  "nome_terreiro, cargo, role, tenant_id, is_admin_global, is_blocked, deleted_at, foto_url";

async function fetchPerfilLiderByUserId(sb: SupabaseClient, userId: string) {
  const withTerms = `${PERFIL_LIDER_BASE_SELECT}, terms_accepted_version`;
  let res: any = await sb.from("perfil_lider").select(withTerms).eq("id", userId).maybeSingle();
  if (res.error && /terms_accepted/i.test(String(res.error.message || ""))) {
    res = await sb.from("perfil_lider").select(PERFIL_LIDER_BASE_SELECT).eq("id", userId).maybeSingle();
    if (res.data) {
      res.data = { ...res.data, terms_accepted_version: null };
    }
  }
  return res;
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVER_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVER_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVER_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export default async function handler(req: { method?: string; query?: Record<string, string | string[] | undefined>; headers?: any }, res: any) {
  if (applyDiscreteRouteCors(req as any, res)) return;
  // Fase 3: padrão sem cache; respostas 200 de perfil sobrescrevem com TTL curto.
  res.setHeader("Cache-Control", "private, no-store, must-revalidate");
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = req.query || {};
  const userId = typeof q.userId === "string" ? q.userId : Array.isArray(q.userId) ? q.userId[0] : "";
  const emailRaw = typeof q.email === "string" ? q.email : Array.isArray(q.email) ? q.email[0] : "";
  const email = (emailRaw || "").toLowerCase().trim();

  if (!userId) {
    return res.status(400).json({ error: "UserId is required" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVER_KEY || !supabaseAdmin) {
    return res.status(503).json({
      error: "Supabase não configurado na função da Vercel",
      missing: {
        supabaseUrl: !SUPABASE_URL,
        supabaseKey: !SUPABASE_SERVER_KEY,
      },
    });
  }

  const sb = supabaseAdmin;

  try {
    const { data: childByUser, error: childByUserErr } = await sb
      .from("filhos_de_santo")
      .select("id, nome, lider_id, tenant_id")
      .eq("user_id", userId)
      .limit(1);
    if (childByUserErr) throw childByUserErr;
    let linkedChild = childByUser?.[0] ?? null;

    if (!linkedChild && email) {
      const byEmail = await sb
        .from("filhos_de_santo")
        .select("id, nome, lider_id, tenant_id")
        .eq("email", email)
        .limit(1);
      if (byEmail.error) throw byEmail.error;
      linkedChild = byEmail.data?.[0] ?? null;
    }

    if (linkedChild) {
      const leaderRef = linkedChild.lider_id || linkedChild.tenant_id;
      let leaderProfile: { data: any; error: any } = { data: null, error: null };

      if (leaderRef) {
        leaderProfile = await sb
          .from("perfil_lider")
          .select("id, nome_terreiro, cargo, role, tenant_id, is_admin_global, is_blocked, deleted_at, foto_url")
          .eq("id", leaderRef)
          .maybeSingle();
        if (leaderProfile.error) throw leaderProfile.error;
      }

      if (!leaderProfile.data && linkedChild.tenant_id) {
        const alt = await sb
          .from("perfil_lider")
          .select("id, nome_terreiro, cargo, role, tenant_id, is_admin_global, is_blocked, deleted_at, foto_url")
          .eq("tenant_id", linkedChild.tenant_id)
          .limit(1);
        if (alt.error) throw alt.error;
        if (alt.data?.[0]) leaderProfile = { data: alt.data[0], error: null };
      }

      if (leaderProfile.data?.deleted_at) {
        return res.status(403).json({ error: "Conta excluída", status: "deleted" });
      }
      if (leaderProfile.data?.is_blocked) {
        return res.status(403).json({ error: "Acesso suspenso", status: "blocked" });
      }

      const leaderAuthId = leaderProfile.data?.id || leaderRef;
      const leaderSub = leaderAuthId
        ? await sb.from("subscriptions").select("plan, status, expires_at").eq("id", leaderAuthId).maybeSingle()
        : { data: null, error: null };
      if (leaderSub.error) throw leaderSub.error;

      const filhoPlanSlug = canonicalPlanSlug(leaderSub.data?.plan);
      res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
      return res.json({
        nome_terreiro: leaderProfile.data?.nome_terreiro || "Meu Terreiro",
        cargo: null,
        role: "filho",
        is_admin_global: false,
        tenant_id:
          leaderProfile.data?.tenant_id || linkedChild.tenant_id || leaderProfile.data?.id || leaderRef || userId,
        plan: filhoPlanSlug,
        status: "active",
        expires_at: "2099-12-31T23:59:59Z",
        foto_url: leaderProfile.data?.foto_url || null,
      });
    }

    let profileRes: any = await fetchPerfilLiderByUserId(sb, userId);
    if (profileRes.error) throw profileRes.error;

    if (profileRes.data?.deleted_at) {
      return res.status(403).json({ error: "Conta excluída", status: "deleted" });
    }
    if (profileRes.data?.is_blocked) {
      return res.status(403).json({ error: "Acesso suspenso", status: "blocked" });
    }

    let subRes: any = await sb.from("subscriptions").select("plan, status, expires_at").eq("id", userId).maybeSingle();
    if (subRes.error) throw subRes.error;

    const isSuperAdmin = profileRes.data?.is_admin_global === true || consoleAdminEmailAllowlist().includes(email);

    if (isSuperAdmin && !profileRes.data) {
      console.log(`[tenant-info] Auto-criando perfil Super Admin: ${email}`);
      const { data: newProfile, error: createError } = await sb
        .from("perfil_lider")
        .upsert(
          {
            id: userId,
            email: email,
            nome_terreiro: "Meu Terreiro",
            role: "admin",
            is_admin_global: true,
            tenant_id: SHARED_TENANT_ID_SUPER,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (!createError && newProfile) {
        profileRes.data = newProfile;
      }
    }

    if (!profileRes.data) {
      const { data: cRows, error: childError } = await sb
        .from("filhos_de_santo")
        .select("lider_id, tenant_id")
        .eq("user_id", userId)
        .limit(1);
      if (childError) throw childError;
      let childData = cRows?.[0] ?? null;
      if (!childData && email) {
        const r2 = await sb
          .from("filhos_de_santo")
          .select("lider_id, tenant_id")
          .eq("email", email)
          .limit(1);
        if (r2.error) throw r2.error;
        childData = r2.data?.[0] ?? null;
      }

      if (childData) {
        const candidateLeaderId = childData.lider_id || childData.tenant_id;
        let leaderProfile: any = await sb
          .from("perfil_lider")
          .select("id, nome_terreiro, cargo, role, tenant_id, is_admin_global, is_blocked, deleted_at, foto_url")
          .eq("id", candidateLeaderId)
          .maybeSingle();
        if (leaderProfile.error) throw leaderProfile.error;

        if (!leaderProfile.data && childData.tenant_id) {
          const alt = await sb
            .from("perfil_lider")
            .select("id, nome_terreiro, cargo, role, tenant_id, is_admin_global, is_blocked, deleted_at, foto_url")
            .eq("tenant_id", childData.tenant_id)
            .limit(1);
          if (alt.error) throw alt.error;
          if (alt.data?.[0]) leaderProfile = { data: alt.data[0], error: null };
        }

        const zeladorAuthId = leaderProfile.data?.id || candidateLeaderId;
        const leaderSub = await sb
          .from("subscriptions")
          .select("plan, status, expires_at")
          .eq("id", zeladorAuthId)
          .maybeSingle();
        if (leaderSub.error) throw leaderSub.error;

        if (leaderProfile.data?.deleted_at) {
          return res.status(403).json({ error: "Conta excluída", status: "deleted" });
        }
        if (leaderProfile.data?.is_blocked) {
          return res.status(403).json({ error: "Acesso suspenso", status: "blocked" });
        }

        if (leaderProfile.data) {
          profileRes.data = { ...leaderProfile.data, role: "filho" };
          subRes.data = leaderSub.data;
        }
      }
    }

    let plan = canonicalPlanSlug(subRes.data?.plan);
    if (isSuperAdmin) plan = "premium";

    const lifetime = isLifetimePlanSlug(plan);

    const roleOut = isSuperAdmin ? "admin" : profileRes.data?.role || (profileRes.data ? "admin" : null);
    const cargoOut = roleOut === "filho" ? null : profileRes.data?.cargo?.trim() || null;

    // Para vitalício/cortesia: front trata expires_at=null como "sem expiração" via isLifetime.
    // Para super admin: data distante (acesso permanente).
    // Demais: usa expires_at do banco (ou null se ausente).
    const expiresOut = isSuperAdmin
      ? "2099-12-31T23:59:59Z"
      : lifetime
        ? null
        : subRes.data?.expires_at || null;

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
    return res.json({
      nome_terreiro: profileRes.data?.nome_terreiro || null,
      cargo: cargoOut,
      role: roleOut,
      is_admin_global: !!isSuperAdmin,
      tenant_id: profileRes.data?.tenant_id || profileRes.data?.id || (isSuperAdmin ? userId : null),
      plan: plan,
      status: isSuperAdmin ? "active" : subRes.data?.status || null,
      expires_at: expiresOut,
      foto_url: profileRes.data?.foto_url || null,
      terms_accepted_version: profileRes.data?.terms_accepted_version || null,
    });
  } catch (error: any) {
    console.error("[SERVER] Erro ao buscar tenant info:", error);
    return res.status(500).json({ error: "Erro ao buscar dados do tenant", details: error?.message || String(error) });
  }
}
