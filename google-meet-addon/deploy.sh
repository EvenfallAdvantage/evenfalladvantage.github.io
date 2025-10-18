#!/bin/bash
# Evenfall Advantage Meet Add-on - Deployment Script

# Project Configuration
PROJECT_ID="evenfall-advantage-meet-add-on"
PROJECT_NUMBER="717441353149"
REGION="us-central1"
FUNCTION_NAME="evenfallMeetAddon"

echo "🎓 Evenfall Advantage - Google Meet Add-on Deployment"
echo "===================================================="
echo ""
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
echo "Region: $REGION"
echo ""

# Set the active project
echo "📍 Setting active project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable meet.googleapis.com

echo "✅ APIs enabled"
echo ""

# Check for API key
if [ -z "$ELEVENLABS_API_KEY" ]; then
    echo "⚠️  ELEVENLABS_API_KEY environment variable not set"
    echo "Please set it with:"
    echo "export ELEVENLABS_API_KEY=your_api_key_here"
    echo ""
    read -p "Enter your ElevenLabs API key: " ELEVENLABS_API_KEY
fi

# Deploy Cloud Function
echo "🚀 Deploying Cloud Function..."
gcloud functions deploy $FUNCTION_NAME \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point evenfallMeetAddon \
  --source src/backend \
  --region $REGION \
  --set-env-vars ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY,ELEVENLABS_AGENT_ID=agent_3501k7vzkxnzec2vbt1pjw2nxt47

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📝 Getting function URL..."
    FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --format='value(httpsTrigger.url)')
    echo ""
    echo "🎯 Your Cloud Function URL:"
    echo "$FUNCTION_URL"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update src/sidebar/sidebar.js with this URL"
    echo "2. Host the sidebar files (GitHub Pages or Cloud Storage)"
    echo "3. Test the function with:"
    echo "   curl -X POST $FUNCTION_URL -H 'Content-Type: application/json' -d '{\"question\": \"What is STOP THE BLEED?\"}'"
    echo ""
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi
