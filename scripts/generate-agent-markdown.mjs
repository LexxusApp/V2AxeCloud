/**
 * Gera index.md ao lado de cada index.html em landing-dist
 * para content negotiation (Accept: text/markdown).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToAgentMarkdown } from "./htmlToAgentMarkdown.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "landing-dist");
const SITE_ORIGIN = "https://axecloud.com.br";

function publicUrlForDir(dir) {
  const relative = path.relative(OUT, dir).replace(/\\/g, "/");
  if (!relative || relative === ".") return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}/${relative.replace(/\/+$/, "")}`;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === "index.html") files.push(full);
  }
  return files;
}

if (!fs.existsSync(OUT)) {
  throw new Error("[agent-markdown] landing-dist ausente — rode o build da landing antes.");
}

const pages = walk(OUT);
if (!pages.length) {
  throw new Error("[agent-markdown] nenhum index.html em landing-dist.");
}

let written = 0;
for (const htmlPath of pages) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const markdown = htmlToAgentMarkdown(html, publicUrlForDir(path.dirname(htmlPath)));
  if (!markdown.trim()) continue;
  fs.writeFileSync(path.join(path.dirname(htmlPath), "index.md"), markdown, "utf8");
  written += 1;
}

const homeMd = path.join(OUT, "index.md");
if (!fs.existsSync(homeMd) || !fs.readFileSync(homeMd, "utf8").includes("AxéCloud")) {
  throw new Error("[agent-markdown] index.md da home inválido ou ausente.");
}

console.log(`[agent-markdown] ${written} página(s) em Markdown para agentes.`);
