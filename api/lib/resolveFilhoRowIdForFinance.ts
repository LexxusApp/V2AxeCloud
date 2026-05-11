/**
 * Resolve `filhos_de_santo.id` para chamadas financeiras (ex.: GET /api/transactions como filho).
 * Filhos entram com ID + CPF; o Auth usa e-mails "sombra", não o e-mail real do cadastro.
 */
const SHADOW_EMAIL_F = /^f_([0-9a-f-]{36})@axecloud\.internal$/i;
const SHADOW_EMAIL_FILHO = /^filho_([0-9a-f-]+)@axecloud\.com$/i;

type Sb = { from: (t: string) => any };

async function filhoIdByUuidOrPrefix(supabaseAdmin: Sb, raw: string): Promise<string | null> {
  const id = String(raw || "").trim().toLowerCase();
  if (!/^[0-9a-f-]{8,}$/i.test(id)) return null;
  const { data: exact } = await supabaseAdmin.from("filhos_de_santo").select("id").eq("id", id).maybeSingle();
  if (exact?.id) return exact.id as string;
  if (id.length >= 8 && id.length < 36) {
    const { data: rows } = await supabaseAdmin.from("filhos_de_santo").select("id").ilike("id", `${id}%`).limit(2);
    if (rows?.length === 1) return (rows[0] as { id: string }).id;
  }
  return null;
}

export async function resolveFilhoRowIdForFinance(
  supabaseAdmin: Sb,
  opts: {
    queryUserId?: string;
    queryUserEmail?: string;
    jwtUserId?: string;
    jwtEmail?: string;
  }
): Promise<string | null> {
  const uid = String(opts.jwtUserId || opts.queryUserId || "").trim();
  const emailRaw = String(opts.jwtEmail || opts.queryUserEmail || "").trim();
  const em = emailRaw.toLowerCase();

  const mF = em.match(SHADOW_EMAIL_F);
  if (mF?.[1]) {
    const fid = await filhoIdByUuidOrPrefix(supabaseAdmin, mF[1]);
    if (fid) return fid;
  }
  const mFi = em.match(SHADOW_EMAIL_FILHO);
  if (mFi?.[1]) {
    const fid = await filhoIdByUuidOrPrefix(supabaseAdmin, mFi[1]);
    if (fid) return fid;
  }

  if (uid) {
    const r1 = await supabaseAdmin.from("filhos_de_santo").select("id").eq("user_id", uid).maybeSingle();
    if ((r1.data as { id?: string } | null)?.id) return (r1.data as { id: string }).id;
  }

  if (em && !SHADOW_EMAIL_F.test(em) && !SHADOW_EMAIL_FILHO.test(em)) {
    const r2 = await supabaseAdmin.from("filhos_de_santo").select("id").eq("email", em).maybeSingle();
    if ((r2.data as { id?: string } | null)?.id) return (r2.data as { id: string }).id;
  }

  return null;
}
