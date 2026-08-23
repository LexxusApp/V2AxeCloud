#Requires -Version 5.1
<#
.SYNOPSIS
  Pull + rebuild de servicos na VPS com SSH que fecha sozinho.

.EXAMPLE
  .\deploy\scripts\deploy-vps.ps1 -Services app
  .\deploy\scripts\deploy-vps.ps1 -Services marketing
  .\deploy\scripts\deploy-vps.ps1 -Services app,marketing
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("app", "marketing", "site-home", "caddy", "admin")]
  [string[]]$Services,

  [string]$HostAlias = $(if ($env:AXECLOUD_VPS_HOST) { $env:AXECLOUD_VPS_HOST } else { "axecloud-vps" })
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$sshHelper = Join-Path $here "vps-ssh.ps1"
if (-not (Test-Path $sshHelper)) { throw "Helper ausente: $sshHelper" }

$svc = ($Services | ForEach-Object { $_.Trim().ToLowerInvariant() } | Select-Object -Unique) -join " "
if (-not $svc) { throw "Informe ao menos um servico." }

$remote = @'
set -euo pipefail
cd /opt/axecloud
git fetch origin main
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[deploy] working tree suja — git stash antes do merge"
  git stash push -u -m "deploy-auto-stash-$(date +%s)"
fi
git merge --ff-only origin/main
needs_marketing=false
for s in __AXECLOUD_SERVICES__; do
  [ "$s" = "marketing" ] && needs_marketing=true
done
if $needs_marketing; then
  echo "[deploy] app primeiro (marketing prerender depende da API)"
  docker compose -f deploy/docker-compose.yml --env-file .env up -d app
  for i in $(seq 1 24); do
    st=$(docker inspect -f '{{.State.Health.Status}}' deploy-app-1 2>/dev/null || echo starting)
    echo "[deploy] app health: $st"
    [ "$st" = "healthy" ] && break
    sleep 5
  done
fi
docker compose -f deploy/docker-compose.yml --env-file .env build __AXECLOUD_SERVICES__
docker compose -f deploy/docker-compose.yml --env-file .env up -d __AXECLOUD_SERVICES__
docker compose -f deploy/docker-compose.yml --env-file .env ps __AXECLOUD_SERVICES__
echo DEPLOY_OK
'@.Trim() -replace "`r", ""
$remote = $remote.Replace('__AXECLOUD_SERVICES__', $svc)

# Uma linha para o ssh remoto
$remoteOneLine = ($remote -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join " && "

Write-Host "=== Deploy VPS: $svc ==="
$env:AXECLOUD_VPS_HOST = $HostAlias
& powershell -NoProfile -File $sshHelper -RemoteCommand $remoteOneLine
if ($LASTEXITCODE -ne 0) { throw "Deploy falhou (exit $LASTEXITCODE)" }
Write-Host "=== Deploy concluido (SSH encerrado) ==="
exit 0
