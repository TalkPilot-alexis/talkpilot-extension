# 🚀 TalkPilot Production Deployment Guide

## 📋 Prerequisites

- Node.js 18+ installed
- Vercel CLI installed (`npm i -g vercel`)
- Chrome Web Store Developer Account
- All API keys and credentials ready

## 🔧 Backend Deployment (Vercel)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables in Vercel
```bash
vercel env add OPENAI_API_KEY
vercel env add DEEPGRAM_API_KEY
vercel env add MONGODB_URI
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add SALESFORCE_CONSUMER_KEY
vercel env add SALESFORCE_CONSUMER_SECRET
vercel env add HUBSPOT_ACCESS_TOKEN
vercel env add SENDGRID_API_KEY
vercel env add SENTRY_DSN
```

### 3. Deploy to Vercel
```bash
vercel --prod
```

### 4. Update Extension Configuration
After deployment, update the `apiBaseUrl` in `src/content.js`:
```javascript
this.apiBaseUrl = 'https://your-vercel-app.vercel.app/api';
```

## 🛠️ Chrome Extension Deployment

### 1. Load Extension for Testing
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `talkpilot-extension` folder
4. The extension should now appear in your extensions list

### 2. Test the Extension
1. Navigate to `meet.google.com` or any video call platform
2. The URL recognition modal should appear
3. Test the full flow: sign-in → CRM → context → in-call features

### 3. Package for Chrome Web Store
1. Create a ZIP file of the extension:
   ```bash
   zip -r talkpilot-extension.zip . -x "node_modules/*" "api/*" "*.md" ".env*"
   ```

2. Upload to Chrome Web Store:
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Create new item
   - Upload the ZIP file
   - Fill in store listing details
   - Submit for review

## 🔐 Environment Variables Setup

### Required Variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `DEEPGRAM_API_KEY`: Your Deepgram API key
- `MONGODB_URI`: MongoDB connection string
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `SALESFORCE_CONSUMER_KEY`: Salesforce consumer key
- `SALESFORCE_CONSUMER_SECRET`: Salesforce consumer secret
- `HUBSPOT_ACCESS_TOKEN`: HubSpot access token
- `SENDGRID_API_KEY`: SendGrid API key
- `SENTRY_DSN`: Sentry DSN for error tracking

## 🧪 Testing Checklist

### Pre-Deployment Testing:
- [ ] Extension loads without errors
- [ ] URL recognition works on video call platforms
- [ ] OAuth sign-in works (Google/Microsoft)
- [ ] Guest mode works
- [ ] CRM integration works (Salesforce/HubSpot)
- [ ] AI suggestions work
- [ ] Audio capture and transcription work
- [ ] Email sending works
- [ ] Post-call summary works

### Production Testing:
- [ ] All API endpoints respond correctly
- [ ] Error handling works properly
- [ ] Rate limiting is in place
- [ ] Security headers are set
- [ ] CORS is configured correctly

## 🚨 Troubleshooting

### Common Issues:

1. **Extension not loading:**
   - Check manifest.json syntax
   - Verify all files exist
   - Check Chrome console for errors

2. **API calls failing:**
   - Verify environment variables are set
   - Check Vercel function logs
   - Verify CORS configuration

3. **Audio capture not working:**
   - Check microphone permissions
   - Verify tabCapture permission in manifest
   - Check browser console for errors

4. **OAuth not working:**
   - Verify Google OAuth credentials
   - Check redirect URIs
   - Verify client ID in manifest

## 📞 Support

For issues or questions:
1. Check the browser console for errors
2. Check Vercel function logs
3. Review this deployment guide
4. Contact the development team

## 🔄 Updates

To update the extension:
1. Make code changes
2. Update version in `manifest.json`
3. Re-deploy backend if needed
4. Re-package and upload to Chrome Web Store
5. Update existing users will receive the update automatically
