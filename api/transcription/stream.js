import { Deepgram } from '@deepgram/sdk';
import { WebSocketServer } from 'ws';

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

// Store active connections
const connections = new Map();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Handle WebSocket upgrade
    if (req.headers.upgrade === 'websocket') {
      const wss = new WebSocketServer({ noServer: true });
      
      wss.on('connection', (ws, request) => {
        console.log('WebSocket connection established for real-time transcription');
        
        // Create Deepgram live connection
        const deepgramConnection = deepgram.transcription.live({
          encoding: 'linear16',
          sampleRate: 16000,
          language: 'en-US',
          punctuate: true,
          smart_format: true,
          model: 'nova-2', // Most advanced model
          interim_results: true, // Get partial results
          endpointing: 200, // End utterance after 200ms silence
          vad_events: true, // Voice activity detection
          diarize: true, // Speaker identification
          utterances: true, // Automatic utterance detection
          profanity_filter: false,
          filler_words: true,
          numbers: true,
          dates: true,
          times: true,
          currency: true,
          measurements: true
        });

        // Store connection
        const connectionId = Date.now().toString();
        connections.set(connectionId, { ws, deepgram: deepgramConnection });

        // Handle Deepgram events
        deepgramConnection.on('open', () => {
          console.log('Deepgram connection opened');
          ws.send(JSON.stringify({ type: 'connected', message: 'Deepgram connected' }));
        });

        deepgramConnection.on('transcriptionReceived', (data) => {
          try {
            const result = JSON.parse(data);
            
            if (result.channel?.alternatives?.[0]?.transcript) {
              const transcript = result.channel.alternatives[0].transcript;
              const isFinal = result.is_final;
              
              // Send transcript to client
              ws.send(JSON.stringify({
                type: 'transcript',
                transcript,
                isFinal,
                confidence: result.channel.alternatives[0].confidence,
                words: result.channel.alternatives[0].words || []
              }));
            }

            // Handle speaker diarization
            if (result.channel?.alternatives?.[0]?.words) {
              const words = result.channel.alternatives[0].words;
              const speakers = words.map(word => ({
                word: word.word,
                speaker: word.speaker,
                start: word.start,
                end: word.end
              }));
              
              ws.send(JSON.stringify({
                type: 'speakers',
                speakers,
                isFinal
              }));
            }
          } catch (error) {
            console.error('Error parsing Deepgram response:', error);
          }
        });

        deepgramConnection.on('vad', (data) => {
          // Voice activity detection
          ws.send(JSON.stringify({
            type: 'vad',
            isSpeaking: data.type === 'start'
          }));
        });

        deepgramConnection.on('utterance', (data) => {
          // Utterance detection
          ws.send(JSON.stringify({
            type: 'utterance',
            utterance: data
          }));
        });

        deepgramConnection.on('error', (error) => {
          console.error('Deepgram error:', error);
          ws.send(JSON.stringify({ type: 'error', error: error.message }));
        });

        deepgramConnection.on('close', () => {
          console.log('Deepgram connection closed');
          ws.send(JSON.stringify({ type: 'closed' }));
        });

        // Handle WebSocket messages from client
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message);
            
            if (data.type === 'audio') {
              // Send audio data to Deepgram
              const audioBuffer = Buffer.from(data.audioData, 'base64');
              deepgramConnection.send(audioBuffer);
            } else if (data.type === 'close') {
              deepgramConnection.finish();
              connections.delete(connectionId);
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        });

        ws.on('close', () => {
          console.log('WebSocket connection closed');
          deepgramConnection.finish();
          connections.delete(connectionId);
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          deepgramConnection.finish();
          connections.delete(connectionId);
        });
      });

      // Handle the upgrade
      const server = req.socket.server;
      server.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
        wss.handleUpgrade(req, ws, Buffer.alloc(0), (ws) => {
          wss.emit('connection', ws, req);
        });
      });
    } else {
      res.status(400).json({ error: 'WebSocket upgrade required' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
