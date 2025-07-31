import { Deepgram } from '@deepgram/sdk';

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, mimetype = 'audio/wav' } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    const response = await deepgram.transcription.preRecorded(
      { buffer: audioBuffer, mimetype },
      {
        smart_format: true,
        model: 'nova-2',
        language: 'en-US',
        punctuate: true,
        diarize: true,
        utterances: true,
        paragraphs: true,
        summarize: 'v2'
      }
    );

    const transcript = response.results.channels[0].alternatives[0];
    
    res.status(200).json({ 
      transcript: transcript.transcript,
      confidence: transcript.confidence,
      words: transcript.words,
      paragraphs: transcript.paragraphs,
      summary: response.results.summary,
      usage: response.metadata
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio', details: error.message });
  }
}
