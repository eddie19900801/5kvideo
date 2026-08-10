$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $projectRoot 'server')
try {
  npm run type-check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm run build
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
