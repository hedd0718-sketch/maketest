'use client';

import React, { useState } from 'react';
import MathRenderer from './MathRenderer';
import { QuestionWithSimilars } from '@/lib/types';

interface Props {
  item: QuestionWithSimilars;
  showSimilars?: boolean;
}

function SimilarItem({ similar, idx }: { similar: QuestionWithSimilars['similars'][number]; idx: number }) {
  const [showSolution, setShowSolution] = useState(false);

  return (
    <div className="bg-surface-container-low rounded-2xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="bg-primary-container/10 text-primary-container text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 mt-0.5 font-label">
          유사 {idx + 1}
        </span>
        <div className="text-sm leading-relaxed text-on-surface font-body">
          <MathRenderer text={similar.text} />
        </div>
      </div>

      {similar.explanation && (
        <p className="text-xs text-on-surface-variant italic pl-1 font-label">{similar.explanation}</p>
      )}

      <div className="space-y-2">
        <button
          className="flex items-center gap-1.5 text-xs font-medium text-academic-blue hover:text-academic-blue-light transition-colors font-label"
          onClick={() => setShowSolution((v) => !v)}
        >
          <span className="material-symbols-outlined text-[16px]">
            {showSolution ? 'expand_less' : 'expand_more'}
          </span>
          {showSolution ? '해설 닫기' : '정답 · 해설 보기'}
        </button>

        {showSolution && (
          <div className="bg-surface-container-highest rounded-xl p-4 space-y-2 math-container">
            {similar.answer && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide font-label">정답</span>
                <span className="text-sm font-bold text-academic-blue font-body">
                  <MathRenderer text={similar.answer} />
                </span>
              </div>
            )}
            {similar.solution && (
              <>
                <div className="h-px bg-outline-variant/20 my-2" />
                <div className="text-sm leading-relaxed text-on-surface-variant font-body">
                  <MathRenderer text={similar.solution} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuestionCard({ item, showSimilars = true }: Props) {
  const { original, similars, status } = item;
  const isLoading = status === 'generating' || status === 'pending';

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/10">
      {/* Original question */}
      <div className="flex items-start gap-3 mb-4">
        <span className="bg-academic-blue text-white text-xs font-bold px-3 py-1 rounded-full shrink-0 mt-0.5 font-label">
          Q{original.index}
        </span>
      </div>
      <div className="bg-surface-container-highest rounded-xl p-5 math-container">
        <div className="text-sm font-medium leading-relaxed text-on-surface-variant font-body">
          <MathRenderer text={original.text} />
        </div>
      </div>

      {/* Similars */}
      {showSimilars && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-vibrant-yellow text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider font-label">
              유사 문제
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-20 bg-surface-container-low rounded-2xl animate-pulse" />
              <div className="h-20 bg-surface-container-low rounded-2xl animate-pulse" />
            </div>
          ) : status === 'error' ? (
            <p className="text-sm text-red-500 font-label">유사 문제 생성에 실패했습니다.</p>
          ) : (
            <div className="space-y-3">
              {similars.map((s, idx) => (
                <SimilarItem key={s.id} similar={s} idx={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
