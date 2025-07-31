import { Client } from '@hubspot/api-client';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID || 'your-hubspot-client-id';
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET || 'your-hubspot-client-secret';

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
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: 'https://talkpilot-extension-uc6a.vercel.app/api/crm/oauth-callback.html',
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange authorization code for access token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user info
    const hubspotClient = new Client({ accessToken: access_token });
    const userInfo = await hubspotClient.oauth.accessTokensApi.get();

    // Return success with tokens
    res.status(200).json({
      success: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      userInfo: userInfo,
    });
  } catch (error) {
    console.error('HubSpot OAuth error:', error);
    res.status(500).json({ error: 'OAuth flow failed', details: error.message });
  }
} 