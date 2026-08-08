$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeBin = 'C:\Users\pietu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$Node = Join-Path $NodeBin 'node.exe'
$Next = Join-Path $Root 'node_modules\next\dist\bin\next'
$Out = Join-Path $Root 'codex-localhost-3000.out.log'
$Err = Join-Path $Root 'codex-localhost-3000.err.log'

Set-Location -LiteralPath $Root
$env:PATH = "$NodeBin;$env:PATH"

$ExistingListener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($ExistingListener) {
  $ExistingProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($ExistingListener.OwningProcess)"
  if ($ExistingProcess.CommandLine -like "*$Root*" -and $ExistingProcess.CommandLine -match 'next.+dev') {
    Write-Host 'Localhost on jo kaynnissa: http://localhost:3000'
    exit 0
  }

  if ($ExistingProcess.CommandLine -like "*$Root*" -and $ExistingProcess.CommandLine -match 'next') {
    Write-Host 'Vaihdetaan localhost kehityspalvelimeksi...'
    Stop-Process -Id $ExistingListener.OwningProcess -Force

    $PortReleaseDeadline = (Get-Date).AddSeconds(10)
    do {
      Start-Sleep -Milliseconds 100
      $StillListening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    } while ($StillListening -and (Get-Date) -lt $PortReleaseDeadline)

    if ($StillListening) {
      throw 'Portti 3000 ei vapautunut vanhan Next-palvelimen pysaytyksen jalkeen.'
    }
  }
  else {
    throw "Portti 3000 on jo toisen prosessin kaytossa (PID $($ExistingListener.OwningProcess))."
  }
}

& $Node $Next dev -p 3000 1> $Out 2> $Err
