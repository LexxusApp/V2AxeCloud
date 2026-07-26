#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$sshHelper = Join-Path $here "vps-ssh.ps1"
$diag = Join-Path $here "diag-efi-pix-runtime.mjs"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([IO.File]::ReadAllText($diag)))
$remote = "echo $b64 | base64 -d > /tmp/diag-efi-pix-runtime.mjs && docker cp /tmp/diag-efi-pix-runtime.mjs deploy-app-1:/tmp/diag-efi-pix-runtime.mjs && docker exec deploy-app-1 node /tmp/diag-efi-pix-runtime.mjs"
& powershell -NoProfile -ExecutionPolicy Bypass -File $sshHelper -RemoteCommand $remote
if ($LASTEXITCODE -ne 0) { throw "diag failed ($LASTEXITCODE)" }
