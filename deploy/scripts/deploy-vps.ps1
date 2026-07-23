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
  [ValidateSet("app", "marketing", "caddy", "admin")]
  [string[]]$Services,

  [string]$HostAlias = $(if ($env:AXECLOUD_VPS_HOST) { $env:AXECLOUD_VPS_HOST } else { "axecloud-vps" })
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$sshHelper = Join-Path $here "vps-ssh.ps1"
if (-not (Test-Path $sshHelper)) { throw "Helper ausente: $sshHelper" }

$svc = ($Services | ForEach-Object { $_.Trim().ToLowerInvariant() } | Select-Object -Unique) -join " "
if (-not $svc) { throw "Informe ao menos um servico." }

$remote = @"
set -euo pipefail
cd /opt/axecloud
git pull --ff-only origin main
docker compose -f deploy/docker-compose.yml --env-file .env build $svc
docker compose -f deploy/docker-compose.yml --env-file .env up -d $svc
docker compose -f deploy/docker-compose.yml --env-file .env ps $svc
echo DEPLOY_OK
"@.Trim() -replace "`r", ""

# Uma linha para o ssh remoto
$remoteOneLine = ($remote -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join " && "

Write-Host "=== Deploy VPS: $svc ==="
$env:AXECLOUD_VPS_HOST = $HostAlias
& powershell -NoProfile -File $sshHelper -RemoteCommand $remoteOneLine
if ($LASTEXITCODE -ne 0) { throw "Deploy falhou (exit $LASTEXITCODE)" }
Write-Host "=== Deploy concluido (SSH encerrado) ==="
exit 0
