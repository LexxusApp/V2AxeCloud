/**
 * Converte HTML público em Markdown para agentes (content negotiation).
 * Remove chrome (nav, script, footer) e preserva título, texto, links e JSON-LD.
 */

const SITE_ORIGIN = "https://axecloud.com.br";
const STRIP_TAGS = [
  "script",
  "style",
  "nav",
  "footer",
  "header",
  "noscript",
  "svg",
  "iframe",
  "canvas",
  "form",
  "template",
];

function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
}

function extractMeta(html, key) {
  const named = html.match(
    new RegExp(`<meta\\b[^>]*?(?:name|property)=["']${key}["'][^>]*>`, "i"),
  );
  if (named) return decodeEntities(attr(named[0], "content")).trim();
  const reversed = html.match(
    new RegExp(
      `<meta\\b[^>]*?content=["']([^"']*)["'][^>]*?(?:name|property)=["']${key}["']`,
      "i",
    ),
  );
  return decodeEntities(reversed?.[1] || "").trim();
}

function yamlValue(value) {
  return JSON.stringify(String(value));
}

function absoluteUrl(href) {
  if (!href || href.startsWith("javascript:") || href === "#") return "";
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${SITE_ORIGIN}${href}`;
  return href;
}

function stripBlocks(html) {
  let work = html;
  for (const tag of STRIP_TAGS) {
    work = work.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), "\n");
    work = work.replace(new RegExp(`<${tag}\\b[^>]*/>`, "gi"), "");
  }
  return work.replace(/<!--[\s\S]*?-->/g, "");
}

function toMarkdownBody(html) {
  let work = stripBlocks(html);
  work = work.replace(/<br\s*\/?>/gi, "\n");
  work = work.replace(/<\/p>/gi, "\n\n");
  work = work.replace(/<\/div>/gi, "\n");
  work = work.replace(/<\/h([1-6])>/gi, "\n\n");
  work = work.replace(/<h([1-6])\b[^>]*>/gi, (_, level) => `\n\n${"#".repeat(Number(level))} `);
  work = work.replace(/<li\b[^>]*>/gi, "\n- ");
  work = work.replace(/<\/li>/gi, "");
  work = work.replace(/<(strong|b)\b[^>]*>/gi, "**");
  work = work.replace(/<\/(strong|b)>/gi, "**");
  work = work.replace(/<(em|i)\b[^>]*>/gi, "*");
  work = work.replace(/<\/(em|i)>/gi, "*");
  work = work.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (tag) => {
    const href = absoluteUrl(attr(tag, "href"));
    const text = decodeEntities(tag.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (!text) return "";
    return href ? `[${text}](${href})` : text;
  });
  work = work.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = decodeEntities(attr(tag, "alt")).trim();
    const src = absoluteUrl(attr(tag, "src"));
    if (!alt || !src) return "";
    return `\n![${alt}](${src})\n`;
  });
  work = work.replace(/<[^>]+>/g, " ");
  work = decodeEntities(work).replace(/\u00a0/g, " ");
  work = work.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  return work.trim();
}

export function htmlToAgentMarkdown(html, pageUrl = "") {
  const source = String(html || "");
  const title = decodeEntities(
    (source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, ""),
  ).replace(/\s+/g, " ").trim();
  const description =
    extractMeta(source, "description") || extractMeta(source, "og:description");
  const image = extractMeta(source, "og:image");
  const jsonLd = [...source.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )]
    .map((match) => match[1].trim())
    .filter(Boolean);

  const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const article = source.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const fragment = main?.[1] || article?.[1] || body?.[1] || source;
  const markdownBody = toMarkdownBody(fragment);

  const front = [];
  if (title) front.push(`title: ${yamlValue(title)}`);
  if (description) front.push(`description: ${yamlValue(description)}`);
  if (image) front.push(`image: ${yamlValue(image)}`);
  if (pageUrl) front.push(`url: ${yamlValue(pageUrl)}`);

  const parts = [];
  if (front.length) parts.push(`---\n${front.join("\n")}\n---`);
  if (title) parts.push(`# ${title}`);
  if (markdownBody) parts.push(markdownBody);
  if (jsonLd.length) parts.push("```json\n" + jsonLd.join("\n") + "\n```");
  return `${parts.join("\n\n").trim()}\n`;
}
