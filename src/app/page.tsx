'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import LoadingOverlay from '@/components/layout/LoadingOverlay';
import FileDropzone from '@/components/upload/FileDropzone';
import FilePreview from '@/components/upload/FilePreview';
import QuestionList from '@/components/questions/QuestionList';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useQuestionGeneration } from '@/hooks/useQuestionGeneration';
import { useHwpxDownload } from '@/hooks/useHwpxDownload';
import { AppMode, AppPhase, ExtractedQuestion } from '@/lib/types';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('similar');
  const [phase, setPhase] = useState<AppPhase>('idle');
  const { file, setFile, clearFile, isExtracting, extractQuestions } = useFileUpload();
  const { results, isGenerating, generateSimilars, reset, setResults } = useQuestionGeneration();
  const { download, isDownloading, error: downloadError } = useHwpxDownload();
  const [apiError, setApiError] = useState<string | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setPhase('file-selected');
    setApiError(null);
  };

  const handleRemoveFile = () => {
    clearFile();
    setPhase('idle');
    setApiError(null);
  };

  const handleRun = async () => {
    if (!file) return;
    setApiError(null);

    try {
      setPhase('extracting');
      const questions = await extractQuestions(file);

      if (questions.length === 0) {
        setPhase('done');
        reset();
        return;
      }

      if (mode === 'convert') {
        setResults(questions.map((q: ExtractedQuestion) => ({
          original: q,
          similars: [],
          status: 'done' as const,
        })));
        setPhase('done');
      } else {
        setPhase('generating');
        await generateSimilars(questions);
        setPhase('done');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setApiError(message);
      setPhase('error');
    }
  };

  const handleReset = () => {
    clearFile();
    reset();
    setApiError(null);
    setPhase('idle');
  };

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    if (phase === 'done' || phase === 'error') {
      handleReset();
    }
  };

  const showUpload = phase === 'idle' || phase === 'file-selected' || phase === 'error';
  const showResults = phase === 'done' || phase === 'generating';
  const isBusy = isExtracting || isGenerating;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Hero section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-academic-blue to-academic-blue-light p-6 md:p-8 text-white shadow-xl">
          <div className="absolute -right-10 -top-10 opacity-10">
            <span
              className="material-symbols-outlined text-[200px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              functions
            </span>
          </div>
          <div className="relative z-10 space-y-3">
            <h2 className="font-headline font-bold text-2xl">
              {mode === 'similar' ? '유사 변형 문제 생성' : '한글 문서 변환'}
            </h2>
            <p className="text-on-primary-container text-sm max-w-md font-body">
              {mode === 'similar'
                ? '기존 문제의 논리 구조를 유지하면서 수치와 상황을 변형한 유사 문제를 AI가 즉시 생성합니다.'
                : '시험지의 문제를 추출하여 한글(HWPX) 문서로 깔끔하게 변환합니다.'}
            </p>
          </div>
        </section>

        {/* Mode selection chips */}
        <section className="space-y-3">
          <h3 className="font-headline font-bold text-lg text-academic-blue flex items-center gap-2">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              category
            </span>
            작업 선택
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleModeChange('similar')}
              className={`px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                mode === 'similar'
                  ? 'bg-academic-blue text-white shadow-md'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              유사 변형 만들기
            </button>
            <button
              onClick={() => handleModeChange('convert')}
              className={`px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                mode === 'convert'
                  ? 'bg-academic-blue text-white shadow-md'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              한글로 바꾸기
            </button>
          </div>
        </section>

        {/* Upload section */}
        {showUpload && (
          <section className="space-y-4">
            <h3 className="font-headline font-bold text-lg text-academic-blue flex items-center gap-2">
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                upload_file
              </span>
              파일 업로드
            </h3>

            <FileDropzone onFile={handleFile} disabled={isBusy} />

            {file && (
              <FilePreview file={file} onRemove={handleRemoveFile} />
            )}

            {apiError && (
              <div className="rounded-2xl bg-error-container/30 px-4 py-3 text-sm text-on-error-container font-body">
                {apiError}
              </div>
            )}

            {file && (
              <div className="bg-white/40 backdrop-blur-xl rounded-3xl p-6 border border-white/40 shadow-ambient text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-vibrant-yellow rounded-full flex items-center justify-center text-on-yellow shadow-inner">
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {mode === 'similar' ? 'psychology' : 'description'}
                  </span>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-lg text-academic-blue">
                    {mode === 'similar' ? '유사 문제 생성 준비 완료' : '한글 변환 준비 완료'}
                  </h4>
                  <p className="text-on-surface-variant text-sm mt-1 font-label">
                    {mode === 'similar'
                      ? '파일을 분석하여 각 문제의 유사 변형 문제를 생성합니다.'
                      : '파일의 문제를 추출하여 한글 문서로 변환합니다.'}
                  </p>
                </div>
                <button
                  onClick={handleRun}
                  disabled={isBusy}
                  className="w-full bg-vibrant-yellow text-on-yellow font-headline font-extrabold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-ambient-lg hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    bolt
                  </span>
                  {mode === 'similar' ? '유사 문제 생성하기' : '한글로 변환하기'}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Loading states */}
        {phase === 'extracting' && (
          <LoadingOverlay message="시험지에서 문제를 추출하는 중..." />
        )}
        {phase === 'generating' && results.length === 0 && (
          <LoadingOverlay message="유사 문제를 생성하는 중..." />
        )}

        {/* Results */}
        {showResults && results.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-label text-xs text-on-surface-variant px-3 py-1 bg-surface-container-high rounded-full">
                  총 {results.length}개
                  {mode === 'similar' ? ' · 유사 문제 생성 완료' : ' · 추출 완료'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {phase === 'done' && (
                  <button
                    onClick={() => download(results)}
                    disabled={isDownloading}
                    className="bg-vibrant-yellow text-on-yellow font-headline font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-ambient hover:brightness-105 text-sm disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isDownloading ? 'hourglass_top' : 'download'}
                    </span>
                    {isDownloading ? 'HWPX 생성 중...' : 'HWPX 다운로드'}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="bg-surface-container-low text-on-surface-variant font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-surface-container-high transition-colors text-sm font-label"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  새 파일
                </button>
              </div>
            </div>
            {downloadError && (
              <p className="text-xs text-red-500 font-label">{downloadError}</p>
            )}
            <QuestionList items={results} showSimilars={mode === 'similar'} />
          </section>
        )}

        {/* Empty results */}
        {phase === 'done' && results.length === 0 && (
          <section className="space-y-4">
            <QuestionList items={[]} />
            <button
              onClick={handleReset}
              className="w-full bg-surface-container-low text-on-surface-variant font-medium py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors font-label"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              다시 시도
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
