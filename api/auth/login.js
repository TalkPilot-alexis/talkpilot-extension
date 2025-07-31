// Simple email/password authentication endpoint

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    // Simple validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // For now, accept any email/password combination
    // In production, you'd validate against a database
    if (email && password) {
      // Generate a simple token
      const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
      
      res.status(200).json({
        success: true,
        token,
        user: {
          email,
          name: email.split('@')[0] // Use email prefix as name
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
} 