// Endpoint to receive transcripts from the extension and forward to AI analysis

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

    // Only process final transcripts for AI analysis to avoid excessive API calls
    if (isFinal && transcript.trim()) {
      try {
        // Forward to AI analysis endpoint
        const analysisResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/ai/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newTranscript: transcript,
            fullTranscript: context?.fullTranscript || '',
            context,
            playbookSteps,
            currentProgress
          })
        });

        if (!analysisResponse.ok) {
          console.error('AI analysis failed:', analysisResponse.statusText);
        } else {
          const analysisResult = await analysisResponse.json();
          console.log('AI analysis result:', analysisResult);
        }
      } catch (analysisError) {
        console.error('Error calling AI analysis:', analysisError);
      }
    }

    // Return acknowledgement
    res.status(200).json({ 
      success: true, 
      message: 'Transcript received and processed',
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