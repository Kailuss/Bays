// @lovervoid/kit scripts/lib/punctuation.js: synced by `lovervoid sync`. Edit it in the kit, not here.
'use strict';

// No dashes and no typographic quotes in what the marketplace renders.
//
// They read as machine text, which is exactly what a marketplace page cannot
// look like. The rule was written in every guide long before anything ran it,
// and that is the whole argument for running it: twelve em dashes had built up
// in one CHANGELOG, one loose dash in a Japanese string and two spaced ones in
// a Chinese one, and none was loud enough to notice while writing the next.
//
// What it does NOT decide is the replacement. Each dash is swapped for what it
// was really doing (a colon where what follows explains what came before,
// parentheses around an aside, a comma, a full stop where there were two
// ideas), and that is a judgement per sentence: a blind sweep to hyphens leaves
// the prose worse than it found it. So it fails instead of fixing.
//
// The exceptions are real ones:
//   - the `…` of a UI label stays (in VS Code it means "this opens a dialog"),
//     and so do the arrows that name a key;
//   - Chinese and Japanese keep `“”` and an unspaced `——`, their native
//     typography. A LOOSE dash in the English manner (a single one, or a spaced
//     `——`) is still caught there: that is a calque, not the language.

const fs = require('fs');
const path = require('path');

/** What ships and is read: the marketplace page, its changelog tab, every string. */
const SHIPPED = ['README.md', 'CHANGELOG.md'];

const CJK = /\.(?:ja|zh-cn|zh-tw)\.json$/;
const TYPOGRAPHIC = /[–‘’“”]/g;

/** The offending characters on one line, in the order they appear. */
function offenders(line, cjk) {
  const out = [];
  for (const m of line.matchAll(TYPOGRAPHIC)) {
    if (cjk && (m[0] === '“' || m[0] === '”')) { continue; }
    out.push(m[0]);
  }
  for (const m of line.matchAll(/—+/g)) {
    const spaced = line[m.index - 1] === ' ' || line[m.index + m[0].length] === ' ';
    if (cjk && m[0] === '——' && !spaced) { continue; }
    out.push(m[0]);
  }
  return out;
}

/**
 * The files the rule covers in `root`, found by NAME and never listed: a locale
 * added tomorrow is checked tomorrow without anybody remembering to say so.
 */
function shippedFiles(root) {
  const l10n = path.join(root, 'l10n');
  return [
    ...SHIPPED,
    ...fs.readdirSync(root).filter(name => /^package\.nls(\.[\w-]+)?\.json$/.test(name)),
    ...(fs.existsSync(l10n) ? fs.readdirSync(l10n).filter(n => n.endsWith('.json')).map(n => `l10n/${n}`) : []),
  ].filter(rel => fs.existsSync(path.join(root, rel)));
}

/** Every offence in `root` as `file:line  char`. */
function scan(root) {
  const bad = [];
  for (const rel of shippedFiles(root)) {
    const cjk = CJK.test(rel);
    fs.readFileSync(path.join(root, rel), 'utf8').split('\n').forEach((line, i) => {
      for (const char of offenders(line, cjk)) { bad.push(`  ${rel}:${i + 1}  ${char}`); }
    });
  }
  return bad;
}

/**
 * The check as a build step: exits non-zero on any offence, else returns how
 * many shipped files it read so the caller can say so in its summary line.
 */
function checkPunctuation(root, tag = '[check-docs]') {
  const bad = scan(root);
  if (bad.length > 0) {
    console.error(`${tag} ${bad.length} dash(es) or typographic quote(s) in what ships:\n`);
    console.error(bad.join('\n'));
    console.error('\nReplace each with what it was doing: a colon, parentheses, a comma, a full stop.');
    process.exit(1);
  }
  return shippedFiles(root).length;
}

module.exports = { offenders, shippedFiles, scan, checkPunctuation };
