# Google Meet Add-on Setup Guide
## Evenfall Advantage AI Assistant

This guide will walk you through setting up your official Google Meet Add-on.

---

## Prerequisites

- ✅ Google Cloud account
- ✅ Google Workspace account (for testing)
- ✅ ElevenLabs API key
- ✅ Node.js installed
- ✅ gcloud CLI installed

---

## Part 1: Google Cloud Setup (30 minutes)

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "New Project"
3. Name: `evenfall-meet-addon`
4. Click "Create"

### Step 2: Enable Required APIs

In the Google Cloud Console, enable these APIs:

```bash
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable meet.googleapis.com
```

Or manually:
1. Go to "APIs & Services" → "Enable APIs and Services"
2. Search and enable:
   - Cloud Functions API
   - Cloud Build API
   - Google Meet API

### Step 3: Set up OAuth 2.0

1. Go to "APIs & Services" → "Credentials"
2. Click "Configure Consent Screen"
   - User Type: Internal (for testing) or External (for public)
   - App name: `Evenfall Advantage AI Assistant`
   - User support email: your email
   - Developer contact: your email
3. Add scopes:
   - `https://www.googleapis.com/auth/meetings.space.readonly`
4. Save and continue

5. Create OAuth 2.0 Client ID:
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: Web application
   - Name: `Evenfall Meet Add-on`
   - Authorized JavaScript origins: `https://meet.google.com`
   - Authorized redirect URIs: `https://YOUR_DOMAIN/oauth/callback`
   - Click "Create"
   - **Save the Client ID** - you'll need it later

---

## Part 2: Deploy Backend (30 minutes)

### Step 1: Install Dependencies

```bash
cd google-meet-addon
npm install
```

### Step 2: Set Environment Variables

```bash
# Set your ElevenLabs API key
gcloud functions deploy evenfallMeetAddon \
  --set-env-vars ELEVENLABS_API_KEY=your_api_key_here,ELEVENLABS_AGENT_ID=agent_3501k7vzkxnzec2vbt1pjw2nxt47
```

### Step 3: Deploy Cloud Function

```bash
gcloud functions deploy evenfallMeetAddon \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point evenfallMeetAddon \
  --source src/backend \
  --region us-central1
```

### Step 4: Get Function URL

After deployment, you'll see output like:
```
httpsTrigger:
  url: https://us-central1-YOUR_PROJECT.cloudfunctions.net/evenfallMeetAddon
```

**Copy this URL** - you'll need it for the sidebar.

### Step 5: Test the Backend

```bash
curl -X POST https://YOUR_FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"question": "What is STOP THE BLEED?"}'
```

You should get a response from Clunt Westwood!

---

## Part 3: Host the Sidebar (30 minutes)

You need to host the sidebar HTML/JS/CSS files. Options:

### Option A: GitHub Pages (Free, Easy)

1. Create a new repository: `evenfall-meet-addon-ui`
2. Push the `src/sidebar` folder contents
3. Enable GitHub Pages in repository settings
4. Your URL will be: `https://YOUR_USERNAME.github.io/evenfall-meet-addon-ui/`

### Option B: Google Cloud Storage (Recommended)

```bash
# Create bucket
gsutil mb gs://evenfall-meet-addon-ui

# Upload files
gsutil cp -r src/sidebar/* gs://evenfall-meet-addon-ui/

# Make bucket public
gsutil iam ch allUsers:objectViewer gs://evenfall-meet-addon-ui

# Enable website configuration
gsutil web set -m index.html gs://evenfall-meet-addon-ui
```

Your URL: `https://storage.googleapis.com/evenfall-meet-addon-ui/index.html`

### Option C: Firebase Hosting (Also Good)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Select your project
# Public directory: src/sidebar
firebase deploy
```

---

## Part 4: Update Configuration (15 minutes)

### Step 1: Update sidebar.js

Edit `src/sidebar/sidebar.js`:

```javascript
const BACKEND_URL = 'https://YOUR_FUNCTION_URL';
```

Replace with your actual Cloud Function URL from Part 2, Step 4.

### Step 2: Update manifest.json

Edit `src/config/manifest.json`:

```json
{
  "sidePanel": {
    "uri": "https://YOUR_HOSTING_URL/index.html"
  },
  "oauth2": {
    "client_id": "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com"
  }
}
```

Replace:
- `YOUR_HOSTING_URL` with your sidebar hosting URL
- `YOUR_OAUTH_CLIENT_ID` with your OAuth Client ID from Part 1, Step 3

### Step 3: Re-upload Sidebar

After updating, re-upload your sidebar files to your hosting location.

---

## Part 5: Test the Add-on (30 minutes)

### Development Testing

1. Go to https://console.cloud.google.com/marketplace/product/google/meet.googleapis.com
2. Click "Manage"
3. Go to "Configuration"
4. Add your add-on configuration:
   ```json
   {
     "name": "projects/YOUR_PROJECT_ID/addOns/evenfall-ai",
     "addOnType": "MEET_SIDE_PANEL",
     "logoUrl": "https://YOUR_HOSTING_URL/icons/icon-128.png",
     "homepageUrl": "https://evenfalladvantage.com",
     "sidePanel": {
       "url": "https://YOUR_HOSTING_URL/index.html"
     }
   }
   ```

5. Save configuration

### Test in Google Meet

1. Create a new Google Meet: https://meet.google.com/new
2. Join the meeting
3. Look for the "Activities" button (puzzle piece icon)
4. Click it and find "Evenfall Advantage AI Assistant"
5. Click to open the sidebar
6. Ask Clunt a question!

---

## Part 6: Publish to Workspace Marketplace (Optional, 1-2 weeks)

If you want to make this available to others:

1. Go to Google Workspace Marketplace SDK
2. Complete the listing:
   - App name, description, screenshots
   - Privacy policy URL
   - Terms of service URL
3. Submit for review
4. Google will review (1-2 weeks)
5. Once approved, anyone can install it!

---

## Troubleshooting

### Backend not responding
- Check Cloud Function logs: `gcloud functions logs read evenfallMeetAddon`
- Verify API key is set correctly
- Test with curl command

### Sidebar not loading
- Check browser console for errors
- Verify hosting URL is correct and accessible
- Check CORS settings

### OAuth errors
- Verify OAuth client ID is correct
- Check authorized origins include `https://meet.google.com`
- Ensure consent screen is configured

### ElevenLabs API errors
- Verify API key is valid
- Check ElevenLabs dashboard for usage/limits
- Review Cloud Function logs for detailed errors

---

## Cost Estimate

- **Cloud Functions:** Free tier covers ~2 million requests/month
- **Cloud Storage:** ~$0.026/GB/month
- **ElevenLabs API:** Based on your plan
- **Total:** Essentially free for moderate usage!

---

## Next Steps

Once everything is working:

1. ✅ Test with real training sessions
2. ✅ Gather feedback from students
3. ✅ Consider publishing to Marketplace
4. ✅ Add analytics to track usage
5. ✅ Enhance UI based on feedback

---

## Support

For issues:
- Check Cloud Function logs
- Review browser console
- Test backend independently
- Verify all URLs are correct

---

**You've got this! 💪**

The add-on is complex but following these steps carefully will get you there.

Start with Part 1 and work through each section methodically.
