import { useState } from 'react';
import { QuestionWithSimilars } from '@/lib/types';

export function useHwpxDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async (results: QuestionWithSimilars[]) => {
    setIsDownloading(true);
    setError(null);

    try {
      const res = await fetch('/api/download-hwpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'HWPX 생성에 실패했습니다.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '유사문제.hwpx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '다운로드에 실패했습니다.';
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return { download, isDownloading, error };
}
