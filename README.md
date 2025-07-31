# 🎤 TalkPilot AI Sales Assistant

A comprehensive Chrome extension that transforms video calls into AI-powered sales conversations with real-time transcription, CRM integration, and intelligent suggestions.

## 🚀 Features

### Core Functionality
- **AI-Powered Sales Assistant**: Real-time suggestions based on call context and playbooks
- **Live Transcription**: Automatic speech-to-text using Deepgram
- **CRM Integration**: Seamless connection with Salesforce and HubSpot
- **Multi-Platform Support**: Works on Google Meet, Zoom, Teams, and more
- **OAuth Authentication**: Secure sign-in with Google and Microsoft

### Pre-Call Intelligence
- **URL Recognition**: Automatically detects video call platforms
- **CRM Sync**: Import leads and contacts from your CRM
- **Context Setup**: Configure meeting objectives, duration, and playbooks
- **Prospect Research**: AI-powered insights about meeting participants

### In-Call Features
- **Real-time AI Coaching**: Contextual suggestions during conversations
- **Playbook Tracking**: Monitor progress through sales methodologies (MEDDIC, SPIN, BANT)
- **Live Transcription**: See what's being said in real-time
- **Interactive Notes**: Add notes to specific talking points
- **Progress Tracking**: Visual indicators of call objectives

### Post-Call Automation
- **Email Templates**: Automated follow-up emails with call summaries
- **CRM Updates**: Push call data and notes to your CRM
- **Call Analytics**: Duration, objectives met, and AI suggestions used
- **Summary Reports**: Comprehensive call summaries and action items

## 🛠️ Technology Stack

### Frontend (Chrome Extension)
- **Manifest V3**: Latest Chrome extension standards
- **Vanilla JavaScript**: No framework dependencies
- **Chrome APIs**: Storage, Identity, TabCapture, Scripting
- **Real-time Audio**: Web Audio API for live transcription

### Backend (Vercel Functions)
- **Node.js 18+**: Serverless functions
- **OpenAI GPT-4**: AI suggestions and insights
- **Deepgram**: Real-time speech transcription
- **MongoDB**: Data persistence and user management
- **SendGrid**: Email delivery
- **Salesforce/HubSpot APIs**: CRM integration

### Authentication & Security
- **Google OAuth**: Secure user authentication
- **Microsoft OAuth**: Enterprise SSO support
- **Chrome Identity API**: Seamless sign-in flow
- **CORS Protection**: Secure API communication

## 📦 Installation

### For Development
1. **Clone and Setup:**
   ```bash
   git clone <repository-url>
   cd talkpilot-extension
   npm install
   ```

2. **Configure Environment:**
   - Copy `.env.example` to `.env`
   - Add your API keys and credentials
   - Update `apiBaseUrl` in `src/content.js`

3. **Deploy Backend:**
   ```bash
   vercel --prod
   ```

4. **Load Extension:**
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" → Select extension folder

### For Production
See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete production deployment instructions.

## 🎯 Usage

### Getting Started
1. **Sign In**: Use Google/Microsoft OAuth or continue as guest
2. **Navigate to Video Call**: Go to any supported platform (Meet, Zoom, Teams)
3. **Activate TalkPilot**: Click "Yes" when prompted
4. **Configure Call**: Set up CRM, context, and objectives
5. **Start Call**: Begin your AI-assisted sales conversation

### During Calls
- **AI Suggestions**: Click the floating mic button for real-time advice
- **Track Progress**: Monitor playbook steps and objectives
- **Take Notes**: Add context to specific talking points
- **Ask AI**: Use the chat widget for specific questions

### After Calls
- **Review Summary**: See call duration, objectives met, and transcript
- **Send Follow-up**: Use AI-generated email templates
- **Update CRM**: Push call data and notes automatically

## 📁 File Structure

```
talkpilot-extension/
├── manifest.json              # Extension configuration
├── package.json               # Backend dependencies
├── vercel.json               # Vercel deployment config
├── src/
│   ├── popup.html            # Authentication popup
│   ├── popup.js              # Popup logic
│   ├── content.js            # Main content script
│   ├── background.js         # Service worker
│   └── styles.css            # UI styles
├── api/                      # Vercel serverless functions
│   ├── ai/
│   │   └── suggestions.js    # OpenAI integration
│   ├── auth/                 # Authentication endpoints
│   ├── crm/
│   │   ├── salesforce.js     # Salesforce integration
│   │   └── hubspot.js        # HubSpot integration
│   ├── transcription/
│   │   └── stream.js         # Deepgram integration
│   └── email/
│       └── send.js           # SendGrid integration
├── DEPLOYMENT.md             # Production deployment guide
└── README.md                 # This file
```

## Installation

1. **Load the Extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `talkpilot-extension` folder

2. **Verify Installation:**
   - The extension icon should appear in your Chrome toolbar
   - Click the icon to open the popup

## Usage

1. **Popup Interface:**
   - Click the extension icon in the toolbar
   - Use the "Activate/Deactivate" button to toggle the extension
   - View the current URL and extension status

2. **Content Script Features:**
   - When activated, a colored border appears at the top of the page
   - A floating microphone button appears in the bottom-right corner
   - Click the floating button to see a notification

3. **Communication:**
   - The popup and content script communicate via Chrome's messaging API
   - Status changes in the popup affect the content script behavior

## File Structure

```
talkpilot-extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── src/
│   ├── popup.html         # Popup HTML file
│   ├── popup.jsx          # React-like popup component
│   ├── content.js         # Content script for all URLs
│   └── styles.css         # CSS styles for popup and content
├── public/
│   └── icon.png           # Extension icon
└── README.md              # This file
```

## Development

### Adding Real React Support

To use actual React instead of the React-like implementation:

1. **Install Dependencies:**
   ```bash
   npm init -y
   npm install react react-dom @babel/core @babel/preset-react
   npm install --save-dev webpack webpack-cli babel-loader
   ```

2. **Create webpack.config.js:**
   ```javascript
   module.exports = {
     entry: './src/popup.jsx',
     output: {
       filename: 'popup.bundle.js',
       path: __dirname + '/dist'
     },
     module: {
       rules: [
         {
           test: /\.jsx$/,
           exclude: /node_modules/,
           use: {
             loader: 'babel-loader',
             options: {
               presets: ['@babel/preset-react']
             }
           }
         }
       ]
     }
   };
   ```

3. **Update popup.html to use the bundled file:**
   ```html
   <script src="../dist/popup.bundle.js"></script>
   ```

### Permissions

The extension currently uses:
- `activeTab`: To access the current tab's URL
- `<all_urls>`: To inject content scripts on all websites

Add more permissions as needed for your specific use case.

## Troubleshooting

1. **Extension not loading:**
   - Check the console in `chrome://extensions/` for errors
   - Ensure all file paths in `manifest.json` are correct

2. **Content script not working:**
   - Open browser console on any webpage to see content script logs
   - Verify the content script is being injected

3. **Popup not appearing:**
   - Check that `popup.html` exists and is properly formatted
   - Verify the path in `manifest.json` is correct

## License

This project is open source and available under the MIT License. 