/**
 * HWPX file generator — pure TypeScript, no Python dependency.
 * Builds a valid HWPX (ZIP) from question results data.
 */
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import { latexToHwpEq, eqHeight, eqWidth } from './latex-to-hwp';
import { QuestionWithSimilars } from '@/lib/types';

// ── Template file loader ──────────────────────────────────────────────────────

const TMPL_DIR = path.join(process.cwd(), 'src', 'lib', 'hwpx', 'templates');

function tmpl(relPath: string): Buffer {
  return fs.readFileSync(path.join(TMPL_DIR, relPath));
}

function tmplStr(relPath: string): string {
  return fs.readFileSync(path.join(TMPL_DIR, relPath), 'utf-8');
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── ID counters ───────────────────────────────────────────────────────────────

let _eqId = 1_000_000_001;
function nextEqId() { return _eqId++; }

let _pid = 2_000_000_001;
function nextPid() { return _pid++; }

function resetCounters() {
  _eqId = 1_000_000_001;
  _pid = 2_000_000_001;
}

// ── Equation run builder ──────────────────────────────────────────────────────

function makeEquationRun(latex: string, charPrIDRef = 0): string {
  const script = latexToHwpEq(latex);
  const height = eqHeight(script);
  const width  = eqWidth(script);
  const id     = nextEqId();

  return (
    `<hp:run charPrIDRef="${charPrIDRef}">` +
    `<hp:equation id="${id}" zOrder="0" numberingType="EQUATION" ` +
    `textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" ` +
    `version="Equation Version 60" baseLine="65" textColor="#000000" ` +
    `baseUnit="1100" lineMode="CHAR" font="HYhwpEQ">` +
    `<hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${height}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" ` +
    `holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" ` +
    `vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="56" right="56" top="0" bottom="0"/>` +
    `<hp:shapeComment>수식입니다.</hp:shapeComment>` +
    `<hp:script>${escXml(script)}</hp:script>` +
    `</hp:equation><hp:t/>` +
    `</hp:run>`
  );
}

// ── Paragraph builder ─────────────────────────────────────────────────────────

function makePara(text: string, paraPrIDRef = 0, charPrIDRef = 0): string {
  // Normalize control chars & strip markdown bold
  text = text
    .replace(/\x0c/g, '\\f').replace(/\x08/g, '\\b')
    .replace(/\x07/g, '\\a').replace(/\x0b/g, '\\v')
    .replace(/\r\n?/g, '\n')
    .replace(/\*\*/g, '');

  const pid = nextPid();
  const runs: string[] = [];
  let last = 0;

  const mathRe = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;
  let m: RegExpExecArray | null;

  while ((m = mathRe.exec(text)) !== null) {
    const before = text.slice(last, m.index);
    if (before) {
      runs.push(
        `<hp:run charPrIDRef="${charPrIDRef}"><hp:t>${escXml(before)}</hp:t></hp:run>`
      );
    }
    const latex = m[1] ?? m[2];
    runs.push(makeEquationRun(latex, charPrIDRef));
    last = m.index + m[0].length;
  }

  const after = text.slice(last);
  if (after) {
    runs.push(
      `<hp:run charPrIDRef="${charPrIDRef}"><hp:t>${escXml(after)}</hp:t></hp:run>`
    );
  }

  if (runs.length === 0) {
    runs.push(`<hp:run charPrIDRef="${charPrIDRef}"><hp:t/></hp:run>`);
  }

  return (
    `<hp:p id="${pid}" paraPrIDRef="${paraPrIDRef}" styleIDRef="0" ` +
    `pageBreak="0" columnBreak="0" merged="0">` +
    runs.join('') +
    `</hp:p>`
  );
}

function makeEmpty(): string {
  const pid = nextPid();
  return (
    `<hp:p id="${pid}" paraPrIDRef="0" styleIDRef="0" ` +
    `pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="0"><hp:t/></hp:run>` +
    `</hp:p>`
  );
}

// ── Korean sentence splitter ──────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  // Protect math by replacing $...$ with placeholders
  const placeholders: Record<string, string> = {};
  let counter = 0;
  const protected_ = text.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (m) => {
    const key = `\x00M${counter++}\x00`;
    placeholders[key] = m;
    return key;
  });

  const parts = protected_.split(/(?<=다)\. |(?<=요)\. |(?<=죠)\. |(?<=까)\. /);
  return parts
    .map((part, i) => {
      for (const [key, val] of Object.entries(placeholders)) {
        part = part.split(key).join(val);
      }
      part = part.trim();
      if (!part) return '';
      if (i < parts.length - 1) part = part + '.';
      return part;
    })
    .filter(Boolean);
}

// ── Section XML builder ───────────────────────────────────────────────────────

function buildSection(results: QuestionWithSimilars[]): string {
  const sectionTemplate = tmplStr('Contents/section0.xml');

  // Insert after the first </hp:p>
  const insertAt = sectionTemplate.indexOf('</hp:p>') + '</hp:p>'.length;

  const paras: string[] = [];

  for (const item of results) {
    const orig = item.original;
    const similars = item.similars;

    // Question label
    paras.push(makePara(`문제 ${orig.index}`, 0, 7));

    // Question text (split at sentence boundaries)
    for (const line of orig.text.split('\n')) {
      for (const sentence of splitSentences(line.trim())) {
        if (sentence) paras.push(makePara(sentence, 0, 0));
      }
    }

    paras.push(makeEmpty());

    // Similars
    for (let i = 0; i < similars.length; i++) {
      const sim = similars[i];
      paras.push(makePara(`  [유사 ${i + 1}]`, 0, 8));

      for (const line of sim.text.split('\n')) {
        for (const sentence of splitSentences(line.trim())) {
          if (sentence) paras.push(makePara(sentence, 25, 0));
        }
      }

      if (sim.answer) {
        paras.push(makePara(`  정답: ${sim.answer}`, 25, 9));
      }

      if (sim.solution) {
        paras.push(makePara('  [풀이]', 25, 9));
        for (const line of sim.solution.split('\n')) {
          const stripped = line.trim().replace(/\*\*/g, '');
          for (const sentence of splitSentences(stripped)) {
            if (sentence) paras.push(makePara(`  ${sentence}`, 26, 0));
          }
        }
      }

      paras.push(makeEmpty());
    }

    paras.push(makeEmpty());
  }

  return (
    sectionTemplate.slice(0, insertAt) +
    '\n' + paras.join('\n') + '\n' +
    '</hs:sec>'
  );
}

// ── content.hpf updater ───────────────────────────────────────────────────────

function buildContentHpf(title: string): string {
  const now = new Date();
  const iso = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const korean = `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일`;

  return tmplStr('Contents/content.hpf')
    .replace('<opf:title/>', `<opf:title>${escXml(title)}</opf:title>`)
    .replace('name="CreatedDate" content="text"', `name="CreatedDate" content="${iso}"`)
    .replace('name="ModifiedDate" content="text"', `name="ModifiedDate" content="${iso}"`)
    .replace('name="date" content="text"', `name="date" content="${korean}"`);
}

// ── Main HWPX builder ─────────────────────────────────────────────────────────

export async function generateHwpx(results: QuestionWithSimilars[]): Promise<Buffer> {
  resetCounters();

  const sectionXml = buildSection(results);
  const contentHpf = buildContentHpf('유사문제 생성 결과');

  const zip = new JSZip();

  // mimetype MUST be first, uncompressed
  zip.file('mimetype', tmpl('mimetype'), { compression: 'STORE' });

  // Static template files
  zip.file('version.xml',              tmplStr('version.xml'));
  zip.file('settings.xml',             tmplStr('settings.xml'));
  zip.file('META-INF/container.xml',   tmplStr('META-INF/container.xml'));
  zip.file('META-INF/container.rdf',   tmplStr('META-INF/container.rdf'));
  zip.file('META-INF/manifest.xml',    tmplStr('META-INF/manifest.xml'));
  zip.file('Preview/PrvText.txt',      tmplStr('Preview/PrvText.txt'));
  zip.file('Preview/PrvImage.png',     tmpl('Preview/PrvImage.png'));

  // Dynamic content
  zip.file('Contents/header.xml',      tmplStr('Contents/header.xml'));
  zip.file('Contents/content.hpf',     contentHpf);
  zip.file('Contents/section0.xml',    sectionXml);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}
