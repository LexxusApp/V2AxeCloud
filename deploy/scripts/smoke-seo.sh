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
curl -sS "${BASE}/" | grep -qi 'gestão de terreiros' || {
  echo "FAIL / — falta keyword \"gestão de terreiros\""
  exit 1
}
echo "OK   / — contém \"gestão de terreiros\""

echo "=== SEO smoke passou ==="
