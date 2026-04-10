import Anthropic from '@anthropic-ai/sdk';

/**
 * Safely parse a JSON string that may contain LaTeX backslash commands.
 *
 * Problem: JSON.parse converts \f→0x0C (form feed), \b→0x08 (backspace), etc.
 * When Claude writes \frac, \beta, \bar etc. with single backslashes in JSON,
 * the \f and \b are consumed as control characters and the LaTeX is destroyed.
 *
 * Solution: Before JSON.parse, protect LaTeX commands whose prefix collides
 * with a JSON escape sequence (\f, \b, \n, \r, \t).
 * We detect these by checking if the backslash+char is followed by more
 * alphabetic characters (e.g. \frac, \beta, \neq, \rightarrow, \text, \tan).
 */
export function safeJsonParse<T>(raw: string): T {
  // Step 1: Protect LaTeX commands that start with JSON escape prefixes.
  // \f + letter(s) → \\f + letter(s)   (e.g. \frac, \flat, \forall)
  // \b + letter(s) → \\b + letter(s)   (e.g. \beta, \bar, \binom, \boxed)
  // \n + letter(s) → \\n + letter(s)   (e.g. \neq, \neg, \not, \nu)
  // \r + letter(s) → \\r + letter(s)   (e.g. \right, \rangle, \rho)
  // \t + letter(s) → \\t + letter(s)   (e.g. \text, \theta, \times, \tan)
  const protected_ = raw.replace(
    /(?<!\\)\\([fbnrt])([a-zA-Z])/g,
    '\\\\$1$2'
  );

  // Step 2: Escape any remaining lone backslashes not part of valid JSON escapes
  const escaped = protected_.replace(
    /(?<!\\)\\(?!["\\/bfnrtu\\])/g,
    '\\\\'
  );

  return JSON.parse(escaped);
}

/**
 * Post-process LaTeX strings: restore any remaining control characters
 * and normalize line endings.
 */
export function normalizeLatex(s: string): string {
  return s
    .replace(/\x0c/g, '\\f')  // form feed → \f  (from \frac)
    .replace(/\x08/g, '\\b')  // backspace → \b  (from \beta)
    .replace(/\x07/g, '\\a')  // bell      → \a  (from \alpha)
    .replace(/\x0b/g, '\\v')  // vert tab  → \v
    .replace(/\r\n?/g, '\n')  // normalize line endings

    // Fix over-grouped exponents: x^{2(x-1)(x-2)} → x^2(x-1)(x-2)
    // Pattern: ^{digit(s) followed by paren-factor(s)} → the digit is the exponent, rest is multiplication
    .replace(/\^\{(\d+)\s*((?:\([^(){}]*\))+)\}/g, '^$1$2')

    // Fix \{expr\}^N → {\{expr\}}^N  so the superscript applies to the whole braced group
    // e.g.  \{P(x)\}^2  →  {\{P(x)\}}^2   renders as {P(x)}²  correctly in KaTeX
    .replace(/\\\{([^{}\\]+)\\\}\^(\{[^}]+\}|\w+)/g, '{\\{$1\\}}^$2');
}

export function makeAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Use haiku for generate-similar (fast, fits Netlify 10s limit)
// Use sonnet for extract-questions (better vision accuracy)
export const MODEL = 'claude-haiku-4-5';
export const VISION_MODEL = 'claude-sonnet-4-5';

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

CRITICAL superscript/subscript rules — DO NOT over-group:
- Use curly braces {} ONLY for multi-character exponents/subscripts that are truly grouped.
- $x^2 - 1$ is correct (exponent is just 2, then minus 1). NEVER write $x^{2-1}$.
- $x^2 + x + 1$ is correct. NEVER write $x^{2+x+1}$.
- $x^{2n}$ is correct ONLY when 2n is the full exponent (meaning "x to the 2n").
- $(g(x))^2 - x^2$ is correct. NEVER write $(g(x))^{2-x^2}$.
- $a_{n+1}$ is correct when the entire subscript is "n+1".
- WRONG examples to AVOID:
  - $x^{2-1}$ when you mean "$x$ squared minus 1" → correct: $x^2 - 1$
  - $x^{2+x+1}$ when you mean "$x$ squared plus $x$ plus 1" → correct: $x^2 + x + 1$
  - $(g(x))^{2-x^2}$ when you mean "$(g(x))$ squared minus $x$ squared" → correct: $(g(x))^2 - x^2$
  - $x^{2(x-1)}(x-2)$ when you mean "$x$ squared times $(x-1)$ times $(x-2)$" → correct: $x^2(x-1)(x-2)$
  - $x^{2(x-2)(x-1)}$ when you mean "$x^2 \cdot (x-2)(x-1)$" → correct: $x^2(x-2)(x-1)$
  - KEY RULE: if after the digit exponent comes a parenthesized factor like $(x-1)$, it is MULTIPLICATION not part of the exponent. Write $x^2(x-1)$ NOT $x^{2(x-1)}$.

- Examples of correct output:
  - "함수 $f(x) = x^2 + ax + b$의 그래프는..." (NOT "함수 f(x) = x^2+ax+b의")
  - "$x$축과 $y$축이 만나는 점" (NOT "x축과 y축이 만나는 점")
  - "실수 $a$, $b$에 대하여 $a+b$의 값은?" (NOT "실수 a, b에 대하여")
  - "두 실근 $\\alpha$, $\\beta$를 갖는다" (NOT "두 실근 α, β를")
  - "$f(x)$를 $x^2 - 1$로 나누면" (NOT "$f(x)$를 $x^{2-1}$로 나누면")
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
- CRITICAL superscript/subscript grouping — DO NOT over-group:
  - $x^2 - 1$ is correct. NEVER write $x^{2-1}$ (that means "x to the power of 2-1").
  - $x^2 + x + 1$ is correct. NEVER write $x^{2+x+1}$.
  - $(g(x))^2 - x^2$ is correct. NEVER write $(g(x))^{2-x^2}$.
  - $x^2(x-1)(x-2)$ is correct. NEVER write $x^{2(x-1)}(x-2)$ (parenthesized factors after exponent are multiplication, not part of exponent).
  - Use {} ONLY when the ENTIRE exponent is a grouped expression like $x^{2n}$, $a^{n+1}$.

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
