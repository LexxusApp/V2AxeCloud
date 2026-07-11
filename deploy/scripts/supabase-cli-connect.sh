#!/usr/bin/env bash
# Conecta o Supabase CLI ao projeto remoto e aplica migrations pendentes.
# Uso na VPS: SUPABASE_ACCESS_TOKEN=sbp_xxx bash deploy/scripts/supabase-cli-connect.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-vlaojhfwhqmwudqsumpi}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Instale o Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Defina SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)"
  exit 1
fi

supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase link --project-ref "$PROJECT_REF"
supabase db push

echo "OK — projeto ${PROJECT_REF} ligado e migrations aplicadas."
