// Temporary simplified version for testing
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // For testing purposes, accept any registration
  console.log('Registration attempt:', { email, password: '***' });
  
  return res.status(201).json({ 
    success: true, 
    user: { email },
    message: 'Registration successful (test mode)'
  });
}