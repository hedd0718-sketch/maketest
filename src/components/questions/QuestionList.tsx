'use client';

import React from 'react';
import { QuestionWithSimilars } from '@/lib/types';
import QuestionCard from './QuestionCard';

interface Props {
  items: QuestionWithSimilars[];
  showSimilars?: boolean;
}

export default function QuestionList({ items, showSimilars = true }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-on-surface-variant text-2xl">search_off</span>
        </div>
        <p className="font-headline font-bold text-on-surface">문제를 찾지 못했습니다</p>
        <p className="text-sm text-on-surface-variant mt-1 font-label">
          다른 파일을 업로드하거나 더 선명한 이미지를 사용해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <QuestionCard key={item.original.id} item={item} showSimilars={showSimilars} />
      ))}
    </div>
  );
}
