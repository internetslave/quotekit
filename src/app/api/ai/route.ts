import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { AiMode } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_INPUT_CHARS = 60_000; // ~15k tokens of English

const PROMPTS: Record<AiMode, { system: string; user: (text: string, title: string) => string }> = {
  overview: {
    system:
      'You are a study assistant. Produce concise, accurate chapter summaries grounded only in the provided text. Respond with strict JSON only — no markdown, no commentary.',
    user: (text, title) => `Chapter title: ${title}

Chapter text:
"""
${text}
"""

Return JSON of the exact shape:
{
  "summary": "2-3 sentence overview of the chapter's central argument.",
  "keyPoints": ["6-10 short bullet points covering main ideas, evidence, and conclusions"]
}`,
  },
  quiz: {
    system:
      'You are a study assistant generating multiple-choice quizzes that test understanding of the provided chapter. Use only information present in the text. Respond with strict JSON only — no markdown, no commentary.',
    user: (text, title) => `Chapter title: ${title}

Chapter text:
"""
${text}
"""

Generate 6 multiple-choice questions. Each question has exactly 4 options. The "answer" is the 0-based index of the correct option. Include a one-sentence explanation that cites the chapter content.

Return JSON of the exact shape:
{
  "questions": [
    {
      "q": "question text",
      "options": ["a", "b", "c", "d"],
      "answer": 0,
      "explanation": "why this is correct, grounded in the chapter"
    }
  ]
}`,
  },
  slides: {
    system:
      'You are a study assistant generating a visual slideshow that summarizes a chapter for fast review. Respond with strict JSON only — no markdown, no commentary.',
    user: (text, title) => `Chapter title: ${title}

Chapter text:
"""
${text}
"""

Create 6-9 slides walking through the chapter's key ideas in order. Each slide has:
- a punchy title (max 8 words)
- a body of 1-3 short bullet lines joined by "\\n" — no markdown
- a "visual" hint: 1-3 emoji or a 3-5 word description of an icon/metaphor

Return JSON of the exact shape:
{
  "slides": [
    { "title": "...", "body": "bullet one\\nbullet two", "visual": "🧭 compass" }
  ]
}`,
  },
};

function extractJson(text: string): unknown {
  // The model is asked for strict JSON; still be defensive about stray prose/fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server missing ANTHROPIC_API_KEY. Add it to .env.local and restart.' },
      { status: 500 }
    );
  }

  let body: { mode?: AiMode; chapterTitle?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { mode, chapterTitle, text } = body;
  if (!mode || !PROMPTS[mode]) {
    return NextResponse.json({ error: 'mode must be overview | quiz | slides' }, { status: 400 });
  }
  if (!text || !text.trim()) {
    return NextResponse.json(
      { error: 'No extractable text for this chapter (it may be a scanned/image PDF).' },
      { status: 400 }
    );
  }

  const trimmed = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
  const title = (chapterTitle || 'Untitled chapter').slice(0, 200);
  const prompt = PROMPTS[mode];

  const client = new Anthropic({ apiKey });
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user(trimmed, title) }],
    });
    const out = resp.content
      .map((b) => ('text' in b ? b.text : ''))
      .join('')
      .trim();
    const json = extractJson(out);
    return NextResponse.json({ data: json });
  } catch (e) {
    console.error('AI route error:', e);
    const msg = e instanceof Error ? e.message : 'AI request failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
