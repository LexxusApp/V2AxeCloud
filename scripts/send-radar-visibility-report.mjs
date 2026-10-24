#!/usr/bin/env node
/**
 * scripts/send-radar-visibility-report.mjs
 * Dispara o relatório oficial de visibilidade do Radar para os zeladores que têm visualizações.
 * 
 * Uso:
 *   node scripts/send-radar-visibility-report.mjs               (Modo simulação / Dry-run)
 *   node scripts/send-radar-visibility-report.mjs --live        (Disparo real para todos)
 *   node scripts/send-radar-visibility-report.mjs --to 5515...  (Disparo de teste para um número)
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const isLive = process.argv.includes("--live");
const testPhoneArg = process.argv.find((a, i, arr) => arr[i - 1] === "--to" || a.startsWith("--to="));
const singlePhone = testPhoneArg ? (testPhoneArg.includes("=") ? testPhoneArg.split("=")[1] : process.argv[process.argv.indexOf("--to") + 1]) : null;

const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const token = process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID;

if (!sbUrl || !sbKey) {
  console.error("Erro: Credenciais do Supabase ausentes no .env");
  process.exit(1);
}

if (isLive && (!token || !phoneId)) {
  console.error("Erro: Credenciais Meta WhatsApp ausentes no .env");
  process.exit(1);
}

const sb = createClient(sbUrl, sbKey);
const TEMPLATE_NAME = "relatorio_radar_zelador_axecloud";

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  return digits;
}

function toTitleCase(str) {
  const minor = new Set(["de", "da", "do", "das", "dos", "e"]);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (minor.has(w) && i > 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function formatLeaderGreeting(rawName, cargo) {
  let name = String(rawName || "").trim();
  if (!name || name.toLowerCase() === "zelador(a)") {
    return cargo ? toTitleCase(cargo) : "Zelador(a)";
  }
  // Se já começar com Pai / Mãe / Babá / Ya / etc, preserva e formata
  if (/^(pai|mãe|mae|babalorixá|ialorixá|babalaô|ogã|equede)\b/i.test(name)) {
    return toTitleCase(name);
  }
  
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return toTitleCase(name);
  }
  
  // Tratamento para preposições (ex: "Maria das Graças" em vez de "Maria das")
  const preps = new Set(["de", "da", "do", "das", "dos"]);
  if (words.length >= 3 && preps.has(words[1].toLowerCase())) {
    return toTitleCase(`${words[0]} ${words[1]} ${words[2]}`);
  }
  return toTitleCase(`${words[0]} ${words[1]}`);
}

async function sendMetaTemplate(targetPhone, params) {
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: targetPhone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: params.map((val) => ({ type: "text", text: String(val) })),
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const resJson = await response.json();
  return { ok: response.ok, status: response.status, data: resJson };
}

async function run() {
  console.log("=================================================");
  console.log("📡 AXÉCLOUD - RELATÓRIO DE VISIBILIDADE DO RADAR");
  console.log(`Modo: ${isLive ? "🚨 DISPARO REAL (LIVE)" : "🔍 SIMULAÇÃO (DRY-RUN)"}`);
  console.log(`Template: ${TEMPLATE_NAME}`);
  if (singlePhone) console.log(`Destinatário fixo de teste: ${singlePhone}`);
  console.log("=================================================\n");

  const { data: terreiros, error: tErr } = await sb
    .from("terreiros_diretorio")
    .select("id, nome, slug, telefone, claimed_by_tenant_id")
    .not("claimed_by_tenant_id", "is", null);

  if (tErr) {
    console.error("Erro ao listar terreiros:", tErr);
    return;
  }

  const now = Date.now();
  const d30 = now - 30 * 86_400_000;
  const d7 = now - 7 * 86_400_000;

  const queue = [];

  for (const t of terreiros || []) {
    // 1. Métricas no access_logs
    const { data: logsById } = await sb
      .from("access_logs")
      .select("created_at, event_type, metadata")
      .eq("target_type", "directory_terreiro")
      .eq("target_id", t.id)
      .in("event_type", ["directory.profile_click", "directory.profile_google_view", "directory.whatsapp_click"]);

    let logsBySlug = [];
    if (t.slug) {
      const { data: slugLogs } = await sb
        .from("access_logs")
        .select("created_at, event_type, metadata")
        .contains("metadata", { slug: t.slug })
        .in("event_type", ["directory.profile_click", "directory.profile_google_view", "directory.whatsapp_click"]);
      logsBySlug = slugLogs || [];
    }

    const seen = new Set();
    const allLogs = [];
    for (const row of [...(logsById || []), ...logsBySlug]) {
      const key = `${row.created_at}_${row.event_type}`;
      if (!seen.has(key)) {
        seen.add(key);
        allLogs.push(row);
      }
    }

    let viewsTotal = 0;
    let views30 = 0;
    let views7 = 0;
    let directoryClicks30 = 0;
    let googleViews30 = 0;
    let whatsappClicks30 = 0;

    for (const row of allLogs) {
      const ts = new Date(row.created_at).getTime();
      viewsTotal++;
      if (ts >= d30) views30++;
      if (ts >= d7) views7++;
      if (ts >= d30) {
        const md = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        const fromGoogle =
          row.event_type === "directory.profile_google_view" ||
          md.google === true ||
          String(md.channel || "").startsWith("google_") ||
          String(md.source || "").toLowerCase().includes("google");
        if (fromGoogle) googleViews30++;
        if (row.event_type === "directory.profile_click") directoryClicks30++;
        if (row.event_type === "directory.whatsapp_click") whatsappClicks30++;
      }
    }

    // 2. Interações em public_conversion_events
    if (t.slug) {
      const { data: pce } = await sb
        .from("public_conversion_events")
        .select("created_at, event_name, metadata, path, referrer")
        .or(`path.eq./terreiro/${t.slug},metadata->>slug.eq.${t.slug}`);

      for (const p of pce || []) {
        const ts = new Date(p.created_at).getTime();
        viewsTotal++;
        if (ts >= d30) views30++;
        if (ts >= d7) views7++;
        if (ts >= d30) {
          const isGoogle = String(p.referrer || "").toLowerCase().includes("google");
          if (isGoogle) googleViews30++;
          else directoryClicks30++;

          const action = String(p.metadata?.action || p.cta_id || "").toLowerCase();
          if (action.includes("whatsapp")) whatsappClicks30++;
        }
      }
    }

    // Filtrar apenas quem tem visualizações registradas
    if (viewsTotal > 0) {
      const { data: leader } = await sb
        .from("perfil_lider")
        .select("zelador, whatsapp, nome_terreiro, cargo")
        .eq("id", t.claimed_by_tenant_id)
        .maybeSingle();

      const { data: claim } = await sb
        .from("terreiro_claim_requests")
        .select("requester_name, requester_phone, requester_role")
        .eq("terreiro_id", t.id)
        .eq("status", "approved")
        .maybeSingle();

      const greetingName = formatLeaderGreeting(
        leader?.zelador || claim?.requester_name,
        leader?.cargo || claim?.requester_role
      );

      const targetPhone = normalizePhone(
        singlePhone || leader?.whatsapp || claim?.requester_phone || t.telefone
      );

      // Usar a melhor métrica de visualizações (30 dias ou total se a casa começou recentemente)
      const displayViews = views30 > 0 ? views30 : viewsTotal;

      queue.push({
        terreiroId: t.id,
        terreiroNome: t.nome,
        slug: t.slug,
        greetingName,
        phone: targetPhone,
        views30: displayViews,
        googleViews30,
        directoryClicks30,
        whatsappClicks30,
        viewsTotal,
      });
    }
  }

  console.log(`Encontrados ${queue.length} terreiros reivindicados com visualizações no Radar:\n`);

  let countSuccess = 0;
  let countFailed = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    console.log(`[${i + 1}/${queue.length}] ${item.terreiroNome}`);
    console.log(`   👤 Zelador: ${item.greetingName}`);
    console.log(`   📱 WhatsApp: ${item.phone || "NÃO CADASTRADO"}`);
    console.log(`   📊 Métricas: ${item.views30} views (30d) · ${item.googleViews30} Google · ${item.directoryClicks30} Mapa · ${item.whatsappClicks30} WhatsApp`);

    if (!item.phone) {
      console.log("   ⚠️ Pulando: Telefone ausente.\n");
      countFailed++;
      continue;
    }

    // Parâmetros do template Meta:
    // {{1}} = Nome do zelador
    // {{2}} = Nome do terreiro
    // {{3}} = Visualizações 30 dias
    // {{4}} = Google
    // {{5}} = Mapa
    // {{6}} = WhatsApp
    const params = [
      item.greetingName,
      item.terreiroNome,
      String(item.views30),
      String(item.googleViews30),
      String(item.directoryClicks30),
      String(item.whatsappClicks30),
    ];

    if (!isLive) {
      console.log("   🧪 [DRY-RUN] Mensagem que seria enviada:");
      console.log(`      "Olá, ${params[0]}! 🌟`);
      console.log(`      Passando para compartilhar o alcance da sua casa no Radar AxéCloud nos últimos 30 dias:`);
      console.log(`      🏛️ ${params[1]}`);
      console.log(`      👁️ ${params[2]} visualizações no seu perfil`);
      console.log(`      🔍 ${params[3]} pessoas encontraram vocês pelo Google`);
      console.log(`      🗺️ ${params[4]} visitas diretas pelo Mapa`);
      console.log(`      💬 ${params[5]} pessoas clicaram no seu WhatsApp..."\n`);
      countSuccess++;
    } else {
      console.log("   🚀 Enviando via Meta WhatsApp Cloud API...");
      try {
        const result = await sendMetaTemplate(item.phone, params);
        if (result.ok) {
          console.log(`   ✅ Entregue com sucesso! WAMID: ${result.data?.messages?.[0]?.id || "OK"}\n`);
          countSuccess++;
        } else {
          console.error(`   ❌ Falha ao enviar:`, JSON.stringify(result.data), "\n");
          countFailed++;
        }
      } catch (err) {
        console.error(`   ❌ Erro de rede/requisição:`, err.message, "\n");
        countFailed++;
      }
      // Intervalo suave de 1s entre mensagens para respeitar limites da Meta
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("=================================================");
  console.log(`Concluído! Sucessos: ${countSuccess} | Falhas: ${countFailed}`);
  if (!isLive) {
    console.log("💡 Para disparar de verdade para todos os líderes, execute:");
    console.log("   node scripts/send-radar-visibility-report.mjs --live");
  }
  console.log("=================================================");
}

run();
