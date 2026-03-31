'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { MAX_FILE_SIZE } from '@/lib/image-utils';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function FileDropzone({ onFile, disabled }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    disabled,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
  });

  const rejectionMessage = fileRejections[0]?.errors[0]?.message;

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center cursor-pointer transition-all',
          'bg-surface-container-lowest border border-outline-variant/15',
          isDragActive
            ? 'bg-primary-fixed ring-2 ring-academic-blue/20 shadow-ambient'
            : 'hover:bg-surface-container-low hover:shadow-ambient',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        <input {...getInputProps()} />
        <div className="w-14 h-14 bg-surface-container-high rounded-2xl flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-academic-blue text-2xl">
            {isDragActive ? 'download' : 'upload_file'}
          </span>
        </div>
        {isDragActive ? (
          <p className="font-headline font-bold text-academic-blue">여기에 놓으세요</p>
        ) : (
          <>
            <p className="font-body font-medium text-on-surface">
              파일을 드래그하거나{' '}
              <span className="text-academic-blue font-semibold">클릭해서 선택</span>
            </p>
            <p className="text-xs text-on-surface-variant font-label mt-2">
              PDF, PNG, JPG, WEBP · 최대 20MB
            </p>
          </>
        )}
      </div>
      {rejectionMessage && (
        <p className="text-xs text-red-500 font-label">{rejectionMessage}</p>
      )}
    </div>
  );
}
