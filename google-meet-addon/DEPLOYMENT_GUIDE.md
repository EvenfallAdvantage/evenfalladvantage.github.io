# Deployment Guide - Your Specific Project
## Evenfall Advantage Meet Add-on

Your Google Cloud project is ready! Here's how to deploy.

---

## ✅ Your Project Information

- **Project ID:** `evenfall-advantage-meet-add-on`
- **Project Number:** `717441353149`
- **Project Name:** Evenfall Advantage Meet Add-on

---

## 🚀 Quick Deploy (Windows)

### Step 1: Open PowerShell in the addon folder

```powershell
cd google-meet-addon
```

### Step 2: Run the deployment script

```powershell
.\deploy.ps1
```

The script will:
1. Set your project as active
2. Enable required APIs
3. Ask for your ElevenLabs API key
4. Deploy the Cloud Function
5. Give you the function URL

---

## 📝 Manual Deployment Steps

If you prefer to do it manually:

### 1. Set Active Project

```powershell
gcloud config set project evenfall-advantage-meet-add-on
```

### 2. Enable APIs

```powershell
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable meet.googleapis.com
```

### 3. Deploy Cloud Function

```powershell
gcloud functions deploy evenfallMeetAddon `
  --runtime nodejs18 `
  --trigger-http `
  --allow-unauthenticated `
  --entry-point evenfallMeetAddon `
  --source src/backend `
  --region us-central1 `
  --set-env-vars ELEVENLABS_API_KEY=your_api_key_here,ELEVENLABS_AGENT_ID=agent_3501k7vzkxnzec2vbt1pjw2nxt47
```

Replace `your_api_key_here` with your actual ElevenLabs API key from the `.env` file.

---

## 🌐 After Deployment

### 1. Get Your Function URL

After deployment, you'll see output like:

```
httpsTrigger:
  url: https://us-central1-evenfall-advantage-meet-add-on.cloudfunctions.net/evenfallMeetAddon
```

**Copy this URL!**

### 2. Update sidebar.js

Edit `src/sidebar/sidebar.js` and replace:

```javascript
const BACKEND_URL = 'YOUR_CLOUD_FUNCTION_URL';
```

With your actual URL:

```javascript
const BACKEND_URL = 'https://us-central1-evenfall-advantage-meet-add-on.cloudfunctions.net/evenfallMeetAddon';
```

### 3. Test the Backend

```powershell
curl -X POST https://us-central1-evenfall-advantage-meet-add-on.cloudfunctions.net/evenfallMeetAddon `
  -H "Content-Type: application/json" `
  -d '{"question": "What is STOP THE BLEED?"}'
```

You should get a response from Clunt Westwood!

---

## 📤 Host the Sidebar

### Option A: GitHub Pages (Easiest)

1. Create a new GitHub repository: `evenfall-meet-addon-ui`

2. Copy sidebar files:
   ```powershell
   # Copy files to your repo folder
   Copy-Item -Path src/sidebar/* -Destination path/to/your/repo/ -Recurse
   ```

3. Commit and push:
   ```bash
   git add .
   git commit -m "Add sidebar UI"
   git push
   ```

4. Enable GitHub Pages:
   - Go to repository Settings
   - Pages section
   - Source: Deploy from branch
   - Branch: main, folder: / (root)
   - Save

5. Your URL will be: `https://YOUR_USERNAME.github.io/evenfall-meet-addon-ui/`

### Option B: Google Cloud Storage

```powershell
# Create bucket
gsutil mb -p evenfall-advantage-meet-add-on gs://evenfall-meet-addon-ui

# Upload files
gsutil cp -r src/sidebar/* gs://evenfall-meet-addon-ui/

# Make public
gsutil iam ch allUsers:objectViewer gs://evenfall-meet-addon-ui

# Set website config
gsutil web set -m index.html gs://evenfall-meet-addon-ui
```

Your URL: `https://storage.googleapis.com/evenfall-meet-addon-ui/index.html`

---

## 🧪 Testing

### Test Backend Only

```powershell
curl -X POST https://YOUR_FUNCTION_URL `
  -H "Content-Type: application/json" `
  -d '{"question": "Explain ICS structure"}'
```

### Test Full UI

1. Open your hosted sidebar URL in a browser
2. Type a question
3. Click Send
4. Should get response from Clunt!

---

## 🔍 Troubleshooting

### Check Function Logs

```powershell
gcloud functions logs read evenfallMeetAddon --region=us-central1 --limit=50
```

### Common Issues

**"Permission denied"**
- Make sure you're logged in: `gcloud auth login`
- Check project is set: `gcloud config get-value project`

**"API not enabled"**
- Run: `gcloud services enable cloudfunctions.googleapis.com`

**"Function not responding"**
- Check logs for errors
- Verify API key is correct
- Test with curl command

**"CORS error in browser"**
- Backend has CORS enabled, but check browser console
- Verify BACKEND_URL in sidebar.js is correct

---

## 💰 Cost Estimate

For your usage:
- **Cloud Functions:** FREE (2M requests/month free tier)
- **Cloud Storage:** ~$0.026/GB/month (if using)
- **Bandwidth:** Minimal for your use case

**Total: Essentially FREE!** 🎉

---

## 📊 Monitoring

### View Function Metrics

1. Go to: https://console.cloud.google.com/functions
2. Click on `evenfallMeetAddon`
3. View metrics, logs, and performance

### Check API Usage

1. Go to: https://console.cloud.google.com/apis/dashboard
2. View API calls and quotas

---

## 🎯 Next Steps

Once deployed and tested:

1. ✅ Share sidebar URL with students for testing
2. ✅ Gather feedback
3. ✅ Configure OAuth for full Meet integration
4. ✅ Consider publishing to Workspace Marketplace

---

## 🆘 Need Help?

**Check logs:**
```powershell
gcloud functions logs read evenfallMeetAddon --region=us-central1
```

**Verify deployment:**
```powershell
gcloud functions describe evenfallMeetAddon --region=us-central1
```

**Re-deploy:**
```powershell
.\deploy.ps1
```

---

**Ready to deploy? Run `.\deploy.ps1` now! 🚀**
