export default function handler(req, res) {
  res.status(200).json({ 
    message: 'TalkPilot API is working!',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
}
