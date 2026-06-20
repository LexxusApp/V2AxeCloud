# Baseline stress test
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\resolve-k6.ps1"
$k6 = Resolve-K6

$env:BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "https://axecloud.com.br" }
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
Write-Host "Stress baseline -> $env:BASE_URL (k6: $k6)"
& $k6 run scripts/stress/k6-baseline.js
