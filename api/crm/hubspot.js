import { Client } from '@hubspot/api-client';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

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
    switch (action) {
      case 'getContacts':
        const contacts = await hubspotClient.crm.contacts.basicApi.getPage(50);
        res.status(200).json({ success: true, contacts: contacts.results });
        break;

      case 'getCompanies':
        const companies = await hubspotClient.crm.companies.basicApi.getPage(50);
        res.status(200).json({ success: true, companies: companies.results });
        break;

      case 'getDeals':
        const deals = await hubspotClient.crm.deals.basicApi.getPage(50);
        res.status(200).json({ success: true, deals: deals.results });
        break;

      case 'createNote':
        const { recordId, noteContent, noteTitle } = data;
        const note = await hubspotClient.crm.notes.basicApi.create({
          properties: {
            hs_note_body: noteContent,
            hs_timestamp: Date.now().toString(),
            hs_attachment_ids: '',
            hs_note_title: noteTitle || 'TalkPilot Call Note'
          },
          associations: [
            {
              to: {
                id: recordId
              },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 1
                }
              ]
            }
          ]
        });
        res.status(200).json({ success: true, noteId: note.id });
        break;

      case 'updateDeal':
        const { dealId, updates } = data;
        const result = await hubspotClient.crm.deals.basicApi.update(dealId, {
          properties: updates
        });
        res.status(200).json({ success: true, result });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('HubSpot API error:', error);
    res.status(500).json({ error: 'HubSpot operation failed', details: error.message });
  }
}
