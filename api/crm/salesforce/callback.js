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

  const { code } = req.query;

  if (!code) {
    res.status(400).json({ error: 'Authorization code not provided' });
    return;
  }

  try {
    // Exchange authorization code for access token
    const conn = new jsforce.Connection();
    
    const result = await conn.authorize(code, SALESFORCE_REDIRECT_URI, {
      clientId: SALESFORCE_CLIENT_ID,
      clientSecret: SALESFORCE_CLIENT_SECRET
    });

    // Get user info
    const userInfo = await conn.identity();

    // Return success with tokens
    res.status(200).json({
      success: true,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      instanceUrl: conn.instanceUrl,
      userInfo: userInfo,
    });
  } catch (error) {
    console.error('Salesforce OAuth error:', error);
    res.status(500).json({ error: 'OAuth flow failed', details: error.message });
  }
} 