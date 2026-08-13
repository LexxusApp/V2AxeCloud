#!/usr/bin/env bash
# Valida SEO técnico: redirects, sitemap XML e conteúdo indexável.
# Uso: BASE_URL=https://axecloud.com.br bash deploy/scripts/smoke-seo.sh
set -euo pipefail

BASE="${BASE_URL:-https://axecloud.com.br}"

echo "=== SEO smoke (${BASE}) ==="

# URL legada → cadastro (301)
check_redirect() {
  local path="$1"
  local expect="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}${path}")"
  if [[ "$code" != "$expect" ]]; then
    echo "FAIL ${path} — HTTP ${code} (esperado ${expect}, sem seguir redirect)"
    exit 1
  fi
  echo "OK   ${path} — ${code} (redirect)"
}

check_redirect "/programa-fundador" "301"
final_url="$(curl -sS -o /dev/null -w '%{url_effective}' -L --max-redirs 3 "${BASE}/programa-fundador")"
echo "$final_url" | grep -qi '/register' || {
  echo "FAIL /programa-fundador — redirect não aponta para /register (${final_url})"
  exit 1
}
echo "OK   /programa-fundador — redireciona para cadastro"

# sitemap.xml deve ser XML, não HTML
sitemap_type="$(curl -sS -I "${BASE}/sitemap.xml" | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tr -d '\r' | head -1)"
echo "$sitemap_type" | grep -q 'xml' || {
  echo "FAIL /sitemap.xml — Content-Type: ${sitemap_type:-ausente} (esperado XML)"
  exit 1
}
echo "OK   /sitemap.xml — ${sitemap_type}"

sitemap_tmp="$(mktemp)"
curl -sS -o "$sitemap_tmp" "${BASE}/sitemap.xml"
for required_path in \
  "/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro" \
  "/conteudo/como-instalar-axecloud-celular-pwa" \
  "/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro" \
  "/conteudo/melhor-software-terreiro-2026-o-que-avaliar" \
  "/por-que-axecloud/vs-planilhas" \
  "/recursos" \
  "/recursos/financeiro-pix-mensalidades" \
  "/conteudo/como-cobrar-mensalidade-terreiro-sem-constranger"; do
  grep -q "$required_path" "$sitemap_tmp" || {
    echo "FAIL /sitemap.xml — falta ${required_path}"
    rm -f "$sitemap_tmp"
    exit 1
  }
done

# llms.txt deve existir
curl -sS -o /dev/null -w '%{http_code}' "${BASE}/llms.txt" | grep -qE '200' || {
  echo "FAIL /llms.txt — não retornou HTTP 200"
  exit 1
}
echo "OK   /llms.txt — 200"

lastmod_total="$(grep -o '<lastmod>[^<]*</lastmod>' "$sitemap_tmp" | wc -l | tr -d ' ')"
lastmod_unique="$(grep -o '<lastmod>[^<]*</lastmod>' "$sitemap_tmp" | sort -u | wc -l | tr -d ' ')"
if [[ "$lastmod_total" -gt 100 && "$lastmod_unique" -le 1 ]]; then
  echo "FAIL /sitemap.xml — todas as URLs usam a mesma data artificial"
  rm -f "$sitemap_tmp"
  exit 1
fi
rm -f "$sitemap_tmp"
echo "OK   /sitemap.xml — artigos comerciais e datas verificáveis"

# Typo sitemap.xm → redirect ou XML (nunca SPA HTML)
# Typo sitemap.xm → XML (redirect ou conteúdo válido)
xm_tmp="$(mktemp)"
xm_final="$(curl -sS -o "$xm_tmp" -w '%{url_effective}' -L --max-redirs 5 "${BASE}/sitemap.xm")"
if [[ "$xm_final" != *sitemap.xml* ]] && ! grep -qE '<urlset|<\?xml' "$xm_tmp" 2>/dev/null; then
  echo "FAIL /sitemap.xm — não redireciona para XML válido (final: ${xm_final})"
  rm -f "$xm_tmp"
  exit 1
fi
rm -f "$xm_tmp"
echo "OK   /sitemap.xm — redireciona para sitemap XML"

# Keywords principais na home
curl -sS "${BASE}/" | grep -Eqi 'gest.{1,2}o de terreiros' || {
  echo "FAIL / — falta keyword \"gestão de terreiros\""
  exit 1
}
echo "OK   / — contém \"gestão de terreiros\""

# Markdown for Agents — content negotiation
md_headers="$(mktemp)"
md_body="$(mktemp)"
curl -sS -D "$md_headers" -o "$md_body" -H "Accept: text/markdown" "${BASE}/"
grep -qiE '^content-type:[[:space:]]*text/markdown' "$md_headers" || {
  echo "FAIL / Accept: text/markdown — Content-Type não é text/markdown"
  rm -f "$md_headers" "$md_body"
  exit 1
}
grep -qiE '^vary:.*accept' "$md_headers" || {
  echo "FAIL / Accept: text/markdown — falta Vary: Accept"
  rm -f "$md_headers" "$md_body"
  exit 1
}
grep -qi 'AxéCloud\|AxeCloud' "$md_body" || {
  echo "FAIL / Accept: text/markdown — corpo sem conteúdo da marca"
  rm -f "$md_headers" "$md_body"
  exit 1
}
if grep -qiE '<html|<script' "$md_body"; then
  echo "FAIL / Accept: text/markdown — corpo ainda é HTML"
  rm -f "$md_headers" "$md_body"
  exit 1
fi
rm -f "$md_headers" "$md_body"
echo "OK   / Accept: text/markdown — Markdown para agentes"

# RFC 9727 — catálogo de APIs públicas (não HTML da SPA)
catalog_headers="$(mktemp)"
catalog_body="$(mktemp)"
curl -sS -D "$catalog_headers" -o "$catalog_body" "${BASE}/.well-known/api-catalog"
grep -qiE '^content-type:[[:space:]]*application/linkset\+json' "$catalog_headers" || {
  echo "FAIL /.well-known/api-catalog — Content-Type não é application/linkset+json"
  rm -f "$catalog_headers" "$catalog_body"
  exit 1
}
grep -q '"linkset"' "$catalog_body" || {
  echo "FAIL /.well-known/api-catalog — JSON sem linkset"
  rm -f "$catalog_headers" "$catalog_body"
  exit 1
}
if grep -qiE '<html|<script' "$catalog_body"; then
  echo "FAIL /.well-known/api-catalog — ainda devolve HTML"
  rm -f "$catalog_headers" "$catalog_body"
  exit 1
fi
rm -f "$catalog_headers" "$catalog_body"
echo "OK   /.well-known/api-catalog — Linkset RFC 9727"

# Página de cidade do diretório — Googlebot deve receber HTML SEO (não a home)
city_tmp="$(mktemp)"
curl -sS -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  -o "$city_tmp" "${BASE}/terreiros/sp/suzano"
grep -qi 'Terreiros em Suzano' "$city_tmp" || {
  echo "FAIL /terreiros/sp/suzano (Googlebot) — HTML não contém título da cidade (possível fallback da home)"
  rm -f "$city_tmp"
  exit 1
}
rm -f "$city_tmp"
echo "OK   /terreiros/sp/suzano (Googlebot) — HTML SEO da cidade"

echo "=== SEO smoke passou ==="
