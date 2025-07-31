import jsforce from 'jsforce';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, data } = req.body;

  try {
    const { action, data, accessToken, instanceUrl } = req.body;

    // Check if we have an access token
    if (!accessToken) {
      res.status(401).json({ error: 'No access token provided. Please authenticate with Salesforce first.' });
      return;
    }

    // Create Salesforce connection with user's access token
    const conn = new jsforce.Connection({
      accessToken: accessToken,
      instanceUrl: instanceUrl || 'https://login.salesforce.com'
    });

    switch (action) {
      case 'getLeads':
        const leads = await conn.query('SELECT Id, Name, Company, Title, Email, Phone FROM Lead LIMIT 50');
        res.status(200).json({ success: true, leads: leads.records });
        break;

      case 'getContacts':
        const contacts = await conn.query('SELECT Id, Name, Title, Email, Phone, Account.Name FROM Contact LIMIT 50');
        res.status(200).json({ success: true, contacts: contacts.records });
        break;

      case 'getOpportunities':
        const opportunities = await conn.query('SELECT Id, Name, Amount, StageName, CloseDate, Account.Name FROM Opportunity LIMIT 50');
        res.status(200).json({ success: true, opportunities: opportunities.records });
        break;

      case 'createNote':
        const { recordId, noteContent, noteTitle } = data;
        const note = await conn.sobject('Note').create({
          ParentId: recordId,
          Title: noteTitle || 'TalkPilot Call Note',
          Body: noteContent
        });
        res.status(200).json({ success: true, noteId: note.id });
        break;

      case 'updateOpportunity':
        const { opportunityId, updates } = data;
        const result = await conn.sobject('Opportunity').update({
          Id: opportunityId,
          ...updates
        });
        res.status(200).json({ success: true, result });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Salesforce API error:', error);
    res.status(500).json({ error: 'Salesforce operation failed', details: error.message });
  }
}
