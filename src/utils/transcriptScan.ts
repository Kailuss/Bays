/**
 * Reading the newest conversation title out of a Claude Code transcript, as
 * PURE functions over a byte-range reader.
 *
 * A transcript is JSONL that only ever grows at its END, and it grows the whole
 * time Claude is working — with whole tool outputs, so a single turn can add
 * megabytes without one title line in them (measured: gaps of up to 13 MB in an
 * 80 MB transcript). That shape is what decides the reads:
 *
 *  - the FIRST read of a file walks back from the end in chunks and stops at the
 *    chunk holding a title, under a byte budget;
 *  - every LATER read covers only the bytes appended since, because the newest
 *    title is either in them or is the one already known.
 *
 * The read this replaces took a 256 KB tail and, when that held no title, the
 * whole file — so during a long turn it parsed the entire transcript on every
 * pass of the watcher, in the extension host's thread.
 *
 * Lines are cut on the newline BYTE, never on decoded text: 0x0A never occurs
 * inside a multi-byte UTF-8 sequence, so a chunk boundary can never split a
 * character into two halves that decode wrong.
 */

/** The newest title of each kind seen in a range; undefined = not in it. */
export type FoundTitles = { custom?: string; ai?: string };

/** Hands back the bytes of [start, end). */
export type RangeReader = (start: number, end: number) => Promise<Uint8Array>;

const NEWLINE = 0x0a;

/** The newest `custom-title` and `ai-title` in a run of JSONL lines. */
export function titlesIn(text: string): FoundTitles {
  const found: FoundTitles = {};
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0 && (found.custom === undefined || found.ai === undefined); i--) {
    const line = lines[i];
    // The substring test is the cheap filter: JSON.parse runs only on candidates.
    if (found.custom === undefined && line.includes('"custom-title"')) {
      const obj = parse(line);
      if (obj?.type === 'custom-title' && typeof obj.customTitle === 'string') { found.custom = obj.customTitle; }
    } else if (found.ai === undefined && line.includes('"ai-title"')) {
      const obj = parse(line);
      if (obj?.type === 'ai-title' && typeof obj.aiTitle === 'string') { found.ai = obj.aiTitle; }
    }
  }
  return found;
}

/**
 * The title Claude shows: a non-empty custom title overrides the ai one, and a
 * cleared (empty) custom title falls back to it.
 */
export function pickTitle(found: FoundTitles): string | undefined {
  const title = found.custom && found.custom.trim() ? found.custom : found.ai;
  return title || undefined;
}

/** `newer` wins kind by kind; what it does not say, `older` still does. */
export function mergeTitles(newer: FoundTitles, older: FoundTitles): FoundTitles {
  return { custom: newer.custom ?? older.custom, ai: newer.ai ?? older.ai };
}

/**
 * The first read of a transcript: back from the end, chunk by chunk, until a
 * chunk holds a title or the budget runs out.
 *
 * `scannedTo` is where the next read resumes — the start of the last line that
 * is not finished yet (the one Claude may be writing), so it is read whole later.
 */
export async function scanTail(
  size: number,
  read: RangeReader,
  opts: { chunk: number; maxBytes: number },
): Promise<{ found: FoundTitles; scannedTo: number }> {
  let found: FoundTitles = {};
  let scannedTo: number | undefined;
  let end = size;
  // The start of a line that began before the current chunk: its bytes carry
  // over and are completed by the next (earlier) chunk.
  let carry: Uint8Array = new Uint8Array(0);
  let budget = opts.maxBytes;

  while (end > 0 && budget > 0) {
    const start = Math.max(0, end - Math.min(opts.chunk, budget));
    const joined = concat(await read(start, end), carry);
    budget -= end - start;

    // `joined` spans [start, size) of the tail seen so far; its last newline
    // marks where the finished lines end.
    if (scannedTo === undefined) {
      const lastNl = joined.lastIndexOf(NEWLINE);
      if (lastNl >= 0) { scannedTo = start + lastNl + 1; }
    }

    // Before the first newline is a line that started in an earlier chunk.
    const firstNl = start === 0 ? -1 : joined.indexOf(NEWLINE);
    if (start !== 0 && firstNl < 0) { carry = joined; end = start; continue; }

    found = mergeTitles(found, titlesIn(decode(joined.subarray(firstNl + 1))));
    if (found.custom !== undefined || found.ai !== undefined) { break; }

    carry = joined.subarray(0, Math.max(firstNl, 0));
    end = start;
  }

  return { found, scannedTo: scannedTo ?? 0 };
}

/**
 * A later read: only the bytes appended after `from`, and only the lines in them
 * that are finished. The newest title is in here or is the one already known.
 */
export async function scanAppended(
  from: number,
  size: number,
  read: RangeReader,
): Promise<{ found: FoundTitles; scannedTo: number }> {
  if (size <= from) { return { found: {}, scannedTo: from }; }
  const bytes = await read(from, size);
  const lastNl = bytes.lastIndexOf(NEWLINE);
  if (lastNl < 0) { return { found: {}, scannedTo: from }; }
  return {
    found    : titlesIn(decode(bytes.subarray(0, lastNl + 1))),
    scannedTo: from + lastNl + 1,
  };
}

function parse(line: string): { type?: unknown; aiTitle?: unknown; customTitle?: unknown } | undefined {
  try { return JSON.parse(line); }
  catch { return undefined; }
}

const decoder = new TextDecoder('utf-8');
function decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (b.length === 0) { return a; }
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
