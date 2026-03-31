import Anthropic from '@anthropic-ai/sdk';

/**
 * JSON.parse converts \f→0x0C, \b→0x08, \a→0x07 etc. inside strings.
 * This restores those control characters back to their LaTeX backslash sequences
 * so MathRenderer / KaTeX can render them correctly.
 */
export function normalizeLatex(s: string): string {
  return s
    .replace(/\x0c/g, '\\f')  // form feed → \f  (from \frac)
    .replace(/\x08/g, '\\b')  // backspace → \b  (from \beta)
    .replace(/\x07/g, '\\a')  // bell      → \a  (from \alpha — though \alpha handled differently)
    .replace(/\x0b/g, '\\v')  // vert tab  → \v
    .replace(/\r\n?/g, '\n'); // normalize line endings
}

export function makeAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const MODEL = 'claude-sonnet-4-5';

export const EXTRACTION_PROMPT = `You are an expert exam analyzer. Extract every question from this exam document.

Return ONLY valid JSON with this exact structure, no markdown, no explanation:
{
  "questions": [
    {
      "index": 1,
      "text": "Full question text including answer choices. Use LaTeX for math: inline $x^2$ or display $$\\\\frac{a}{b}$$. If there is a graph or figure, describe it in text within brackets, e.g. [그래프: x축과 y축이 있고, 포물선 y=f(x)가 (1,0)과 (5,0)을 지나며, 아래로 볼록한 형태]"
    }
  ]
}

CRITICAL LaTeX rules — wrap ALL of the following in $...$:
- Every single mathematical variable: $x$, $y$, $n$, $a$, $b$, $k$, $t$ etc.
- Function notation: $f(x)$, $g(x)$, $h(x)$, $f'(x)$
- Greek letters: $\\alpha$, $\\beta$, $\\pi$, $\\theta$ etc.
- Any expression with operators: $x^2 + ax + b$, $\\frac{3}{5}$, $\\sqrt{2}$
- Examples of correct output:
  - "함수 $f(x) = x^2 + ax + b$의 그래프는..." (NOT "함수 f(x) = x^2+ax+b의")
  - "$x$축과 $y$축이 만나는 점" (NOT "x축과 y축이 만나는 점")
  - "실수 $a$, $b$에 대하여 $a+b$의 값은?" (NOT "실수 a, b에 대하여")
  - "두 실근 $\\alpha$, $\\beta$를 갖는다" (NOT "두 실근 α, β를")
- Include answer choices (①②③④⑤ or A/B/C/D) as part of the question text
- Number questions sequentially starting from 1
- Do NOT include answer keys or solutions
- For graphs/figures: describe them clearly in Korean text inside brackets
- If no questions are found, return {"questions": []}`;

export const GENERATION_PROMPT = (questionsText: string) => `You are an expert exam question writer for Korean high school and university entrance exams.

For each question below, generate exactly 2 NEW similar questions. For each provide:
1. The question text — same format as original, include answer choices ①②③④⑤ if original has them. If the original describes a graph in brackets, include a similar graph description in brackets.
2. A brief explanation of what concept it tests
3. The correct answer (e.g. "②", "3", "$x = -1$ 또는 $x = 3$")
4. A clear step-by-step solution using only text and LaTeX math (no images or diagrams needed)

Rules for questions:
- Test the same concept at the same difficulty
- Use different numbers, variables, or scenarios — not trivial variations
- CRITICAL: Wrap ALL mathematical notation in $...$, including single variables
  - Correct: "함수 $f(x)$를 $f(x) = \\frac{1}{2}x^2$라 할 때, $x$축과의 교점"
  - Wrong:   "함수 f(x)를 f(x) = 1/2 x^2라 할 때, x축과의 교점"
  - Every $x$, $y$, $a$, $b$, $n$, $\\alpha$, $\\beta$ must be wrapped individually

Input questions:
${questionsText}

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "results": [
    {
      "originalIndex": 1,
      "similars": [
        {
          "text": "Complete question text with answer choices if applicable",
          "explanation": "Brief concept note",
          "answer": "② or exact value with LaTeX",
          "solution": "**풀이**\\n\\n**1단계:** ...\\n\\n**2단계:** ...\\n\\n따라서 답은 ②"
        },
        {
          "text": "...",
          "explanation": "...",
          "answer": "...",
          "solution": "..."
        }
      ]
    }
  ]
}`;
