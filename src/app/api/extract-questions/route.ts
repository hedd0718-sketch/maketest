import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { makeAnthropicClient, VISION_MODEL, EXTRACTION_PROMPT, normalizeLatex, safeJsonParse } from '@/lib/anthropic';
import { bufferToBase64, MAX_FILE_SIZE } from '@/lib/image-utils';
import { ExtractedQuestion } from '@/lib/types';
import type { ImageBlockParam, DocumentBlockParam } from '@anthropic-ai/sdk/resources/messages';


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '파일 크기는 20MB 이하여야 합니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = bufferToBase64(buffer);
    const mimeType = file.type;

    const isPdf = mimeType === 'application/pdf';
    const isImage = mimeType.startsWith('image/');

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 });
    }

    let contentBlock: ImageBlockParam | DocumentBlockParam;

    if (isPdf) {
      contentBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      } as DocumentBlockParam;
    } else {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
      type ValidImageType = typeof validImageTypes[number];
      const imageMediaType = validImageTypes.includes(mimeType as ValidImageType)
        ? (mimeType as ValidImageType)
        : 'image/jpeg';

      contentBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMediaType,
          data: base64Data,
        },
      } as ImageBlockParam;
    }

    console.log('API KEY exists:', !!process.env.ANTHROPIC_API_KEY, 'len:', process.env.ANTHROPIC_API_KEY?.length);
    const anthropic = makeAnthropicClient();
    const response = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            contentBlock,
            { type: 'text', text: '위 시험지에서 모든 문제를 추출해주세요.' },
          ],
        },
      ],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';

    const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed: { questions: Array<{ index: number; text: string }> };
    try {
      parsed = safeJsonParse(stripped);
    } catch {
      console.error('Claude returned non-JSON:', rawText);
      return NextResponse.json({ error: '문제 추출에 실패했습니다. 다시 시도해주세요.' }, { status: 500 });
    }

    const questions: ExtractedQuestion[] = (parsed.questions ?? []).map((q) => {
      const normalized = normalizeLatex(q.text);
      console.log(`[Q${q.index}] raw:`, JSON.stringify(q.text));
      console.log(`[Q${q.index}] normalized:`, JSON.stringify(normalized));
      return {
        id: crypto.randomUUID(),
        index: q.index,
        text: normalized,
      };
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('/api/extract-questions error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
