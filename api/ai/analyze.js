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
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { transcript, fullTranscript, context, playbookSteps, currentProgress } = req.body;

    if (!transcript) {
      res.status(400).json({ error: 'Transcript is required' });
      return;
    }

    // Analyze the conversation for playbook progress and insights
    const analysisPrompt = `
You are an AI sales assistant analyzing a sales call conversation. 

CONTEXT:
- Meeting with: ${context.meetingWith || 'Unknown'}
- Call goal: ${context.callGoal || 'Unknown'}
- Playbook: ${context.selectedPlaybook || 'General Sales'}
- Current playbook steps: ${JSON.stringify(playbookSteps)}
- Already completed steps: ${JSON.stringify(currentProgress)}

RECENT CONVERSATION:
${transcript}

FULL CONVERSATION:
${fullTranscript}

ANALYZE AND PROVIDE:
1. Which playbook steps have been completed in this recent transcript? (return as array of step IDs)
2. What battle card should be shown based on the conversation? (return as string or null)
3. What proactive insight should be provided? (return as string or null)

Respond in JSON format:
{
  "completedSteps": ["step1", "step2"],
  "battleCard": "string or null",
  "insight": "string or null"
}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales assistant that analyzes conversations and provides actionable insights.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const response = completion.choices[0].message.content;
    
    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      analysis = {
        completedSteps: [],
        battleCard: null,
        insight: null
      };
    }

    // Generate battle card if needed
    if (!analysis.battleCard && shouldShowBattleCard(transcript, context)) {
      analysis.battleCard = await generateBattleCard(transcript, context);
    }

    // Generate insight if needed
    if (!analysis.insight && shouldShowInsight(transcript, context)) {
      analysis.insight = await generateInsight(transcript, context);
    }

    res.status(200).json(analysis);

  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ 
      error: 'AI analysis failed', 
      details: error.message,
      completedSteps: [],
      battleCard: null,
      insight: null
    });
  }
}

function shouldShowBattleCard(transcript, context) {
  // Show battle card if certain keywords are mentioned
  const battleCardTriggers = [
    'budget', 'cost', 'price', 'investment', 'roi', 'return',
    'competitor', 'alternative', 'solution', 'problem', 'pain',
    'decision', 'timeline', 'deadline', 'urgency'
  ];
  
  const lowerTranscript = transcript.toLowerCase();
  return battleCardTriggers.some(trigger => lowerTranscript.includes(trigger));
}

function shouldShowInsight(transcript, context) {
  // Show insight if conversation is getting complex or needs guidance
  const insightTriggers = [
    'not sure', 'confused', 'complicated', 'difficult',
    'challenge', 'concern', 'worried', 'hesitant',
    'need to think', 'let me consider'
  ];
  
  const lowerTranscript = transcript.toLowerCase();
  return insightTriggers.some(trigger => lowerTranscript.includes(trigger));
}

async function generateBattleCard(transcript, context) {
  try {
    const battleCardPrompt = `
Based on this conversation excerpt, provide a concise battle card (1-2 sentences) that would help the salesperson:

Conversation: ${transcript}
Context: ${context.callGoal || 'Sales call'}

Battle card should be actionable and specific to what was discussed.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales coach providing battle cards.'
        },
        {
          role: 'user',
          content: battleCardPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Battle card generation error:', error);
    return null;
  }
}

async function generateInsight(transcript, context) {
  try {
    const insightPrompt = `
Based on this conversation excerpt, provide a helpful insight or suggestion (1-2 sentences) for the salesperson:

Conversation: ${transcript}
Context: ${context.callGoal || 'Sales call'}

Insight should be actionable and help move the conversation forward.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales coach providing insights.'
        },
        {
          role: 'user',
          content: insightPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Insight generation error:', error);
    return null;
  }
} 