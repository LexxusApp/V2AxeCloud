#!/usr/bin/env bash
# Valida SEO técnico: redirects, sitemap XML e conteúdo indexável.
# Uso: BASE_URL=https://axecloud.com.br bash deploy/scripts/smoke-seo.sh
set -euo pipefail

BASE="${BASE_URL:-https://axecloud.com.br}"

echo "=== SEO smoke (${BASE}) ==="

# Sem loop de redirect (bug nginx+Caddy que quebrava o Google)
redirects="$(curl -sS -o /dev/null -w '%{num_redirects}' -L --max-redirs 5 "${BASE}/programa-fundador")"
if [[ "$redirects" -gt 1 ]]; then
  echo "FAIL /programa-fundador — ${redirects} redirects (esperado ≤1)"
  exit 1
fi
code="$(curl -sS -o /dev/null -w '%{http_code}' -L --max-redirs 5 "${BASE}/programa-fundador")"
[[ "$code" == "200" ]] || { echo "FAIL /programa-fundador — HTTP ${code}"; exit 1; }
echo "OK   /programa-fundador — 200 (${redirects} redirect(s))"

# Barra final → canonical sem barra (1 redirect no máximo)
trail_code="$(curl -sS -o /dev/null -w '%{http_code}' -L --max-redirs 3 "${BASE}/programa-fundador/")"
[[ "$trail_code" == "200" ]] || { echo "FAIL /programa-fundador/ — HTTP ${trail_code}"; exit 1; }
echo "OK   /programa-fundador/ — 200 após canonical"

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

# Pré-render do programa fundador (conteúdo estático para crawlers)
curl -sS "${BASE}/programa-fundador" | grep -qi 'Programa Fundador' || {
  echo "FAIL /programa-fundador — falta conteúdo estático"
  exit 1
}
echo "OK   /programa-fundador — conteúdo indexável"

echo "=== SEO smoke passou ==="
