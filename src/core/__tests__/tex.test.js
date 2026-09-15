import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { theory } from '../../theory.js';

const SRC = fileURLToPath(new URL('../../theory.js', import.meta.url));
const BS = String.fromCharCode(92); // a backslash, written so nothing can eat it

// TeX escapes need a double backslash in JS source: '\sin' evaluates to 'sin',
// and '\text' to a tab followed by 'ext'. That has gone wrong three times, and
// silently, because the equation still renders -- just wrongly. So check the
// source as well as the strings it produces.
describe('TeX escaping in the theory content', () => {
  const src = readFileSync(SRC, 'utf8');

  it('contains no literal tab, which is what a lone backslash-t becomes', () => {
    expect(src.includes('\t')).toBe(false);
  });

  it('writes every TeX control word with a double backslash', () => {
    // A backslash with no backslash either side of it, in front of a letter or
    // a bracket, is a TeX escape that JS will swallow.
    const re = new RegExp(`(^|[^${BS}${BS}])${BS}${BS}([a-zA-Z(),;])`, 'g');
    const offenders = [];
    for (const line of src.split('\n')) {
      const trimmed = line.trim();
      // Skip comments: JSDoc happily shows TeX with single backslashes.
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (re.test(line)) offenders.push(trimmed.slice(0, 80));
      re.lastIndex = 0;
    }
    expect(offenders).toEqual([]);
  });

  it('leaves no control word stripped of its backslash in the built strings', () => {
    // Neither a backslash nor a word character may precede it: the first means
    // the escape survived, the second means we are inside a longer control
    // word such as \dfrac, which merely contains "frac".
    const bare = /(?<![\\\w])(sin|cos|tan|text|qquad|circ|frac|Delta|varphi|delta)\b/;
    const bad = [];
    for (const sec of theory) {
      for (const b of sec.blocks) {
        if (b.k === 'math' && bare.test(b.tex)) bad.push(`${sec.id}: ${b.tex.slice(0, 60)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps inline math delimiters intact in the prose', () => {
    // '\(' in a JS string is just '(', so the delimiter vanishes and MathJax
    // never sees the maths at all.
    const bad = [];
    for (const sec of theory) {
      for (const b of sec.blocks) {
        for (const lang of ['en', 'cs']) {
          const txt = b.text?.[lang];
          if (!txt) continue;
          const opens = (txt.match(/\\\(/g) || []).length;
          const closes = (txt.match(/\\\)/g) || []).length;
          if (opens !== closes) bad.push(`${sec.id}.${lang}: unbalanced delimiters`);
          // A bare "(t = 0)" or "(p)" is what a swallowed delimiter looks like.
          if (/\((?:p|t|Z_n|\\?[a-z]+)\)/.test(txt.replace(/\\\(|\\\)/g, ''))) {
            bad.push(`${sec.id}.${lang}: ${txt.slice(0, 60)}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
