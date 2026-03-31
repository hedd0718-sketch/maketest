#!/usr/bin/env python
"""
Generate HWPX file from exam question results JSON.
Usage: python generate_hwpx.py <input_json> <output_hwpx>
"""
import sys
import json
import os
import re
import tempfile
import subprocess

SKILL_DIR = r"C:\Users\ymink\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\a786b134-8b83-4bb4-beea-8b6a59911a42\65a2682f-c5e6-46ad-a3ba-c367a5d26f4a\skills\hwpx"
BUILD_SCRIPT = os.path.join(SKILL_DIR, "scripts", "build_hwpx.py")

# ── Python escape corruption fix ────────────────────────────────────────────
# json.load converts \f→0x0C, \a→0x07, \b→0x08 inside strings.
_CTRL_MAP = {
    '\x07': r'\a',
    '\x08': r'\b',
    '\x0c': r'\f',
    '\x0b': r'\v',
    '\r':   '\n',
}

def _normalize(s: str) -> str:
    for ctrl, repl in _CTRL_MAP.items():
        s = s.replace(ctrl, repl)
    return s


# ── LaTeX → HWP 수식 언어 변환 ───────────────────────────────────────────────
# HWP equation syntax: {a} over {b}, sqrt {x}, alpha, beta, x^{2}, x_{n}

_HWP_SYMBOL_MAP = [
    # Greek lowercase (longest first to avoid partial matches)
    (r'\epsilon', 'epsilon'), (r'\upsilon', 'upsilon'),
    (r'\lambda',  'lambda'),  (r'\theta',   'theta'),
    (r'\alpha',   'alpha'),   (r'\delta',   'delta'),
    (r'\gamma',   'gamma'),   (r'\kappa',   'kappa'),
    (r'\sigma',   'sigma'),
    (r'\beta',    'beta'),    (r'\zeta',    'zeta'),
    (r'\iota',    'iota'),    (r'\omega',   'omega'),
    (r'\eta',     'eta'),     (r'\mu',      'mu'),
    (r'\nu',      'nu'),      (r'\xi',      'xi'),
    (r'\pi',      'pi'),      (r'\rho',     'rho'),
    (r'\tau',     'tau'),     (r'\phi',     'phi'),
    (r'\chi',     'chi'),     (r'\psi',     'psi'),
    # Greek uppercase
    (r'\Epsilon', 'EPSILON'), (r'\Upsilon', 'UPSILON'),
    (r'\Lambda',  'LAMBDA'),  (r'\Theta',   'THETA'),
    (r'\Alpha',   'ALPHA'),   (r'\Delta',   'DELTA'),
    (r'\Gamma',   'GAMMA'),   (r'\Sigma',   'SIGMA'),
    (r'\Omega',   'OMEGA'),   (r'\Beta',    'BETA'),
    (r'\Pi',      'PI'),      (r'\Phi',     'PHI'),
    (r'\Psi',     'PSI'),
    # Operators
    (r'\times',   'times'),   (r'\cdot',    'cdot'),
    (r'\div',     'div'),     (r'\pm',      '+-'),
    (r'\mp',      '-+'),
    (r'\rightarrow', '->'),   (r'\leftarrow', '<-'),
    (r'\Rightarrow', '=>'),   (r'\Leftrightarrow', '<=>'),
    (r'\leq',     '<='),      (r'\geq',     '>='),
    (r'\neq',     '!='),
    (r'\le',      '<='),      (r'\ge',      '>='),
    (r'\infty',   'inf'),
    (r'\ldots',   '...'),     (r'\cdots',   '...'),
    (r'\in',      'in'),      (r'\notin',   'notin'),
    (r'\subset',  'subset'),  (r'\supset',  'supset'),
    (r'\cup',     'cup'),     (r'\cap',     'cap'),
    # Functions (just strip backslash)
    (r'\log', 'log'), (r'\ln', 'ln'),
    (r'\sin', 'sin'), (r'\cos', 'cos'), (r'\tan', 'tan'),
    (r'\lim', 'lim'), (r'\sum', 'sum'), (r'\int', 'int'),
]


def latex_to_hwp_eq(s: str) -> str:
    """Convert LaTeX math (no $ delimiters) to HWP equation markup."""
    if not s:
        return s
    s = _normalize(s)

    # Apply symbol replacements (already sorted longest-first above)
    for latex, hwp in _HWP_SYMBOL_MAP:
        s = s.replace(latex, hwp)

    # \frac{num}{den} → {num} over {den}
    def _frac(m):
        return f'{{{latex_to_hwp_eq(m.group(1))}}} over {{{latex_to_hwp_eq(m.group(2))}}}'
    s = re.sub(r'\\frac\{([^{}]*)\}\{([^{}]*)\}', _frac, s)

    # \sqrt{x} → sqrt {x}
    def _sqrt(m):
        return f'sqrt {{{latex_to_hwp_eq(m.group(1))}}}'
    s = re.sub(r'\\sqrt\{([^{}]*)\}', _sqrt, s)

    # ^{...} → ^{...}  (HWP keeps ^ notation)
    # _{...} → _{...}  (HWP keeps _ notation)
    # — no change needed for these

    # Strip remaining unknown backslash commands
    s = re.sub(r'\\[a-zA-Z]+', '', s)
    s = s.replace('\\', '')

    # HWP 수식: } 닫는 괄호 직후에 일반 문자가 오면 지수/아래첨자 영역에서 빠져나오지 못함.
    # } 뒤에 공백을 넣어 HWP가 baseline으로 복귀하도록 강제.
    s = re.sub(r'\}(?=[^\s^_\[\]{}\n])', '} ', s)

    return s.strip()


def _has_fraction_or_sqrt(hwp_script: str) -> bool:
    return ' over ' in hwp_script or 'sqrt' in hwp_script


def _eq_height(hwp_script: str) -> int:
    return 2580 if _has_fraction_or_sqrt(hwp_script) else 1400


def _eq_width(hwp_script: str) -> int:
    """Estimate equation width in HWPUNIT based on content."""
    s = hwp_script
    # Fractions: width = max width of numerator / denominator
    if ' over ' in s:
        # strip outer braces, split on ' over '
        parts = s.split(' over ')
        left  = re.sub(r'[{}\^_]', '', parts[0]).strip()
        right = re.sub(r'[{}\^_]', '', parts[-1]).strip()
        n = max(len(left), len(right), 1)
        return max(1100, n * 700 + 400)
    # Replace multi-char symbols with single placeholder 'X'
    for sym in [
        'epsilon', 'upsilon', 'lambda', 'alpha', 'delta', 'gamma', 'kappa',
        'sigma', 'theta', 'beta', 'zeta', 'iota', 'omega', 'eta', 'mu', 'nu',
        'xi', 'pi', 'rho', 'tau', 'phi', 'chi', 'psi',
        'EPSILON', 'UPSILON', 'LAMBDA', 'ALPHA', 'DELTA', 'GAMMA', 'SIGMA',
        'THETA', 'OMEGA', 'BETA', 'PI', 'PHI', 'PSI',
        'sqrt', 'sum', 'int', 'lim', 'log', 'ln', 'sin', 'cos', 'tan',
        'cdot', 'times', 'div', 'inf',
    ]:
        s = s.replace(sym, 'X')
    s = re.sub(r'[{}\^_]', '', s)
    s = re.sub(r'\s+', '', s)
    n = len(s)
    return max(1100, n * 600)


_eq_id = 1_000_000_001

def _next_eq_id() -> int:
    global _eq_id
    v = _eq_id
    _eq_id += 1
    return v


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
    )


def _make_equation_run_from_script(script: str, height: int, charPrIDRef: int = 0) -> str:
    """Return a <hp:run> containing an <hp:equation> given a pre-converted HWP script."""
    eq_id = _next_eq_id()
    width = _eq_width(script)
    return (
        f'<hp:run charPrIDRef="{charPrIDRef}">'
        f'<hp:equation id="{eq_id}" zOrder="0" numberingType="EQUATION" '
        f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
        f'version="Equation Version 60" baseLine="65" textColor="#000000" '
        f'baseUnit="1100" lineMode="CHAR" font="HYhwpEQ">'
        f'<hp:sz width="{width}" widthRelTo="ABSOLUTE" height="{height}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
        f'vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="56" right="56" top="0" bottom="0"/>'
        f'<hp:shapeComment>수식입니다.</hp:shapeComment>'
        f'<hp:script>{escape_xml(script)}</hp:script>'
        f'</hp:equation>'
        f'<hp:t/>'
        f'</hp:run>'
    )


def _make_equation_run(latex: str, charPrIDRef: int = 0) -> str:
    """Return a <hp:run> containing an <hp:equation> for the given LaTeX."""
    script = latex_to_hwp_eq(latex)
    height = _eq_height(script)
    eq_id  = _next_eq_id()
    return (
        f'<hp:run charPrIDRef="{charPrIDRef}">'
        f'<hp:equation id="{eq_id}" zOrder="0" numberingType="EQUATION" '
        f'textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" '
        f'version="Equation Version 60" baseLine="65" textColor="#000000" '
        f'baseUnit="1100" lineMode="CHAR" font="HYhwpEQ">'
        f'<hp:sz width="1100" widthRelTo="ABSOLUTE" height="{height}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
        f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" '
        f'vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="56" right="56" top="0" bottom="0"/>'
        f'<hp:shapeComment>수식입니다.</hp:shapeComment>'
        f'<hp:script>{escape_xml(script)}</hp:script>'
        f'</hp:equation>'
        f'<hp:t/>'
        f'</hp:run>'
    )


def make_para(pid: int, text: str, paraPrIDRef: int = 0, charPrIDRef: int = 0) -> str:
    """Build <hp:p> paragraph, converting $...$ to HWP equation objects."""
    text = _normalize(text)
    text = text.replace('**', '')  # strip markdown bold

    runs = []
    last = 0

    for m in re.finditer(r'\$\$([^$]+?)\$\$|\$([^$\n]+?)\$', text):
        before = text[last:m.start()]
        if before:
            runs.append(
                f'<hp:run charPrIDRef="{charPrIDRef}">'
                f'<hp:t>{escape_xml(before)}</hp:t>'
                f'</hp:run>'
            )
        latex = m.group(1) or m.group(2)
        hwp_script = latex_to_hwp_eq(latex)
        height = _eq_height(hwp_script)
        runs.append(_make_equation_run_from_script(hwp_script, height, charPrIDRef))
        last = m.end()

    after = text[last:]
    if after:
        runs.append(
            f'<hp:run charPrIDRef="{charPrIDRef}">'
            f'<hp:t>{escape_xml(after)}</hp:t>'
            f'</hp:run>'
        )

    if not runs:
        runs.append(f'<hp:run charPrIDRef="{charPrIDRef}"><hp:t/></hp:run>')

    return (
        f'<hp:p id="{pid}" paraPrIDRef="{paraPrIDRef}" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        + ''.join(runs)
        + '</hp:p>'
    )


def make_empty(pid: int) -> str:
    return (
        f'<hp:p id="{pid}" paraPrIDRef="0" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="0"><hp:t/></hp:run>'
        f'</hp:p>'
    )


def _split_sentences(text: str) -> list[str]:
    """Split Korean text at sentence boundaries, avoiding splits inside $...$."""
    # Protect math by replacing $...$ with placeholders
    placeholders = {}
    counter = [0]

    def protect(m):
        key = f'\x00M{counter[0]}\x00'
        placeholders[key] = m.group(0)
        counter[0] += 1
        return key

    protected = re.sub(r'\$\$[\s\S]+?\$\$|\$[^$\n]+?\$', protect, text)

    # Split at Korean sentence boundaries (". " after common sentence-final chars)
    parts = re.split(r'(?<=다)\. |(?<=요)\. |(?<=죠)\. |(?<=까)\. ', protected)

    result = []
    for i, part in enumerate(parts):
        # Restore placeholders
        for key, val in placeholders.items():
            part = part.replace(key, val)
        part = part.strip()
        if not part:
            continue
        # Add ". " back (was removed by split) except for the last part
        if i < len(parts) - 1:
            part = part + '.'
        result.append(part)

    return result if result else [text]


def build_section(results: list) -> str:
    section0_template = os.path.join(SKILL_DIR, "templates", "base", "Contents", "section0.xml")
    with open(section0_template, encoding="utf-8") as f:
        template = f.read()

    end_idx = template.index("</hp:p>") + len("</hp:p>")

    pid = 2_000_000_001
    paragraphs = []

    def next_pid():
        nonlocal pid
        v = pid
        pid += 1
        return v

    for item in results:
        orig = item.get("original", {})
        similars = item.get("similars", [])

        q_label = f"문제 {orig.get('index', '?')}"
        paragraphs.append(make_para(next_pid(), q_label, paraPrIDRef=0, charPrIDRef=7))

        for line in orig.get("text", "").split("\n"):
            for sentence in _split_sentences(line.strip()):
                if sentence:
                    paragraphs.append(make_para(next_pid(), sentence, paraPrIDRef=0, charPrIDRef=0))

        paragraphs.append(make_empty(next_pid()))

        for idx, sim in enumerate(similars, 1):
            sim_label = f"  [유사 {idx}]"
            paragraphs.append(make_para(next_pid(), sim_label, paraPrIDRef=0, charPrIDRef=8))

            for line in sim.get("text", "").split("\n"):
                for sentence in _split_sentences(line.strip()):
                    if sentence:
                        paragraphs.append(make_para(next_pid(), sentence, paraPrIDRef=25, charPrIDRef=0))

            answer = sim.get("answer", "").strip()
            if answer:
                paragraphs.append(make_para(next_pid(), f"  정답: {answer}", paraPrIDRef=25, charPrIDRef=9))

            solution = sim.get("solution", "").strip()
            if solution:
                paragraphs.append(make_para(next_pid(), "  [풀이]", paraPrIDRef=25, charPrIDRef=9))
                for line in solution.split("\n"):
                    stripped = line.strip().replace("**", "")
                    for sentence in _split_sentences(stripped):
                        if sentence:
                            paragraphs.append(make_para(next_pid(), f"  {sentence}", paraPrIDRef=26, charPrIDRef=0))

            paragraphs.append(make_empty(next_pid()))

        paragraphs.append(make_empty(next_pid()))

    close_tag = "</hs:sec>"
    section_xml = (
        template[:end_idx]
        + "\n"
        + "\n".join(paragraphs) + "\n"
        + close_tag
    )
    return section_xml


def main():
    if len(sys.argv) != 3:
        print("Usage: generate_hwpx.py <input.json> <output.hwpx>", file=sys.stderr)
        sys.exit(1)

    input_json = sys.argv[1]
    output_hwpx = sys.argv[2]

    with open(input_json, encoding="utf-8") as f:
        results = json.load(f)

    section_xml = build_section(results)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".xml", encoding="utf-8", delete=False) as tmp:
        tmp.write(section_xml)
        tmp_path = tmp.name

    try:
        cmd = [
            sys.executable, BUILD_SCRIPT,
            "--template", "report",
            "--section", tmp_path,
            "--title", "유사문제 생성 결과",
            "--output", output_hwpx,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            sys.exit(result.returncode)
        print(f"HWPX generated: {output_hwpx}")
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    main()
