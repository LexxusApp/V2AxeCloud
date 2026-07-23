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
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("axe-ssh-" + [guid]::NewGuid().ToString("n"))
$outFile = "$tmp.out"
$errFile = "$tmp.err"

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

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $sshExe
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.RedirectStandardInput = $true
$psi.Arguments = @(
  "-n", "-T",
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=25",
  "-o", "ServerAliveInterval=10",
  "-o", "ServerAliveCountMax=3",
  "-o", "RequestTTY=no",
  (Escape-WinArg $hostAlias),
  (Escape-WinArg $remoteScript)
) -join " "

Write-Host ">>> ssh $hostAlias (-n -T; auto-kill apos DONE)"

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$null = $proc.Start()
$proc.StandardInput.Close()

# Async line readers into StringBuilders + console
$outSb = New-Object System.Text.StringBuilder
$errSb = New-Object System.Text.StringBuilder
$doneCode = [ref]$null

$outAction = [Action[object, System.Diagnostics.DataReceivedEventArgs]]{
  param($sender, $e)
  if ($null -eq $e.Data) { return }
  [Console]::Out.WriteLine($e.Data)
  [void]$outSb.AppendLine($e.Data)
  if ($e.Data -match '^__AXE_SSH_DONE__:(\d+)\s*$') {
    $doneCode.Value = [int]$Matches[1]
  }
}
# PowerShell 5.1: Register-ObjectEvent is safer than Action for cross-thread
Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
  $line = $EventArgs.Data
  if ($null -eq $line) { return }
  [Console]::Out.WriteLine($line)
  [void]$Event.MessageData.Out.AppendLine($line)
  if ($line -match '^__AXE_SSH_DONE__:(\d+)\s*$') {
    $Event.MessageData.Done.Value = [int]$Matches[1]
  }
} -MessageData @{ Out = $outSb; Done = $doneCode } | Out-Null

Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
  $line = $EventArgs.Data
  if ($null -eq $line) { return }
  [Console]::Out.WriteLine($line)
  [void]$Event.MessageData.Err.AppendLine($line)
  if ($line -match '^__AXE_SSH_DONE__:(\d+)\s*$') {
    $Event.MessageData.Done.Value = [int]$Matches[1]
  }
} -MessageData @{ Err = $errSb; Done = $doneCode } | Out-Null

$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()

$deadline = [DateTime]::UtcNow.AddSeconds($HardTimeoutSec)
try {
  while ($true) {
    # Also scan builders in case event race
    $blob = $outSb.ToString() + "`n" + $errSb.ToString()
    if ($null -eq $doneCode.Value -and $blob -match '__AXE_SSH_DONE__:(\d+)') {
      $doneCode.Value = [int]$Matches[1]
    }

    if ($null -ne $doneCode.Value) {
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

  if (-not $proc.HasExited) {
    try { $null = $proc.WaitForExit(800) } catch { }
    try { $proc.Kill() } catch { }
  }

  # Final scan
  Start-Sleep -Milliseconds 200
  $blob = $outSb.ToString() + "`n" + $errSb.ToString()
  if ($null -eq $doneCode.Value -and $blob -match '__AXE_SSH_DONE__:(\d+)') {
    $doneCode.Value = [int]$Matches[1]
  }

  $exitCode = if ($null -ne $doneCode.Value) { $doneCode.Value } else { $proc.ExitCode }
  if ($null -eq $exitCode) { $exitCode = 1 }
  if ($exitCode -ne 0) {
    throw "SSH falhou com exit code $exitCode"
  }
}
finally {
  Get-EventSubscriber | Where-Object { $_.SourceObject -eq $proc } | Unregister-Event -Force -ErrorAction SilentlyContinue
  try { if (-not $proc.HasExited) { $proc.Kill() } } catch { }
  try { $proc.Dispose() } catch { }
  Remove-Item -Force -ErrorAction SilentlyContinue $outFile, $errFile
}

Write-Host ">>> ssh encerrado"
exit 0
