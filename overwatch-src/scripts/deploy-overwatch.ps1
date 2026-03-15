# deploy-overwatch.ps1
# Safely deploys the Overwatch app to /overwatch/ subdirectory
# WITHOUT touching the main site files at root.

$ErrorActionPreference = "Stop"

$RepoRoot  = "c:\Users\54MUR41\CascadeProjects\evenfalladvantage.github.io"
$AppRoot   = "$RepoRoot\overwatch-src"
$Target    = "$RepoRoot\overwatch"

Write-Host "`n=== OVERWATCH DEPLOY ===" -ForegroundColor Cyan

# 1. Build
Write-Host "`n[1/5] Building Next.js..." -ForegroundColor Yellow
Set-Location $AppRoot
npx next build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; exit 1 }

# 2. Fix RSC paths
Write-Host "[2/5] Fixing RSC prefetch paths..." -ForegroundColor Yellow
node scripts/fix-rsc-paths.mjs

# 3. Remove ONLY the /overwatch/ directory (never touch root files)
Write-Host "[3/5] Cleaning /overwatch/ only..." -ForegroundColor Yellow
if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
New-Item -ItemType Directory -Force $Target | Out-Null

# 4. Copy built output into /overwatch/
Write-Host "[4/5] Copying build output..." -ForegroundColor Yellow
Copy-Item -Recurse -Force "$AppRoot\out\*" $Target

# 5. Commit and push
Write-Host "[5/5] Committing and pushing..." -ForegroundColor Yellow
Set-Location $RepoRoot
git add -A
$msg = "deploy: overwatch update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $msg
git push origin main

Write-Host "`n=== DEPLOY COMPLETE ===" -ForegroundColor Green
Write-Host "Main site: https://www.evenfalladvantage.com (UNTOUCHED)"
Write-Host "Overwatch:  https://www.evenfalladvantage.com/overwatch/"
