import { useState } from 'react';
import { ExtractedQuestion } from '@/lib/types';

export function useFileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  const extractQuestions = async (targetFile: File): Promise<ExtractedQuestion[]> => {
    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', targetFile);

      const res = await fetch('/api/extract-questions', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120_000),
      });

      let data: { questions?: unknown[]; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error('서버 응답을 처리할 수 없습니다. 다시 시도해주세요.');
      }

      if (!res.ok) {
        throw new Error(data.error ?? '문제 추출에 실패했습니다.');
      }

      return data.questions as ExtractedQuestion[];
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
      throw err;
    } finally {
      setIsExtracting(false);
    }
  };

  return { file, setFile, clearFile, isExtracting, error, extractQuestions };
}
