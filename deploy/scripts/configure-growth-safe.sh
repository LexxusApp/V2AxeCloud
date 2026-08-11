#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-/opt/axecloud/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ENV_FILE_NOT_FOUND"
  exit 1
fi

BACKUP="${ENV_FILE}.backup-growth-$(date +%Y%m%d%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
chmod 600 "$BACKUP" "$ENV_FILE"

upsert() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

configured() {
  local key="$1"
  if grep -q "^${key}=." "$ENV_FILE"; then
    printf '%s_CONFIGURED=yes\n' "$key"
  else
    printf '%s_CONFIGURED=no\n' "$key"
  fi
}

upsert GROWTH_SAFE_OUTREACH_ENABLED true
upsert GROWTH_SAFE_OUTREACH_TEST_MODE true
upsert GROWTH_AI_SALES_ENABLED false

echo "GROWTH_SAFE_OUTREACH_ENABLED=true"
echo "GROWTH_SAFE_OUTREACH_TEST_MODE=true"
echo "GROWTH_AI_SALES_ENABLED=false"
configured GEMINI_API_KEY
configured SMTP_USER
configured SMTP_PASS
echo "BACKUP_CREATED=$(basename "$BACKUP")"
