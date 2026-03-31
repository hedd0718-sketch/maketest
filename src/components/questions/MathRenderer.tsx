'use client';

import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';

interface Props {
  text: string;
  className?: string;
}

// Split text into segments: $$...$$ (block), $...$ (inline), plain text
function parseSegments(text: string): Array<{ type: 'block' | 'inline' | 'text'; content: string }> {
  const segments: Array<{ type: 'block' | 'inline' | 'text'; content: string }> = [];
  // Match $$...$$ first, then $...$
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    if (raw.startsWith('$$')) {
      segments.push({ type: 'block', content: raw.slice(2, -2) });
    } else {
      segments.push({ type: 'inline', content: raw.slice(1, -1) });
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

export default function MathRenderer({ text, className }: Props) {
  const segments = parseSegments(text);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'block') {
          return (
            <span key={i} className="block my-2">
              <BlockMath math={seg.content} errorColor="#ef4444" />
            </span>
          );
        }
        if (seg.type === 'inline') {
          return <InlineMath key={i} math={seg.content} errorColor="#ef4444" />;
        }
        // Plain text: preserve newlines
        return (
          <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
            {seg.content}
          </span>
        );
      })}
    </span>
  );
}
