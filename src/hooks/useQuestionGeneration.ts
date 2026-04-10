import { useState } from 'react';
import { ExtractedQuestion, QuestionWithSimilars } from '@/lib/types';

export function useQuestionGeneration() {
  const [results, setResults] = useState<QuestionWithSimilars[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSimilars = async (questions: ExtractedQuestion[]): Promise<void> => {
    setIsGenerating(true);
    setError(null);

    // Optimistically set all questions as pending/generating
    const pending: QuestionWithSimilars[] = questions.map((q) => ({
      original: q,
      similars: [],
      status: 'generating' as const,
    }));
    setResults(pending);

    // Process each question individually to avoid serverless timeout
    // Results update progressively as each completes
    let hasAnyError = false;

    await Promise.all(
      questions.map(async (q) => {
        try {
          const res = await fetch('/api/generate-similar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: [q] }),
            signal: AbortSignal.timeout(30_000),
          });

          let data: { results?: unknown[]; error?: string };
          try {
            data = await res.json();
          } catch {
            throw new Error('서버 응답을 처리할 수 없습니다.');
          }

          if (!res.ok) {
            throw new Error(data.error ?? '유사 문제 생성에 실패했습니다.');
          }

          const resultItem = (data.results as QuestionWithSimilars[] | undefined)?.[0];

          setResults((prev) =>
            prev.map((r) =>
              r.original.index === q.index
                ? (resultItem ?? { original: q, similars: [], status: 'error' as const })
                : r
            )
          );
        } catch {
          hasAnyError = true;
          setResults((prev) =>
            prev.map((r) =>
              r.original.index === q.index
                ? { ...r, status: 'error' as const }
                : r
            )
          );
        }
      })
    );

    if (hasAnyError) {
      setError('일부 문제의 유사 문제 생성에 실패했습니다. 해당 문제를 다시 시도해주세요.');
    }

    setIsGenerating(false);
  };

  const reset = () => {
    setResults([]);
    setError(null);
  };

  return { results, setResults, isGenerating, error, generateSimilars, reset };
}
