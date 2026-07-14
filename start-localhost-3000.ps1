$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeBin = 'C:\Users\pietu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$Node = Join-Path $NodeBin 'node.exe'
$Next = Join-Path $Root 'node_modules\next\dist\bin\next'
$BuildId = Join-Path $Root '.next\BUILD_ID'
$Out = Join-Path $Root 'codex-localhost-3000.out.log'
$Err = Join-Path $Root 'codex-localhost-3000.err.log'

Set-Location -LiteralPath $Root
$env:PATH = "$NodeBin;$env:PATH"

$ExistingListener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($ExistingListener) {
  $ExistingProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($ExistingListener.OwningProcess)"
  if ($ExistingProcess.CommandLine -like "*$Root*" -and $ExistingProcess.CommandLine -match 'next.+start') {
    Write-Host 'Localhost on jo kaynnissa: http://localhost:3000'
    exit 0
  }

  throw "Portti 3000 on jo toisen prosessin kaytossa (PID $($ExistingListener.OwningProcess))."
}

if (-not (Test-Path -LiteralPath $BuildId)) {
  Write-Host 'Tuotantobuild puuttuu. Rakennetaan sivu ensin...'
  & $Node $Next build
  if ($LASTEXITCODE -ne 0) {
    throw "Build epaonnistui (koodi $LASTEXITCODE)."
  }
}

& $Node $Next start -p 3000 1> $Out 2> $Err
