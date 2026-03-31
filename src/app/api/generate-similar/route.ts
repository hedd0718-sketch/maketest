import { NextRequest, NextResponse } from 'next/server';
import { makeAnthropicClient, MODEL, GENERATION_PROMPT, normalizeLatex } from '@/lib/anthropic';
import { ExtractedQuestion, QuestionWithSimilars, SimilarQuestion } from '@/lib/types';

const BATCH_SIZE = 10;

async function generateBatch(questions: ExtractedQuestion[]): Promise<QuestionWithSimilars[]> {
  const anthropic = makeAnthropicClient();
  const questionsText = questions
    .map((q) => `[Q${q.index}]: ${q.text}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: GENERATION_PROMPT(questionsText),
      },
    ],
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
  const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Try as-is first; if fails due to invalid LaTeX backslashes, fix and retry
  const parsed: {
    results: Array<{
      originalIndex: number;
      similars: Array<{
        text: string;
        explanation: string;
        answer: string;
        solution: string;
      }>;
    }>;
  } = (() => {
    try { return JSON.parse(stripped); } catch {
      return JSON.parse(stripped.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\'));
    }
  })();

  return questions.map((q) => {
    const match = parsed.results.find((r) => r.originalIndex === q.index);
    const similars: SimilarQuestion[] = (match?.similars ?? []).slice(0, 2).map((s) => ({
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
