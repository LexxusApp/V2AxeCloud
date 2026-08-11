import type { SupabaseClient } from "@supabase/supabase-js";
import { researchPublicContact } from "./growthGemini.js";
import { growthMailConfigured, sendGrowthIntroEmail } from "./growthOutreachMail.js";
import { safeErrorMessage } from "./safeError.js";

type Slot = "morning" | "afternoon";

function saoPauloNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function normalizePhone(value: unknown): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? digits : "";
}

function clean(value: unknown, max = 500): string {
  return String(value || "").trim().slice(0, max);
}

async function dueSlots(sb: SupabaseClient): Promise<{ date: string; slots: Slot[] }> {
  const local = saoPauloNow();
  const eligible: Slot[] = [];
  if (local.hour >= 9) eligible.push("morning");
  if (local.hour >= 14) eligible.push("afternoon");
  if (!eligible.length) return { date: local.date, slots: [] };
  const { data, error } = await sb
    .from("growth_prospects")
    .select("selected_slot")
    .eq("selected_date", local.date)
    .in("selected_slot", eligible);
  if (error) throw error;
  const used = new Set((data || []).map((row: any) => String(row.selected_slot)));
  return { date: local.date, slots: eligible.filter((slot) => !used.has(slot)) };
}

async function ensureProspect(sb: SupabaseClient, row: any) {
  const slug = clean(row.slug, 180);
  const phone = normalizePhone(row.telefone);
  if (!slug || !phone) return null;
  const { data: existingByPhone } = await sb
    .from("growth_prospects")
    .select("*")
    .eq("phone_e164", phone)
    .maybeSingle();
  if (existingByPhone) return existingByPhone;
  const { data: existingBySlug } = await sb
    .from("growth_prospects")
    .select("*")
    .eq("terreiro_slug", slug)
    .maybeSingle();
  if (existingBySlug) return existingBySlug;
  const { data, error } = await sb
    .from("growth_prospects")
    .insert({
      directory_id: row.id,
      terreiro_slug: slug,
      terreiro_nome: clean(row.nome, 180),
      phone_e164: phone,
      cidade: clean(row.cidade, 80) || "Suzano",
      bairro: clean(row.bairro, 100) || null,
      source_url: clean(row.link_maps) || null,
      status: "novo",
      research_status: "pending",
      outreach_status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function saveResearch(sb: SupabaseClient, prospectId: string, result: Awaited<ReturnType<typeof researchPublicContact>>) {
  const hasChannel = Boolean(result.email || result.contactFormUrl);
  const { error } = await sb.from("growth_prospects").update({
    public_email: result.email,
    website_url: result.websiteUrl,
    contact_form_url: result.contactFormUrl,
    instagram_url: result.instagramUrl,
    facebook_url: result.facebookUrl,
    research_sources: result.sources,
    research_status: hasChannel ? "found" : "not_found",
    outreach_channel: result.email ? "email" : result.contactFormUrl ? "contact_form" : "none",
    outreach_status: result.email ? "pending" : result.contactFormUrl ? "manual_required" : "failed",
    updated_at: new Date().toISOString(),
  }).eq("id", prospectId);
  if (error) throw error;
}

async function sendAndSelect(sb: SupabaseClient, prospect: any, date: string, slot: Slot) {
  const reservedAt = new Date().toISOString();
  const { data: reserved, error: reserveError } = await sb.from("growth_prospects").update({
    selected_date: date,
    selected_slot: slot,
    outreach_channel: "email",
    updated_at: reservedAt,
  }).eq("id", prospect.id).is("selected_date", null).select("id").maybeSingle();
  if (reserveError) throw reserveError;
  if (!reserved?.id) throw new Error("Candidato já reservado por outra execução.");

  const sent = await sendGrowthIntroEmail({
    to: String(prospect.public_email),
    terreiroNome: String(prospect.terreiro_nome),
    cidade: String(prospect.cidade || "Suzano"),
  });
  const now = new Date().toISOString();
  const { error } = await sb.from("growth_prospects").update({
    selected_date: date,
    selected_slot: slot,
    outreach_channel: "email",
    outreach_status: "sent",
    outreach_subject: sent.subject,
    outreach_message: sent.message,
    outreach_sent_at: now,
    outreach_external_id: sent.messageId || null,
    status: "contatado",
    updated_at: now,
  }).eq("id", prospect.id);
  if (error) throw error;
  await sb.from("growth_outreach_events").insert({
    prospect_id: prospect.id,
    event_type: "safe_email_sent",
    payload: { slot, date, messageId: sent.messageId || null, channel: "email" },
  });
}

export async function runSafeGrowthOutreachTick(sb: SupabaseClient) {
  const enabled = String(process.env.GROWTH_SAFE_OUTREACH_ENABLED || "false").toLowerCase() === "true";
  const testMode = String(process.env.GROWTH_SAFE_OUTREACH_TEST_MODE || "true").toLowerCase() !== "false";
  const schedule = await dueSlots(sb);
  const localHour = saoPauloNow().hour;
  if (!enabled || localHour < 9 || (!testMode && !schedule.slots.length)) {
    return { enabled, testMode, date: schedule.date, dueSlots: schedule.slots, sent: 0, researched: 0 };
  }

  let candidateTarget = schedule.slots.length;
  if (testMode) {
    const { count: selectedToday, error: selectedError } = await sb
      .from("growth_prospects")
      .select("id", { count: "exact", head: true })
      .eq("selected_date", schedule.date);
    if (selectedError) throw selectedError;
    candidateTarget = Math.max(0, 2 - Number(selectedToday || 0));
    if (!candidateTarget) {
      return { enabled, testMode, date: schedule.date, dueSlots: schedule.slots, sent: 0, researched: 0, readyForEmail: 0 };
    }
  }
  if (!testMode && !growthMailConfigured()) throw new Error("SMTP não configurado para o funil seguro.");

  const { data: pendingEmail, error: pendingError } = await sb
    .from("growth_prospects")
    .select("*")
    .eq("research_status", "found")
    .eq("outreach_status", "pending")
    .not("public_email", "is", null)
    .is("selected_date", null)
    .order("created_at", { ascending: true })
    .limit(20);
  if (pendingError) throw pendingError;

  const { data: directoryRows, error: directoryError } = await sb
    .from("terreiros_diretorio")
    .select("id,nome,slug,telefone,endereco,cidade,bairro,link_maps")
    .ilike("cidade", "Suzano")
    .not("telefone", "is", null)
    .order("created_at", { ascending: true })
    .limit(150);
  if (directoryError) throw directoryError;

  let sent = 0;
  let researched = 0;
  const candidates = [...(pendingEmail || [])].slice(0, candidateTarget);
  const seen = new Set(candidates.map((row: any) => String(row.id)));

  for (const row of directoryRows || []) {
    if (candidates.length >= candidateTarget || researched >= (testMode ? 12 : 8)) break;
    try {
      const prospect = await ensureProspect(sb, row);
      if (!prospect || seen.has(String(prospect.id)) || prospect.selected_date) continue;
      seen.add(String(prospect.id));
      if (prospect.research_status === "pending") {
        try {
          const research = await researchPublicContact({
            nome: String(row.nome || prospect.terreiro_nome),
            cidade: String(row.cidade || "Suzano"),
            endereco: row.endereco,
            mapsUrl: row.link_maps,
          });
          researched += 1;
          await saveResearch(sb, prospect.id, research);
          Object.assign(prospect, {
            public_email: research.email,
            contact_form_url: research.contactFormUrl,
            research_status: research.email || research.contactFormUrl ? "found" : "not_found",
            outreach_status: research.email ? "pending" : research.contactFormUrl ? "manual_required" : "failed",
          });
        } catch (error) {
          await sb.from("growth_prospects").update({
            research_status: "failed",
            outreach_status: "failed",
            updated_at: new Date().toISOString(),
          }).eq("id", prospect.id);
          await sb.from("growth_outreach_events").insert({
            prospect_id: prospect.id,
            event_type: "research_failed",
            payload: { error: safeErrorMessage(error, "Pesquisa falhou").slice(0, 300) },
          });
        }
      }
      if (prospect.public_email && prospect.outreach_status === "pending") candidates.push(prospect);
    } catch (error) {
      console.warn("[GROWTH SAFE] candidato ignorado:", safeErrorMessage(error, "erro"));
    }
  }

  if (testMode) {
    let selected = 0;
    for (const slot of schedule.slots) {
      const prospect = candidates.shift();
      if (!prospect) break;
      const { data, error } = await sb.from("growth_prospects").update({
        selected_date: schedule.date,
        selected_slot: slot,
        updated_at: new Date().toISOString(),
      }).eq("id", prospect.id).is("selected_date", null).select("id").maybeSingle();
      if (error) throw error;
      if (data?.id) selected += 1;
    }
    return {
      enabled,
      testMode,
      date: schedule.date,
      dueSlots: schedule.slots,
      sent: 0,
      researched,
      selected,
      readyForEmail: candidates.length,
    };
  }

  for (const slot of schedule.slots) {
    const prospect = candidates.shift();
    if (!prospect) break;
    try {
      await sendAndSelect(sb, prospect, schedule.date, slot);
      sent += 1;
    } catch (error) {
      await sb.from("growth_prospects").update({
        outreach_status: "failed",
        updated_at: new Date().toISOString(),
      }).eq("id", prospect.id);
      await sb.from("growth_outreach_events").insert({
        prospect_id: prospect.id,
        event_type: "safe_email_failed",
        payload: { error: safeErrorMessage(error, "Envio falhou").slice(0, 300), slot, date: schedule.date },
      });
    }
  }
  return { enabled, testMode, date: schedule.date, dueSlots: schedule.slots, sent, researched };
}
