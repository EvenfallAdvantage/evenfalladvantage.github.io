# Evenfall Advantage - Google Meet Add-on

Official Google Meet Add-on for integrating Clunt Westwood AI Assistant into training sessions.

## Overview

This is a Google Workspace Add-on that integrates your ElevenLabs AI agent directly into Google Meet as an official, approved extension.

## Architecture

```
Google Meet → Add-on Sidebar → Your Backend → ElevenLabs API → AI Response
```

## Setup Steps

### Phase 1: Google Cloud Project Setup

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project: "Evenfall Advantage Meet Add-on"
   - Enable required APIs

2. **Enable APIs**
   - Google Meet Add-on API
   - Google Workspace Marketplace SDK
   - Cloud Functions API (for backend)

3. **Create OAuth 2.0 Credentials**
   - Configure OAuth consent screen
   - Add scopes for Google Meet
   - Create credentials

### Phase 2: Add-on Development

The add-on consists of:
- **Sidebar UI** (HTML/JavaScript) - Displays in Google Meet
- **Backend Service** (Node.js/Cloud Functions) - Handles AI requests
- **ElevenLabs Integration** - Connects to your agent

### Phase 3: Deployment

1. Deploy backend to Google Cloud Functions
2. Configure add-on manifest
3. Test in development mode
4. Submit to Google Workspace Marketplace (optional)

## Project Structure

```
google-meet-addon/
├── src/
│   ├── sidebar/          # Add-on UI
│   │   ├── index.html
│   │   ├── sidebar.js
│   │   └── styles.css
│   ├── backend/          # Cloud Functions
│   │   ├── index.js
│   │   └── elevenlabs.js
│   └── config/
│       └── manifest.json
├── package.json
└── README.md
```

## Development Timeline

- **Phase 1 Setup:** 30 minutes
- **Phase 2 Development:** 2-3 hours
- **Phase 3 Testing:** 1 hour
- **Marketplace Approval:** 1-2 weeks (if publishing)

## Cost

- Google Cloud Functions: Free tier covers most usage
- ~$0.40 per million requests
- Much cheaper than Recall.ai for regular use

## Next Steps

Follow the detailed setup guide below...
