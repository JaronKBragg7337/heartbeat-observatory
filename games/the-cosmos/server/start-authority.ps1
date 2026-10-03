$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$envFile = 'C:\Users\lilli\.secrets\keys.env'
foreach ($line in [System.IO.File]::ReadLines($envFile)) {
  if ($line -match '^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$') {
    $value = $Matches[2]
    if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[-1] -eq '"') -or ($value[0] -eq "'" -and $value[-1] -eq "'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($Matches[1], $value, 'Process')
  }
}
if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_SERVICE_ROLE_KEY) { throw 'Required Supabase settings are missing from keys.env.' }
$env:COSMOS_PORT = '8390'
Set-Location $repoRoot
& node (Join-Path $repoRoot 'tools\stamp-cosmos-build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Cosmos build version stamping failed.' }
& node (Join-Path $repoRoot 'games\the-cosmos\server\index.mjs')
exit $LASTEXITCODE
