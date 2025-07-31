// Simple REST endpoint to receive transcripts from the extension
// The extension will now connect directly to Deepgram's WebSocket API

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcript, isFinal, confidence, context, playbookSteps, currentProgress } = req.body;

    // Log received transcript for debugging
    console.log('Received transcript:', {
      transcript,
      isFinal,
      confidence,
      timestamp: new Date().toISOString()
    });

    // TODO: Process transcript for AI analysis and playbook tracking
    // This will be handled by the /api/ai/analyze endpoint

    // Return acknowledgement
    res.status(200).json({ 
      success: true, 
      message: 'Transcript received',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ 
      error: 'Failed to process transcript',
      details: error.message 
    });
  }
}
