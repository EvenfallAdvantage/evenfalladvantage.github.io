# Evenfall Advantage Meet Add-on - Deployment Script

$PROJECT_ID = "evenfall-advantage-meet-add-on"
$PROJECT_NUMBER = "717441353149"
$REGION = "us-central1"
$FUNCTION_NAME = "evenfallMeetAddon"

Write-Host "Evenfall Advantage - Google Meet Add-on Deployment" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project ID: $PROJECT_ID"
Write-Host "Project Number: $PROJECT_NUMBER"
Write-Host "Region: $REGION"
Write-Host ""

# Set the active project
Write-Host "Setting active project..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Enable required APIs
Write-Host "Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable meet.googleapis.com

Write-Host "APIs enabled" -ForegroundColor Green
Write-Host ""

# Check for API key
if (-not $env:ELEVENLABS_API_KEY) {
    Write-Host "ELEVENLABS_API_KEY environment variable not set" -ForegroundColor Yellow
    Write-Host "Please enter your ElevenLabs API key:"
    $ELEVENLABS_API_KEY = Read-Host
} else {
    $ELEVENLABS_API_KEY = $env:ELEVENLABS_API_KEY
}

# Deploy Cloud Function
Write-Host "Deploying Cloud Function..." -ForegroundColor Yellow
gcloud functions deploy $FUNCTION_NAME `
  --runtime nodejs18 `
  --trigger-http `
  --allow-unauthenticated `
  --entry-point evenfallMeetAddon `
  --source src/backend `
  --region $REGION `
  --set-env-vars ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY,ELEVENLABS_AGENT_ID=agent_3501k7vzkxnzec2vbt1pjw2nxt47

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Getting function URL..." -ForegroundColor Yellow
    $FUNCTION_URL = gcloud functions describe $FUNCTION_NAME --region=$REGION --format='value(httpsTrigger.url)'
    Write-Host ""
    Write-Host "Your Cloud Function URL:" -ForegroundColor Cyan
    Write-Host $FUNCTION_URL -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update src/sidebar/sidebar.js with this URL"
    Write-Host "2. Host the sidebar files"
    Write-Host "3. Test the function"
    Write-Host ""
} else {
    Write-Host "Deployment failed" -ForegroundColor Red
    exit 1
}
