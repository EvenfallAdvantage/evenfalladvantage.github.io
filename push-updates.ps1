# Auto Push Updates to GitHub
# Run this script to commit and push all changes

Write-Host "🚀 Evenfall Advantage - Auto Push Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "❌ Error: Not a git repository!" -ForegroundColor Red
    Write-Host "Make sure you're in the EvenfallAdvantageWebMobile directory" -ForegroundColor Yellow
    pause
    exit
}

# Show current status
Write-Host "📋 Checking for changes..." -ForegroundColor Yellow
git status --short

# Check if there are changes
$changes = git status --porcelain
if ([string]::IsNullOrWhiteSpace($changes)) {
    Write-Host ""
    Write-Host "✅ No changes to commit!" -ForegroundColor Green
    pause
    exit
}

Write-Host ""
Write-Host "📝 Files to be committed:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Ask for commit message
$defaultMessage = "Update course management system - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Write-Host "Enter commit message (or press Enter for default):" -ForegroundColor Cyan
Write-Host "Default: $defaultMessage" -ForegroundColor Gray
$commitMessage = Read-Host "Message"

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = $defaultMessage
}

Write-Host ""
Write-Host "🔄 Staging all changes..." -ForegroundColor Yellow
git add .

Write-Host "💾 Committing changes..." -ForegroundColor Yellow
git commit -m "$commitMessage"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    pause
    exit
}

Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Yellow
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "🌐 Your changes are now live!" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host "You may need to pull changes first: git pull" -ForegroundColor Yellow
}

Write-Host ""
pause
