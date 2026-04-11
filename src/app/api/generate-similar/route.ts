import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { makeAnthropicClient, MODEL, GENERATION_PROMPT, normalizeLatex, safeJsonParse } from '@/lib/anthropic';
import { ExtractedQuestion, QuestionWithSimilars, SimilarQuestion } from '@/lib/types';

// Netlify free plan has a 10-second function timeout.
// BATCH_SIZE=1 means each Claude API call handles 1 question (~5-7s).
// All batches run in parallel via Promise.all, so total time ≈ max single call time.
const BATCH_SIZE = 1;

const MAX_RETRIES = 2;

async function callClaude(anthropic: ReturnType<typeof makeAnthropicClient>, questionsText: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: GENERATION_PROMPT(questionsText),
      },
    ],
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
  return rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function generateBatch(questions: ExtractedQuestion[]): Promise<QuestionWithSimilars[]> {
  const anthropic = makeAnthropicClient();
  const questionsText = questions
    .map((q) => `[Q${q.index}]: ${q.text}`)
    .join('\n\n');

  let parsed: {
    results: Array<{
      originalIndex: number;
      similars: Array<{
        text: string;
        explanation: string;
        answer: string;
        solution: string;
      }>;
    }>;
  } | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const stripped = await callClaude(anthropic, questionsText);

    try {
      parsed = safeJsonParse(stripped);
      break;
    } catch (e) {
      console.warn(`[generate-similar] JSON parse failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, e);
      if (attempt === MAX_RETRIES - 1) throw e;
    }
  }

  if (!parsed) throw new Error('Failed to parse after retries');

  return questions.map((q, idx) => {
    // When BATCH_SIZE=1, Claude often returns originalIndex=1 regardless of actual index,
    // or returns it as a string like "Q6". Match by position first, then by index.
    const match = parsed!.results[idx]
      ?? parsed!.results.find((r) => Number(r.originalIndex) === q.index)
      ?? parsed!.results[0];
    const similars: SimilarQuestion[] = (match?.similars ?? []).slice(0, 1).map((s) => ({
      id: crypto.randomUUID(),
      text: normalizeLatex(s.text),
      explanation: normalizeLatex(s.explanation),
      answer: normalizeLatex(s.answer ?? ''),
      solution: normalizeLatex(s.solution ?? ''),
    }));

    return {
      original: q,
      similars,
      status: 'done' as const,
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const questions: ExtractedQuestion[] = body.questions ?? [];

    if (questions.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const batches: ExtractedQuestion[][] = [];
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      batches.push(questions.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(batches.map(generateBatch));
    const results = batchResults.flat();

    return NextResponse.json({ results });
  } catch (error) {
    console.error('/api/generate-similar error:', error);
    return NextResponse.json({ error: '유사 문제 생성에 실패했습니다.' }, { status: 500 });
  }
}
