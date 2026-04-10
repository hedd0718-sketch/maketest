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
      status: 'generating',
    }));
    setResults(pending);

    try {
      const res = await fetch('/api/generate-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
        signal: AbortSignal.timeout(180_000),
      });

      let data: { results?: unknown[]; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error('서버 응답을 처리할 수 없습니다. 다시 시도해주세요.');
      }

      if (!res.ok) {
        throw new Error(data.error ?? '유사 문제 생성에 실패했습니다.');
      }

      setResults(data.results as QuestionWithSimilars[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
      setResults((prev) => prev.map((r) => ({ ...r, status: 'error' })));
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setResults([]);
    setError(null);
  };

  return { results, setResults, isGenerating, error, generateSimilars, reset };
}
