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

export async function ensureMuralAlbum(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  userId: string,
) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("gallery_albums")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("name", MURAL_ALBUM_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from("gallery_albums")
    .insert([
      {
        tenant_id: tenantId,
        name: MURAL_ALBUM_NAME,
        description: MURAL_ALBUM_DESCRIPTION,
        created_by: userId,
      },
    ])
    .select("*")
    .single();
  if (createError) throw createError;
  return created;
}

export async function enrichGalleryMediaRows(
  supabaseAdmin: SupabaseClient,
  media: Array<Record<string, unknown>>,
) {
  const creatorIds = [
    ...new Set(
      (media || [])
        .map((item) => item?.created_by)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  let nameByUser: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: leaders } = await supabaseAdmin
      .from("perfil_lider")
      .select("id, nome_terreiro")
      .in("id", creatorIds);
    nameByUser = Object.fromEntries(
      (leaders || []).map((leader: { id: string; nome_terreiro?: string | null }) => [
        leader.id,
        String(leader.nome_terreiro || "").trim(),
      ]),
    );
  }

  return (media || []).map((item) => ({
    ...item,
    likes_count: Number(item?.likes_count ?? 0),
    author_name: item?.created_by
      ? nameByUser[String(item.created_by)] || "Zelador"
      : "Zelador",
  }));
}
