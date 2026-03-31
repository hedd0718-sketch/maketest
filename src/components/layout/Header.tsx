import React from 'react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-academic-blue to-academic-blue-light shadow-lg">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center gap-3">
        <div className="bg-white/10 p-2 rounded-xl">
          <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            functions
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-headline font-extrabold text-white/70 text-[10px] tracking-wider uppercase">
            KOO YOUNGMIN
          </span>
          <span className="font-headline font-bold text-white text-lg leading-tight">
            유사 문제 생성기
          </span>
        </div>
      </div>
    </header>
  );
}
