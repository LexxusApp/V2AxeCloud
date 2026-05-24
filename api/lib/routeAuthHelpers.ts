import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Request, Response } from "express";
import { isConsoleGlobalAdmin } from "./consoleAdmin.js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { requireTenantReadAccess } from "./secureRoutes.js";

type Res = { status: (n: number) => { json: (b: unknown) => unknown } };

/** M10: auth padronizado — substitui blocos manuais authHeader + verifyUser. */
export async function requireApiUser(
  supabaseAdmin: SupabaseClient,
  req: Request,
  res: Res
): Promise<User | null> {
  return requireAuthOrRespond(supabaseAdmin, req, res);
}

/** M10: leitura tenant-scoped padronizada. */
export async function requireApiTenantRead(
  supabaseAdmin: SupabaseClient,
  req: Request,
  res: Res,
  tenantIdRaw: unknown,
  opts?: { allowMissingTenant?: boolean }
): Promise<{ user: User; tenantId: string } | null> {
  return requireTenantReadAccess(supabaseAdmin, req, res, tenantIdRaw, opts);
}

/** M10: admin global do console (allowlist). */
export async function requireApiGlobalAdmin(
  supabaseAdmin: SupabaseClient,
  req: Request,
  res: Res,
  opts?: { forbiddenMessage?: string }
): Promise<User | null> {
  const user = await requireAuthOrRespond(supabaseAdmin, req, res);
  if (!user) return null;
  if (!(await isConsoleGlobalAdmin(supabaseAdmin, user))) {
    res.status(403).json({
      error: opts?.forbiddenMessage || "Acesso restrito a administradores globais",
    });
    return null;
  }
  return user;
}
