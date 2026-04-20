$ErrorActionPreference = 'Stop'

$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) {
  $node = (Get-Command node).Source
}

& $node '.\node_modules\next\dist\bin\next' build
