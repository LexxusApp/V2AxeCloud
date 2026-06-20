#!/usr/bin/env bash
# Monitoramento durante stress test. Uso na VPS: bash deploy/scripts/stress-monitor-vps.sh
set -euo pipefail

INTERVAL="${STRESS_MONITOR_INTERVAL:-5}"
echo "AxéCloud stress monitor — intervalo ${INTERVAL}s (Ctrl+C para parar)"
echo "timestamp | load | mem_used | app_cpu | app_mem | caddy_cpu | redis_cpu"
echo "------------------------------------------------------------------------"

while true; do
  TS=$(date -u +"%H:%M:%S")
  LOAD=$(awk '{print $1" "$2" "$3}' /proc/loadavg 2>/dev/null || echo "? ? ?")
  MEM=$(free -m 2>/dev/null | awk '/Mem:/ {printf "%s/%sMB", $3, $2}' || echo "?")

  STATS=$(docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null \
    | grep -E "deploy-app-1|deploy-caddy-1|deploy-redis-1" || true)

  APP=$(echo "$STATS" | awk -F'\t' '$1 ~ /app-1/ {print $2" "$3}')
  CADDY=$(echo "$STATS" | awk -F'\t' '$1 ~ /caddy-1/ {print $2" "$3}')
  REDIS=$(echo "$STATS" | awk -F'\t' '$1 ~ /redis-1/ {print $2" "$3}')

  printf "%s | load %s | %s | app %s | caddy %s | redis %s\n" \
    "$TS" "$LOAD" "$MEM" "${APP:--}" "${CADDY:--}" "${REDIS:--}"

  sleep "$INTERVAL"
done
