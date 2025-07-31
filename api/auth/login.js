// Temporary simplified version for testing
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // For testing purposes, accept any login
  console.log('Login attempt:', { email, password: '***' });
  
  // Generate a simple token (for demo)
  const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
  
  return res.status(200).json({
    success: true,
    token,
    user: { email },
    message: 'Login successful (test mode)'
  });
} 