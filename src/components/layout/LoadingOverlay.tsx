'use client';

import React from 'react';

interface Props {
  message: string;
}

export default function LoadingOverlay({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="w-16 h-16 bg-vibrant-yellow rounded-full flex items-center justify-center shadow-ambient animate-pulse">
          <span
            className="material-symbols-outlined text-on-yellow text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            psychology
          </span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="font-headline font-bold text-academic-blue">{message}</p>
        <p className="text-sm text-on-surface-variant font-label">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}
