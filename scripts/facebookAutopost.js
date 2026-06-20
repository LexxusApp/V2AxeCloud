/**

 * Gerador automático de posts AxéCloud.

 *

 * Fluxo: Gemini (legenda + prompt visual) → Pollinations/flux (imagem grátis)

 *        → marca d'água → salva → WhatsApp (Evolution/Baileys).

 *

 * Uso: node scripts/facebookAutopost.js

 * Dry-run: AUTOPOST_DRY_RUN=1 node scripts/facebookAutopost.js

 *

 * Variáveis (.env):

 *   GEMINI_API_KEY

 *   POLLINATIONS_API_KEY (recomendado — gen.pollinations.ai)

 *   EVOLUTION_API_BASE_URL, EVOLUTION_API_KEY

 *   EVOLUTION_AUTOPOST_INSTANCE (padrão axecloud_autopost)

 *   AUTOPOST_WHATSAPP_TO (padrão 5511920033501)

 *   GEMINI_MODEL (padrão gemini-2.5-flash)

 */



import "dotenv/config";

import fs from "node:fs/promises";

import os from "node:os";

import path from "node:path";

import { fileURLToPath } from "node:url";

import { GoogleGenerativeAI } from "@google/generative-ai";

import sharp from "sharp";



const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");



const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const POLLINATIONS_MODEL = "flux";

const EVOLUTION_INSTANCE =

  process.env.EVOLUTION_INSTANCE_NAME?.trim() ||

  process.env.EVOLUTION_AUTOPOST_INSTANCE?.trim() ||

  "axecloud_autopost";

const EVOLUTION_INTEGRATION = (

  process.env.EVOLUTION_AUTOPOST_INTEGRATION || "baileys"

).toLowerCase();

const WHATSAPP_TO = (

  process.env.AUTOPOST_WHATSAPP_TO || "5511920033501"

).replace(/\D/g, "");

const DRY_RUN = ["1", "true", "yes"].includes(

  String(

    process.env.AUTOPOST_DRY_RUN || process.env.FACEBOOK_AUTOPOST_DRY_RUN || ""

  ).toLowerCase()

);



const READY_POSTS_DIR = path.join(ROOT, "assets", "ready_posts");



const LOGO_CANDIDATES = [

  process.env.AXECLOUD_LOGO_PATH,

  path.join(ROOT, "assets", "logo-axecloud.png"),

  path.join(ROOT, "public", "logo-axecloud.png"),

].filter(Boolean);



const POST_THEMES = [

  {

    id: "axe",

    label: "frase inspiradora de Axé",

    instruction:

      "Escreva uma frase inspiradora de Axé, com respeito à tradição afro-brasileira, tom acolhedor e poético.",

    visualHint:

      "Still life sagrado em terreiro brasileiro: pote de barro com folhas verdes de ewé, vela branca acesa, fios de contas brancos ao fundo, madeira escura, luz dourada suave. Ambiente de firmação/espiritualidade, não paisagem.",

  },

  {

    id: "gestao",

    label: "dica de gestão para terreiros",

    instruction:

      "Escreva uma dica prática de gestão para terreiros (calendário de giras, mensalidades, cadastro de filhos de santo), posicionando o AxéCloud como aliado digital sem tom agressivo.",

    visualHint:

      "Mesa clara com tablet mostrando calendário colorido de eventos do terreiro, fios de contas brancos enrolados, caderno, filtro de barro tradicional, pequenas estátuas de orixás na prateleira ao fundo, luz natural, estética profissional e sagrada.",

  },

  {

    id: "saudacao",

    label: "saudação espiritual",

    instruction:

      "Escreva uma saudação espiritual calorosa (bom dia com axé, gratidão aos guias, Pretos Velhos, Caboclos ou orixás conforme couber).",

    visualHint:

      "Cena respeitosa de terreiro: estátua de Preto Velho de madeira com cachimbo e fio de contas, xícara de café e vela branca como oferenda em esteira, luz quente interna, retrato digno e autêntico — nunca caricatura.",

  },

];



const IMAGE_PROMPT_RULES = `

Para imagePrompt (INGLÊS, ultra-detalhado, 80-150 palavras):

- Foto realista, composição quadrada 1:1, iluminação cinematográfica quente.

- Contexto: terreiro / casa de axé / Umbanda / Candomblé no Brasil.

- Elementos permitidos: fios de contas, ewé, velas, pote de barro, atabaque (parcial), estátuas respeitosas, panos brancos, flores, ferro de Ogum, azul/branco de Iemanjá, etc.

- PROIBIDO: paisagem genérica de floresta, raios de sol abstratos, texto na imagem, caricatura, estereótipo ofensivo, pessoas europeias, igreja católica.

- Termine com: no text overlay, no watermark, square composition.`;



function requireEnv(name) {

  const value = process.env[name]?.trim();

  if (!value) {

    throw new Error(`Defina ${name} no arquivo .env`);

  }

  return value;

}



function todayDateSlug(date = new Date()) {

  return new Intl.DateTimeFormat("en-CA", {

    timeZone: "America/Sao_Paulo",

  }).format(date);

}



function pickTheme() {

  const dayIndex = new Date().getDay();

  return POST_THEMES[dayIndex % POST_THEMES.length];

}



function evolutionBaseUrl() {

  const raw = requireEnv("EVOLUTION_API_BASE_URL").replace(/\/$/, "");

  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

}



async function resolveLogoPath() {

  for (const candidate of LOGO_CANDIDATES) {

    try {

      await fs.access(candidate);

      return candidate;

    } catch {

      // tenta próximo caminho

    }

  }

  throw new Error(

    "Logotipo não encontrado. Coloque em assets/logo-axecloud.png ou defina AXECLOUD_LOGO_PATH."

  );

}



async function generatePostContent(geminiApiKey, theme) {

  const genAI = new GoogleGenerativeAI(geminiApiKey);

  const model = genAI.getGenerativeModel({

    model: GEMINI_MODEL,

    generationConfig: {

      responseMimeType: "application/json",

      temperature: 0.92,

    },

  });



  const prompt = `Você é redator e diretor de arte da página oficial do AxéCloud (SaaS de gestão para terreiros e casas de axé no Brasil).



Tema de hoje: ${theme.label}.

${theme.instruction}



Referência visual sugerida para a imagem:

${theme.visualHint}

${IMAGE_PROMPT_RULES}



Regras da legenda:

- Português do Brasil, tom respeitoso e autêntico.

- 2 a 4 parágrafos curtos (máx. ~900 caracteres).

- 3 a 5 hashtags (#AxéCloud #Terreiro #Umbanda #Candomblé etc.).

- CTA suave para axecloud.com.br.



Responda SOMENTE com JSON:

{

  "caption": "legenda completa",

  "imagePrompt": "prompt visual em inglês, denso e específico"

}`;



  const result = await model.generateContent(prompt);

  const raw = result.response.text().trim();



  let parsed;

  try {

    parsed = JSON.parse(raw);

  } catch {

    throw new Error(`Gemini retornou JSON inválido: ${raw.slice(0, 300)}`);

  }



  const caption = String(parsed.caption || "").trim();

  const imagePrompt = String(parsed.imagePrompt || "").trim();



  if (!caption) {

    throw new Error("Gemini não retornou caption.");

  }



  return { caption, imagePrompt };

}



function getVisualPromptFallback(theme) {

  return `${theme.visualHint} Ultra-realistic sacred Afro-Brazilian terreiro photography, warm cinematic lighting, cultural authenticity, respectful, no text overlay, no watermark, square 1:1, no generic forest landscape, no abstract sun rays.`;

}



async function fetchImageBuffer(url, headers = {}) {

  const res = await fetch(url, {

    headers: { Accept: "image/*", ...headers },

    signal: AbortSignal.timeout(180_000),

  });

  if (!res.ok) {

    const body = await res.text().catch(() => "");

    return {

      ok: false,

      status: res.status,

      error: `HTTP ${res.status}: ${body.slice(0, 180)}`,

    };

  }

  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.length < 512 || buffer[0] === 0x7b) {

    return { ok: false, status: 0, error: "Resposta não é imagem válida." };

  }

  return { ok: true, buffer };

}



async function downloadPollinationsImage(visualPrompt, outputPath) {

  const apiKey = process.env.POLLINATIONS_API_KEY?.trim();

  const attempts = [];



  if (apiKey) {

    const url = new URL(

      `https://gen.pollinations.ai/image/${encodeURIComponent(visualPrompt)}`

    );

    url.searchParams.set("model", POLLINATIONS_MODEL);

    url.searchParams.set("width", "1080");

    url.searchParams.set("height", "1080");

    url.searchParams.set("nologo", "true");

    attempts.push({

      label: "gen.pollinations.ai",

      url: url.toString(),

      headers: { Authorization: `Bearer ${apiKey}` },

    });

  }



  attempts.push({

    label: "image.pollinations.ai",

    url:

      `https://image.pollinations.ai/prompt/${encodeURIComponent(visualPrompt)}` +

      `?model=${POLLINATIONS_MODEL}&width=1080&height=1080&nologo=true`,

    headers: {},

  });



  let lastError = "";

  for (let round = 1; round <= 3; round++) {

    if (round > 1) {

      const waitMs = round * 15_000;

      console.log(`[autopost] Pollinations ocupado — nova rodada em ${waitMs / 1000}s…`);

      await new Promise((r) => setTimeout(r, waitMs));

    }



    for (const attempt of attempts) {

      console.log(`[autopost] Renderizando imagem (${attempt.label})…`);

      const result = await fetchImageBuffer(attempt.url, attempt.headers);

      if (result.ok) {

        await fs.writeFile(outputPath, result.buffer);

        console.log(`[autopost] Imagem OK (${result.buffer.length} bytes)`);

        return outputPath;

      }

      lastError = result.error;

      if (result.status === 402 || result.status === 429) continue;

    }

  }



  throw new Error(

    lastError ||

      "Pollinations indisponível. Defina POLLINATIONS_API_KEY no .env para gen.pollinations.ai."

  );

}



async function applyWatermark(sourcePath, logoPath, outputPath) {

  const image = sharp(sourcePath);

  const metadata = await image.metadata();

  const width = metadata.width || 1080;

  const logoWidth = Math.max(72, Math.round(width * 0.11));



  const watermark = await sharp(logoPath)

    .resize({ width: logoWidth, withoutEnlargement: true })

    .ensureAlpha()

    .linear([1, 1, 1, 0.42], [0, 0, 0, 0])

    .png()

    .toBuffer();



  await image

    .composite([{ input: watermark, gravity: "southeast", blend: "over" }])

    .jpeg({ quality: 90, mozjpeg: true })

    .toFile(outputPath);



  return outputPath;

}



async function ensureTmpDir() {

  const dir = path.join(os.tmpdir(), "axecloud-autopost");

  await fs.mkdir(dir, { recursive: true });

  return dir;

}



async function saveReadyPost(caption, imagePath, dateSlug) {

  await fs.mkdir(READY_POSTS_DIR, { recursive: true });



  const imageDest = path.join(READY_POSTS_DIR, `${dateSlug}.jpg`);

  const captionDest = path.join(READY_POSTS_DIR, `${dateSlug}.txt`);



  await fs.copyFile(imagePath, imageDest);

  await fs.writeFile(captionDest, caption, "utf8");



  return { imageDest, captionDest };

}



async function evolutionRequest(path, body) {

  const baseUrl = evolutionBaseUrl();

  const apiKey = requireEnv("EVOLUTION_API_KEY");

  const res = await fetch(`${baseUrl}${path}`, {

    method: body ? "POST" : "GET",

    headers: {

      apikey: apiKey,

      "Content-Type": "application/json",

    },

    body: body ? JSON.stringify(body) : undefined,

    signal: AbortSignal.timeout(60_000),

  });

  const text = await res.text();

  let data;

  try {

    data = JSON.parse(text);

  } catch {

    data = { raw: text };

  }

  return { ok: res.ok, status: res.status, data };

}



async function ensureEvolutionReady() {

  const { ok, status, data } = await evolutionRequest(

    `/instance/connectionState/${encodeURIComponent(EVOLUTION_INSTANCE)}`

  );

  if (!ok) {

    throw new Error(

      `Instância "${EVOLUTION_INSTANCE}" indisponível (HTTP ${status}).`

    );

  }

  const state =

    data?.instance?.state ||

    data?.state ||

    data?.status ||

    "";

  if (String(state).toLowerCase() !== "open") {

    throw new Error(

      `WhatsApp "${EVOLUTION_INSTANCE}" desconectado (state=${state || "unknown"}). ` +

        "Pareie: https://axecloud.com.br/ready-posts/parear.html"

    );

  }

}



async function sendViaEvolution(caption, imagePath, dateSlug) {

  const number = WHATSAPP_TO;

  if (!number) {

    throw new Error("Defina AUTOPOST_WHATSAPP_TO com DDI + DDD + número.");

  }



  await ensureEvolutionReady();



  const fileName = `${dateSlug}.jpg`;

  const path = `/message/sendMedia/${encodeURIComponent(EVOLUTION_INSTANCE)}`;

  let payload;



  if (EVOLUTION_INTEGRATION === "business") {

    const publicBase = (

      process.env.APP_PUBLIC_URL || "https://axecloud.com.br"

    ).replace(/\/$/, "");

    payload = {

      number,

      mediatype: "image",

      mimetype: "image/jpeg",

      caption,

      media: `${publicBase}/ready-posts/${dateSlug}.jpg`,

      fileName,

    };

  } else {

    const buffer = await fs.readFile(imagePath);

    payload = {

      number,

      mediatype: "image",

      mimetype: "image/jpeg",

      caption,

      media: buffer.toString("base64"),

      fileName,

    };

  }



  const { ok, status, data } = await evolutionRequest(path, payload);

  if (data?.code === 132001 || data?.error_data) {

    throw new Error(`Meta Cloud API recusou: ${JSON.stringify(data)}`);

  }

  if (!ok && status !== 201) {

    throw new Error(`Evolution API (${status}): ${JSON.stringify(data)}`);

  }



  return data;

}



async function main() {

  const startedAt = new Date().toISOString();

  const dateSlug = todayDateSlug();

  console.log(`[autopost] Início ${startedAt} | data ${dateSlug}`);



  const geminiApiKey = requireEnv("GEMINI_API_KEY");

  const theme = pickTheme();

  console.log(`[autopost] Tema: ${theme.label}`);



  const tmpDir = await ensureTmpDir();

  const stamp = Date.now();

  const rawImagePath = path.join(tmpDir, `raw-${stamp}.png`);

  const finalImagePath = path.join(tmpDir, `post-${stamp}.jpg`);



  const logoPath = await resolveLogoPath();



  console.log("[autopost] Gemini: legenda + prompt visual…");

  const { caption, imagePrompt } = await generatePostContent(

    geminiApiKey,

    theme

  );

  const visualPrompt = imagePrompt || getVisualPromptFallback(theme);



  console.log("[autopost] Legenda:");

  console.log(caption);

  console.log("[autopost] Prompt visual (Gemini):", visualPrompt);



  await downloadPollinationsImage(visualPrompt, rawImagePath);



  console.log("[autopost] Marca d'água…");

  await applyWatermark(rawImagePath, logoPath, finalImagePath);



  const { imageDest, captionDest } = await saveReadyPost(

    caption,

    finalImagePath,

    dateSlug

  );

  console.log(`[autopost] Salvo: ${imageDest}`);



  if (DRY_RUN) {

    console.log("[autopost] DRY RUN — WhatsApp ignorado.");

    return;

  }



  console.log(

    `[autopost] WhatsApp → ${WHATSAPP_TO} via ${EVOLUTION_INSTANCE}…`

  );

  const waResponse = await sendViaEvolution(caption, imageDest, dateSlug);

  console.log("[autopost] Enviado:", waResponse?.key?.id || "ok");



  try {

    await fs.unlink(rawImagePath);

    await fs.unlink(finalImagePath);

  } catch {

    // ignora

  }

}



main().catch((err) => {

  console.error("[autopost] Erro:", err.message || err);

  process.exit(1);

});


