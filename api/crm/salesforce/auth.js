import jsforce from 'jsforce';

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CONSUMER_KEY;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CONSUMER_SECRET;
const SALESFORCE_REDIRECT_URI = 'https://talkpilot-extension-uc6a.vercel.app/api/crm/oauth-callback.html';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action } = req.body;

  try {
    switch (action) {
      case 'getAuthUrl':
        // Generate OAuth URL for Salesforce
        const authUrl = `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${SALESFORCE_CLIENT_ID}&redirect_uri=${encodeURIComponent(SALESFORCE_REDIRECT_URI)}&scope=api%20refresh_token`;
        res.status(200).json({ success: true, authUrl });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Salesforce OAuth error:', error);
    res.status(500).json({ error: 'OAuth flow failed', details: error.message });
  }
} 