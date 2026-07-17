# Deploy 100GB landing copy to VPS
$ErrorActionPreference = "Stop"
$ssh = @("ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=25", "axecloud-vps")

function Invoke-Vps([string]$RemoteCmd) {
  Write-Host ">>> $RemoteCmd"
  & ssh -o BatchMode=yes -o ConnectTimeout=25 axecloud-vps $RemoteCmd
  if ($LASTEXITCODE -ne 0) { throw "SSH failed: $LASTEXITCODE" }
}

# Upload patch script
$local = "C:\Users\Lucas A\Desktop\AxecloudV2\AxecloudV2\deploy\scripts\patch-100gb-landing.py"
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($local))
$upload = "echo $b64 | base64 -d > /opt/axecloud/deploy/scripts/patch-100gb-landing.py && wc -c /opt/axecloud/deploy/scripts/patch-100gb-landing.py"
Invoke-Vps $upload
Invoke-Vps "python3 /opt/axecloud/deploy/scripts/patch-100gb-landing.py"
Invoke-Vps "grep -n '100 GB de galeria' /opt/axecloud/src/views/Landing.tsx"
Invoke-Vps "grep -n '100 GB de fotos' /opt/axecloud/src/components/landing/MatrizLandingExperience.tsx"
Invoke-Vps "grep -n '100 GB por terreiro' /opt/axecloud/src/constants/seoHome.ts"

Write-Host ">>> Building marketing..."
& ssh -o BatchMode=yes -o ConnectTimeout=25 axecloud-vps "cd /opt/axecloud && docker compose -f deploy/docker-compose.yml --env-file .env build marketing && docker compose -f deploy/docker-compose.yml --env-file .env up -d marketing && docker compose -f deploy/docker-compose.yml --env-file .env ps marketing"
if ($LASTEXITCODE -ne 0) { throw "marketing build failed" }

Start-Sleep -Seconds 5
Write-Host ">>> Checking live site..."
& ssh -o BatchMode=yes -o ConnectTimeout=25 axecloud-vps "curl -sS https://axecloud.com.br/ | grep -o '100 GB' | head -5; echo LIVE_CHECK_DONE"
Write-Host "DONE"
