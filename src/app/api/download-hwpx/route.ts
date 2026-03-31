import { NextRequest, NextResponse } from 'next/server';
import { generateHwpx } from '@/lib/hwpx/generator';
import { QuestionWithSimilars } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const results: QuestionWithSimilars[] = body.results;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ error: '결과 데이터가 없습니다.' }, { status: 400 });
    }

    const hwpxBuffer = await generateHwpx(results);

    return new NextResponse(hwpxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': "attachment; filename*=UTF-8''%EC%9C%A0%EC%82%AC%EB%AC%B8%EC%A0%9C.hwpx",
        'Content-Length': hwpxBuffer.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/download-hwpx error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
