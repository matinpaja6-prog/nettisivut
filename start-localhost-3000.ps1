$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeBin = 'C:\Users\pietu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$Pnpm = 'C:\Users\pietu\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd'
$Out = Join-Path $Root 'codex-localhost-3000.out.log'
$Err = Join-Path $Root 'codex-localhost-3000.err.log'

Set-Location -LiteralPath $Root
$env:PATH = "$NodeBin;$env:PATH"
& $Pnpm exec next start -p 3000 1> $Out 2> $Err
