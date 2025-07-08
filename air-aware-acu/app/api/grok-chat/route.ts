import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Grok API key not set.' }, { status: 500 });
  }

  try {
    const grokRes = await fetch('https://api.grok.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages,
      }),
    });
    if (!grokRes.ok) {
      const error = await grokRes.text();
      return NextResponse.json({ error }, { status: 500 });
    }
    const data = await grokRes.json();
    const aiMessage = data.choices?.[0]?.message?.content || 'No response from Grok AI.';
    return NextResponse.json({ response: aiMessage });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to contact Grok AI.' }, { status: 500 });
  }
} 