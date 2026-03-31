import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

const PYTHON = String.raw`C:\ProgramData\anaconda3\python.exe`;
const SCRIPT = path.join(process.cwd(), 'scripts', 'generate_hwpx.py');

function runPython(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, args, { timeout: 60_000 });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Python 오류 (code ${code}):\n${stderr || stdout}`));
    });
    proc.on('error', (err) => reject(new Error(`실행 실패: ${err.message}`)));
  });
}

export async function POST(req: NextRequest) {
  const ts = Date.now();
  const tmpJson = path.join(os.tmpdir(), `exam_${ts}.json`);
  const tmpHwpx = path.join(os.tmpdir(), `exam_${ts}.hwpx`);

  try {
    const body = await req.json();
    const results = body.results;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ error: '결과 데이터가 없습니다.' }, { status: 400 });
    }

    await writeFile(tmpJson, JSON.stringify(results), 'utf-8');
    await runPython([SCRIPT, tmpJson, tmpHwpx]);
    const hwpxBuffer = await readFile(tmpHwpx);

    return new NextResponse(hwpxBuffer, {
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
  } finally {
    await unlink(tmpJson).catch(() => {});
    await unlink(tmpHwpx).catch(() => {});
  }
}
