export default async function handler(req, res) {
  res.status(200).json({ 
    message: 'Auth test endpoint working!',
    timestamp: new Date().toISOString(),
    method: req.method
  });
} 