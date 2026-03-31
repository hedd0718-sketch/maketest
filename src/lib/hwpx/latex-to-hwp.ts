/**
 * LaTeX math notation → HWP equation editor script converter
 * Port of scripts/generate_hwpx.py latex_to_hwp_eq()
 */

const HWP_SYMBOL_MAP: [string, string][] = [
  // Greek lowercase (longest first)
  ['\\epsilon', 'epsilon'], ['\\upsilon', 'upsilon'],
  ['\\lambda',  'lambda'],  ['\\theta',   'theta'],
  ['\\alpha',   'alpha'],   ['\\delta',   'delta'],
  ['\\gamma',   'gamma'],   ['\\kappa',   'kappa'],
  ['\\sigma',   'sigma'],
  ['\\beta',    'beta'],    ['\\zeta',    'zeta'],
  ['\\iota',    'iota'],    ['\\omega',   'omega'],
  ['\\eta',     'eta'],     ['\\mu',      'mu'],
  ['\\nu',      'nu'],      ['\\xi',      'xi'],
  ['\\pi',      'pi'],      ['\\rho',     'rho'],
  ['\\tau',     'tau'],     ['\\phi',     'phi'],
  ['\\chi',     'chi'],     ['\\psi',     'psi'],
  // Greek uppercase
  ['\\Epsilon', 'EPSILON'], ['\\Upsilon', 'UPSILON'],
  ['\\Lambda',  'LAMBDA'],  ['\\Theta',   'THETA'],
  ['\\Alpha',   'ALPHA'],   ['\\Delta',   'DELTA'],
  ['\\Gamma',   'GAMMA'],   ['\\Sigma',   'SIGMA'],
  ['\\Omega',   'OMEGA'],   ['\\Beta',    'BETA'],
  ['\\Pi',      'PI'],      ['\\Phi',     'PHI'],
  ['\\Psi',     'PSI'],
  // Operators
  ['\\times',   'times'],   ['\\cdot',    'cdot'],
  ['\\div',     'div'],     ['\\pm',      '+-'],
  ['\\mp',      '-+'],
  ['\\rightarrow', '->'],   ['\\leftarrow', '<-'],
  ['\\Rightarrow', '=>'],   ['\\Leftrightarrow', '<=>'],
  ['\\leq',     '<='],      ['\\geq',     '>='],
  ['\\neq',     '!='],
  ['\\le',      '<='],      ['\\ge',      '>='],
  ['\\infty',   'inf'],
  ['\\ldots',   '...'],     ['\\cdots',   '...'],
  ['\\in',      'in'],      ['\\notin',   'notin'],
  ['\\subset',  'subset'],  ['\\supset',  'supset'],
  ['\\cup',     'cup'],     ['\\cap',     'cap'],
  // Functions
  ['\\log', 'log'], ['\\ln', 'ln'],
  ['\\sin', 'sin'], ['\\cos', 'cos'], ['\\tan', 'tan'],
  ['\\lim', 'lim'], ['\\sum', 'sum'], ['\\int', 'int'],
];

const CTRL_MAP: [string, string][] = [
  ['\x07', '\\a'],
  ['\x08', '\\b'],
  ['\x0c', '\\f'],
  ['\x0b', '\\v'],
  ['\r',   '\n'],
];

function normalize(s: string): string {
  for (const [ctrl, repl] of CTRL_MAP) {
    s = s.split(ctrl).join(repl);
  }
  return s;
}

export function latexToHwpEq(s: string): string {
  if (!s) return s;
  s = normalize(s);

  for (const [latex, hwp] of HWP_SYMBOL_MAP) {
    s = s.split(latex).join(hwp);
  }

  // \frac{num}{den} → {num} over {den}
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, num, den) => {
    return `{${latexToHwpEq(num)}} over {${latexToHwpEq(den)}}`;
  });

  // \sqrt{x} → sqrt {x}
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_, inner) => {
    return `sqrt {${latexToHwpEq(inner)}}`;
  });

  // Strip remaining unknown backslash commands
  s = s.replace(/\\[a-zA-Z]+/g, '');
  s = s.replace(/\\/g, '');

  // After closing } add space so HWP returns to baseline
  s = s.replace(/\}(?=[^\s^_[\]{}\n])/g, '} ');

  return s.trim();
}

export function hasFractionOrSqrt(hwpScript: string): boolean {
  return hwpScript.includes(' over ') || hwpScript.includes('sqrt');
}

export function eqHeight(hwpScript: string): number {
  return hasFractionOrSqrt(hwpScript) ? 2580 : 1400;
}

export function eqWidth(hwpScript: string): number {
  let s = hwpScript;
  if (s.includes(' over ')) {
    const parts = s.split(' over ');
    const left = parts[0].replace(/[{}^_]/g, '').trim();
    const right = parts[parts.length - 1].replace(/[{}^_]/g, '').trim();
    const n = Math.max(left.length, right.length, 1);
    return Math.max(1100, n * 700 + 400);
  }
  const syms = [
    'epsilon','upsilon','lambda','alpha','delta','gamma','kappa',
    'sigma','theta','beta','zeta','iota','omega','eta','mu','nu',
    'xi','pi','rho','tau','phi','chi','psi',
    'EPSILON','UPSILON','LAMBDA','ALPHA','DELTA','GAMMA','SIGMA',
    'THETA','OMEGA','BETA','PI','PHI','PSI',
    'sqrt','sum','int','lim','log','ln','sin','cos','tan',
    'cdot','times','div','inf',
  ];
  for (const sym of syms) s = s.split(sym).join('X');
  s = s.replace(/[{}^_]/g, '').replace(/\s+/g, '');
  return Math.max(1100, s.length * 600);
}
