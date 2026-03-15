# Quick Start Guide
## Get Your Add-on Running in 1 Hour

Follow these condensed steps to get up and running quickly.

---

## ⚡ Prerequisites Check

```bash
# Check Node.js
node --version  # Should be v14+

# Install gcloud CLI if needed
# Download from: https://cloud.google.com/sdk/docs/install

# Login to gcloud
gcloud auth login
```

---

## 🚀 Step 1: Google Cloud Setup (10 min)

```bash
# Create project
gcloud projects create evenfall-meet-addon --name="Evenfall Meet Add-on"

# Set project
gcloud config set project evenfall-meet-addon

# Enable billing (required for Cloud Functions)
# Go to: https://console.cloud.google.com/billing

# Enable APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

---

## 🔧 Step 2: Deploy Backend (15 min)

```bash
cd google-meet-addon

# Install dependencies
npm install

# Deploy function with your API key
gcloud functions deploy evenfallMeetAddon \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point evenfallMeetAddon \
  --source src/backend \
  --region us-central1 \
  --set-env-vars ELEVENLABS_API_KEY=YOUR_API_KEY_HERE,ELEVENLABS_AGENT_ID=agent_3501k7vzkxnzec2vbt1pjw2nxt47
```

**Save the function URL from the output!**

---

## 🌐 Step 3: Host Sidebar (15 min)

### Quick Option: GitHub Pages

```bash
# 1. Create new GitHub repo: evenfall-meet-addon-ui
# 2. Copy sidebar files
cp -r src/sidebar/* /path/to/your/repo/
# 3. Commit and push
# 4. Enable GitHub Pages in repo settings
# 5. Your URL: https://YOUR_USERNAME.github.io/evenfall-meet-addon-ui/
```

### Update sidebar.js with your function URL:

```javascript
const BACKEND_URL = 'https://YOUR_FUNCTION_URL';
```

---

## 🔑 Step 4: OAuth Setup (10 min)

1. Go to https://console.cloud.google.com/apis/credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: Web application
4. Name: Evenfall Meet Add-on
5. Authorized origins: `https://meet.google.com`
6. Click Create
7. **Save the Client ID**

---

## ✅ Step 5: Test It! (10 min)

### Test Backend:

```bash
curl -X POST https://YOUR_FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Module 2 about?"}'
```

### Test in Browser:

1. Open your sidebar URL: `https://YOUR_HOSTING_URL/index.html`
2. Type a question
3. Click Send
4. Should get response from Clunt!

---

## 🎯 Step 6: Add to Google Meet (Development Mode)

For now, you can test by:

1. Opening your sidebar URL in a separate browser tab during a Meet
2. Using it alongside your meeting
3. This works while you complete the full Marketplace setup

---

## 📝 What You Have Now

✅ Backend Cloud Function deployed
✅ Sidebar UI hosted and working
✅ OAuth configured
✅ Can test the AI assistant

---

## 🎓 Next: Full Integration

To get it as an official Meet add-on (sidebar in Meet):

Follow the complete **SETUP_GUIDE.md** for:
- Workspace Marketplace configuration
- Add-on manifest setup
- Official integration testing
- Publishing (optional)

---

## 💡 Pro Tip

For immediate use in training:

1. Share the sidebar URL with students
2. They open it in a separate tab during Meet
3. Works perfectly while you complete full integration!

---

## 🆘 Quick Troubleshooting

**Backend not working?**
```bash
gcloud functions logs read evenfallMeetAddon --limit 50
```

**Sidebar not loading?**
- Check browser console (F12)
- Verify BACKEND_URL is correct
- Test backend URL directly with curl

**No response from AI?**
- Check ElevenLabs API key is correct
- Verify agent ID is correct
- Check Cloud Function logs

---

**You're ready to go! 🚀**

The add-on is functional. Students can use it now while you work on the full Meet integration.
