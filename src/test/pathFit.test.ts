import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitPathParts, ROW_SEPARATOR, ELLIPSIS } from '../utils/pathFit';

/**
 * A fake measurer that counts CHARACTERS: the rule knows nothing about
 * typefaces, it only compares the number it is handed against the width it is
 * given, so measuring in characters pins down exactly what it decides.
 */
const chars = (text: string): number => text.length;

test('the whole path when it fits', () => {
  assert.equal(fitPathParts(['src', 'webview'], 100, chars), `src${ROW_SEPARATOR}webview`);
});

test('no segments, nothing to show', () => {
  assert.equal(fitPathParts([], 100, chars), '');
});

test('cuts from the LEFT: what survives is the tail', () => {
  const parts = ['packages', 'app', 'src', 'webview'];
  const full  = parts.join(ROW_SEPARATOR);

  // A hair less than the whole thing needs: it falls to the next candidate,
  // which is the same path without its first segment.
  const fitted = fitPathParts(parts, full.length - 1, chars);
  assert.equal(fitted, `${ELLIPSIS}${ROW_SEPARATOR}app${ROW_SEPARATOR}src${ROW_SEPARATOR}webview`);
  // The folder the file actually lives in is never lost before the generic ones
  // at the head: it is the only reason the path is there.
  assert.ok(fitted.endsWith('webview'));
});

test('every candidate is measured WITH its ellipsis', () => {
  const parts = ['aaaa', 'bb'];
  // `aaaa › bb` is 9; `… › bb` is 6. At 8 the whole thing does not fit, and the
  // one picked has to be the one that already includes the prefix — measured
  // without it the answer would be `bb` (2), painted with an ellipsis (6), and
  // no longer matching what was measured.
  assert.equal(fitPathParts(parts, 8, chars), `${ELLIPSIS}${ROW_SEPARATOR}bb`);
});

test('when not even the last segment fits, the ellipsis alone', () => {
  assert.equal(fitPathParts(['verylongindeed', 'alsolong'], 3, chars), ELLIPSIS);
});

test('it is MONOTONIC: narrowing can only raise the truncation level', () => {
  const parts = ['packages', 'app', 'src', 'webview', 'widgets'];
  const full  = parts.join(ROW_SEPARATOR);

  let previous = Infinity;
  for (let width = full.length + 5; width >= 0; width--) {
    const visible = fitPathParts(parts, width, chars).length;
    // It never shows MORE than it showed with more room: that is what keeps
    // dragging the panel edge from making the row oscillate.
    assert.ok(visible <= previous, `width ${width}: ${visible} > ${previous}`);
    previous = visible;
  }
});

test('a single segment: either whole, or the ellipsis', () => {
  assert.equal(fitPathParts(['src'], 3, chars), 'src');
  assert.equal(fitPathParts(['src'], 2, chars), ELLIPSIS);
});
