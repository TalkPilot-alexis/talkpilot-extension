import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const { context, transcript, query, playbook } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const systemPrompt = `You are TalkPilot, an AI sales assistant. Provide helpful, contextual suggestions based on the call context and transcript.

Key Guidelines:
- Be concise and actionable
- Focus on sales best practices
- Consider the selected playbook methodology
- Provide specific next steps or questions
- Maintain professional but friendly tone

Available Playbooks: ${playbook || 'General Sales'}`;

    const userPrompt = `Context: ${JSON.stringify(context || {})}
${transcript ? `\nTranscript: ${transcript}` : ''}
${playbook ? `\nPlaybook: ${playbook}` : ''}

Query: ${query}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    res.status(200).json({ 
      suggestion: completion.choices[0].message.content,
      usage: completion.usage
    });
  } catch (error) {
    console.error('AI API error:', error);
    res.status(500).json({ error: 'Failed to generate suggestion', details: error.message });
  }
}
