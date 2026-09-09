/**
 * How many lines a diff adds and removes, from the two texts and nothing else.
 *
 * Only the COUNTS are asked for, never the edit script, and that is what keeps
 * this cheap: Myers' forward search finds the edit distance D in O((N+M)·D)
 * time and O(D) memory, and D alone fixes both numbers — a diff of D edits on
 * texts of N and M lines adds (D + M − N)/2 and removes (D − M + N)/2, because
 * every edit is one line added or one removed and the balance is the length
 * difference. Nothing is laid out and nothing is stored per cell.
 *
 * Lines are compared by CONTENT, trailing carriage returns dropped: the two
 * sides of a git diff can come with different line endings and that is not a
 * change anyone made.
 *
 * The common head and tail are stripped first, which is the shape of almost
 * every real edit and turns a 3,000-line file with one changed function into a
 * search over a few dozen lines. And the search is CAPPED: past `MAX_EDITS`
 * the answer falls back to a count that cannot tell a moved line from one
 * removed and another added, which overcounts moves and never undercounts —
 * an honest number for a rewrite, and one that costs O(N+M).
 */

export type LineCounts = { added: number; removed: number };

/** Past this many edits the exact search gives way to the bag count. */
export const MAX_EDITS = 4000;

export function countLineChanges(original: string, modified: string): LineCounts {
  const a = splitLines(original);
  const b = splitLines(modified);

  // Common head and tail: neither counts, and they are most of any real diff.
  let head = 0;
  const maxHead = Math.min(a.length, b.length);
  while (head < maxHead && a[head] === b[head]) { head++; }
  let tail = 0;
  const maxTail = maxHead - head;
  while (tail < maxTail && a[a.length - 1 - tail] === b[b.length - 1 - tail]) { tail++; }

  const n = a.length - head - tail;
  const m = b.length - head - tail;
  if (n === 0 && m === 0) { return { added: 0, removed: 0 }; }
  if (n === 0) { return { added: m, removed: 0 }; }
  if (m === 0) { return { added: 0, removed: n }; }

  const distance = editDistance(a, b, head, n, m);
  if (distance === null) { return bagCount(a, b, head, n, m); }

  return {
    added  : (distance + m - n) / 2,
    removed: (distance - m + n) / 2,
  };
}

/**
 * The text split into lines by content. A trailing newline does not open an
 * extra empty line: `"a\n"` is one line, or every file would end in a
 * phantom that a missing final newline then "removes".
 */
function splitLines(text: string): string[] {
  if (text.length === 0) { return []; }
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') { lines.pop(); }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.endsWith('\r')) { lines[i] = line.slice(0, -1); }
  }
  return lines;
}

/**
 * Myers' edit distance over the middle window, or `null` once it exceeds the
 * cap. Standard forward greedy search: V[k] is the furthest x reached on
 * diagonal k with d edits, stored in a flat array offset by the cap.
 */
function editDistance(a: string[], b: string[], offset: number, n: number, m: number): number | null {
  const max = Math.min(n + m, MAX_EDITS);
  const v = new Int32Array(2 * max + 2);
  const at = (k: number) => k + max + 1;

  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[at(k - 1)] < v[at(k + 1)])) {
        x = v[at(k + 1)];
      } else {
        x = v[at(k - 1)] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[offset + x] === b[offset + y]) { x++; y++; }
      v[at(k)] = x;
      if (x >= n && y >= m) { return d; }
    }
  }
  return null;
}

/**
 * Lines of one side not matched by content on the other, as multisets. It is
 * what a rewrite too big for the exact search is worth: a line that only moved
 * counts as one removed and one added, and a line duplicated counts once.
 */
function bagCount(a: string[], b: string[], offset: number, n: number, m: number): LineCounts {
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const line = a[offset + i];
    seen.set(line, (seen.get(line) ?? 0) + 1);
  }
  let added = 0;
  for (let j = 0; j < m; j++) {
    const line = b[offset + j];
    const left = seen.get(line) ?? 0;
    if (left > 0) { seen.set(line, left - 1); } else { added++; }
  }
  let removed = 0;
  for (const left of seen.values()) { removed += left; }
  return { added, removed };
}
