# Resolve k6 após instalação via winget (PATH pode não atualizar na sessão atual)
function Resolve-K6 {
  $cmd = Get-Command k6 -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "${env:ProgramFiles}\k6\k6.exe",
    "${env:ProgramFiles(x86)}\k6\k6.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\k6.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  throw "k6 nao encontrado. Instale com: winget install k6 --source winget. Depois abra um terminal novo ou reinicie o Cursor."
}
