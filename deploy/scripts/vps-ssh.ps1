#Requires -Version 5.1
<#
.SYNOPSIS
  SSH para axecloud-vps que encerra o processo local ao terminar o remoto.

.EXAMPLE
  .\deploy\scripts\vps-ssh.ps1 "cd /opt/axecloud && hostname"
#>
param(
  [Parameter(Position = 0, Mandatory = $true)]
  [Alias("Command")]
  [string]$RemoteCommand,

  [int]$HangGraceMs = 400,
  [int]$HardTimeoutSec = 1200
)

$ErrorActionPreference = "Stop"
$hostAlias = if ($env:AXECLOUD_VPS_HOST) { $env:AXECLOUD_VPS_HOST } else { "axecloud-vps" }
$remote = ($RemoteCommand -replace "`r", "").Trim()
if (-not $remote) { throw "Comando remoto vazio." }

$sshExe = (Get-Command ssh.exe -ErrorAction Stop).Source
$identityFile = Join-Path $env:USERPROFILE ".ssh\contabo_axecloud"
if (-not (Test-Path -LiteralPath $identityFile)) {
  throw "Chave SSH ausente: $identityFile"
}
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("axe-ssh-" + [guid]::NewGuid().ToString("n"))
$inFile = "$tmp.in"
$outFile = "$tmp.out"
$errFile = "$tmp.err"
[IO.File]::WriteAllText($inFile, "", (New-Object Text.UTF8Encoding($false)))

function Read-SharedText([string]$path) {
  if (-not (Test-Path $path)) { return "" }
  $fs = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
  try {
    $sr = New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8, $true)
    try { return $sr.ReadToEnd() } finally { $sr.Dispose() }
  } finally { $fs.Dispose() }
}

$remoteOneLine = (($remote -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join " && "
# Literal $? para o bash remoto (string single-quoted concatenation)
$remoteScript = $remoteOneLine + '; echo __AXE_SSH_DONE__:$?'

# Escape estilo Windows CreateProcess: aspas internas dobradas
function Escape-WinArg([string]$s) {
  if ($s -notmatch '[ \t\"]') { return $s }
  '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"'
}

$sshArgs = @(
  "-T",
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=25",
  "-o", "ServerAliveInterval=10",
  "-o", "ServerAliveCountMax=3",
  "-o", "RequestTTY=no",
  "-i", (Escape-WinArg $identityFile),
  "-o", "IdentitiesOnly=yes",
  (Escape-WinArg $hostAlias),
  (Escape-WinArg $remoteScript)
) -join " "

Write-Host ">>> ssh $hostAlias (-T; stdin vazio; auto-kill apos DONE)"

$proc = Start-Process -FilePath $sshExe -ArgumentList $sshArgs `
  -RedirectStandardInput $inFile `
  -RedirectStandardOutput $outFile -RedirectStandardError $errFile `
  -WindowStyle Hidden -PassThru
$deadline = [DateTime]::UtcNow.AddSeconds($HardTimeoutSec)
$outShown = 0
$errShown = 0
$doneCode = $null

function Write-NewOutput([string]$path, [ref]$shown) {
  $content = Read-SharedText $path
  if ($content.Length -gt $shown.Value) {
    [Console]::Out.Write($content.Substring($shown.Value))
    $shown.Value = $content.Length
  }
  return $content
}

try {
  while ($true) {
    $stdout = Write-NewOutput $outFile ([ref]$outShown)
    $stderr = Write-NewOutput $errFile ([ref]$errShown)
    $blob = $stdout + "`n" + $stderr
    if ($null -eq $doneCode -and $blob -match '__AXE_SSH_DONE__:(\d+)') {
      $doneCode = [int]$Matches[1]
    }

    if ($null -ne $doneCode) {
      Start-Sleep -Milliseconds $HangGraceMs
      if (-not $proc.HasExited) {
        Write-Host ">>> remoto concluiu; encerrando ssh local pendurado"
        try { $proc.Kill() } catch { }
      }
      break
    }

    if ($proc.HasExited) { break }

    if ([DateTime]::UtcNow -gt $deadline) {
      try { $proc.Kill() } catch { }
      throw "SSH hard timeout (${HardTimeoutSec}s)"
    }
    Start-Sleep -Milliseconds 80
  }

  Start-Sleep -Milliseconds 200
  $stdout = Write-NewOutput $outFile ([ref]$outShown)
  $stderr = Write-NewOutput $errFile ([ref]$errShown)
  $blob = $stdout + "`n" + $stderr
  if ($null -eq $doneCode -and $blob -match '__AXE_SSH_DONE__:(\d+)') {
    $doneCode = [int]$Matches[1]
  }

  $exitCode = if ($null -ne $doneCode) { $doneCode } else { $proc.ExitCode }
  if ($null -eq $exitCode) { $exitCode = 1 }
  if ($exitCode -ne 0) {
    throw "SSH falhou com exit code $exitCode"
  }
}
finally {
  try { if (-not $proc.HasExited) { $proc.Kill() } } catch { }
  try { $proc.Dispose() } catch { }
  Remove-Item -Force -ErrorAction SilentlyContinue $inFile, $outFile, $errFile
}

Write-Host ">>> ssh encerrado"
exit 0
