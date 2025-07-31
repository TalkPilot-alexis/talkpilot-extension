import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcript, playbookSteps } = req.body;

    if (!transcript || !playbookSteps) {
      return res.status(400).json({ error: 'Transcript and playbook steps are required' });
    }

    const analysisPrompt = `
You are analyzing a sales call transcript to identify which playbook steps have been completed.

Playbook Steps:
${playbookSteps.map((step, index) => `${index + 1}. ${step.name}`).join('\n')}

Recent Transcript:
"${transcript}"

Based on the transcript, which playbook steps have been addressed or completed? 
Return ONLY a JSON array of step indices (1-based) that have been completed.

Example: [1, 3, 5]

Respond with just the JSON array:
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a sales call analyzer. Respond only with JSON arrays of completed step indices.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 50
    });

    const response = completion.choices[0].message.content.trim();
    
    // Parse the response to get completed step indices
    let completedSteps = [];
    try {
      completedSteps = JSON.parse(response);
      if (!Array.isArray(completedSteps)) {
        completedSteps = [];
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
      completedSteps = [];
    }

    res.status(200).json({
      success: true,
      completedSteps: completedSteps.map(index => index - 1) // Convert to 0-based
    });

  } catch (error) {
    console.error('Playbook analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
} 