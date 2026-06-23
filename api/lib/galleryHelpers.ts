import type { SupabaseClient } from "@supabase/supabase-js";
import { assertZeladorTenantAccess } from "./tenantAccess.js";
import { isConsoleGlobalAdmin } from "./consoleAdmin.js";

export const MURAL_ALBUM_NAME = "Relicário de Axé";
export const MURAL_ALBUM_DESCRIPTION =
  "Mural sagrado de lembranças fotográficas do terreiro — giras, festas e união da corrente.";

const GALLERY_CATEGORIES = new Set(["gira", "evento", "lembranca"]);

export function normalizeGalleryCategory(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  return GALLERY_CATEGORIES.has(raw) ? raw : null;
}

export async function assertGalleryManager(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tenantId: string,
  isGlobalAdmin = false,
): Promise<boolean> {
  if (isGlobalAdmin) return true;
  return assertZeladorTenantAccess(supabaseAdmin, userId, tenantId);
}

export async function assertGalleryManagerUser(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  tenantId: string,
): Promise<boolean> {
  if (await isConsoleGlobalAdmin(supabaseAdmin, user)) return true;
  return assertZeladorTenantAccess(supabaseAdmin, user.id, tenantId);
}
