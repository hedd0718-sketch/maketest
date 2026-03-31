'use client';

import React from 'react';

interface Props {
  file: File;
  onRemove: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilePreview({ file, onRemove }: Props) {
  const isPdf = file.type === 'application/pdf';

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 px-4 py-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50' : 'bg-blue-50'}`}>
        <span className={`material-symbols-outlined text-lg ${isPdf ? 'text-red-500' : 'text-blue-500'}`}>
          {isPdf ? 'picture_as_pdf' : 'image'}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-on-surface truncate">{file.name}</p>
        <p className="text-xs text-on-surface-variant font-label">{formatBytes(file.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="text-on-surface-variant/40 hover:text-red-500 transition-colors p-1"
      >
        <span className="material-symbols-outlined text-lg">cancel</span>
      </button>
    </div>
  );
}
