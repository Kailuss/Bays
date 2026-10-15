import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTitle, scanAppended, scanTail, titlesIn } from '../utils/transcriptScan';

// A Claude Code transcript only ever grows at its end, so the newest title is
// either in the bytes added since the last pass or the one already known. These
// cases pin the two reads that rest on that: the first one, backwards from the
// end, and every later one, over the appended bytes only.

const ai     = (t: string) => JSON.stringify({ type: 'ai-title', aiTitle: t });
const custom = (t: string) => JSON.stringify({ type: 'custom-title', customTitle: t });
const noise  = (n: number) => JSON.stringify({ type: 'attachment', text: 'x'.repeat(n) });

/** A file as an async range reader that also counts the bytes it hands out. */
function fileOf(lines: string[], trailingNewline = true) {
  const buf = Buffer.from(lines.join('\n') + (trailingNewline ? '\n' : ''), 'utf8');
  const stats = { read: 0 };
  const read = async (start: number, end: number) => {
    stats.read += end - start;
    return buf.subarray(start, end);
  };
  return { buf, read, size: buf.length, stats };
}

test('titlesIn: the newest of each kind wins', () => {
  const found = titlesIn([ai('one'), noise(5), ai('two'), custom('mine')].join('\n'));
  assert.deepEqual(found, { ai: 'two', custom: 'mine' });
});

test('titlesIn: a partial or foreign line is ignored', () => {
  const found = titlesIn(`{"type":"ai-title","aiTi\n${ai('ok')}\n{"type":"ai-title`);
  assert.deepEqual(found, { ai: 'ok' });
});

test('pickTitle: a non-empty custom title overrides the ai one; an empty one does not', () => {
  assert.equal(pickTitle({ ai: 'auto', custom: 'mine' }), 'mine');
  assert.equal(pickTitle({ ai: 'auto', custom: '  ' }), 'auto');
  assert.equal(pickTitle({}), undefined);
});

test('scanTail: finds a title far behind the end without reading the whole file', async () => {
  // The title sits before ~600 KB of tool output: more than one tail window.
  const lines = [noise(2_000_000), ai('the title'), ...Array.from({ length: 6 }, () => noise(100_000))];
  const f = fileOf(lines);
  const { found, scannedTo } = await scanTail(f.size, f.read, { chunk: 256 * 1024, maxBytes: 64 * 1024 * 1024 });
  assert.equal(pickTitle(found), 'the title');
  assert.equal(scannedTo, f.size);
  // It stopped at the chunk holding the title, not at the 2 MB line before it.
  assert.ok(f.stats.read < 1_000_000, `read ${f.stats.read} bytes`);
});

test('scanTail: a title split across two chunks is still read whole', async () => {
  const lines = [noise(10), ai('split across the boundary'), noise(10)];
  const f = fileOf(lines);
  // A chunk size that cuts straight through the title line.
  const titleStart = f.buf.indexOf('{"type":"ai-title"');
  const chunk = f.size - titleStart - 7;
  const { found } = await scanTail(f.size, f.read, { chunk, maxBytes: 1 << 20 });
  assert.equal(pickTitle(found), 'split across the boundary');
});

test('scanTail: a line still being written is left for the next pass', async () => {
  const f = fileOf([ai('done'), '{"type":"ai-title","aiTitle":"half'], false);
  const { found, scannedTo } = await scanTail(f.size, f.read, { chunk: 1024, maxBytes: 1 << 20 });
  assert.equal(pickTitle(found), 'done');
  // The scan resumes at the start of the unfinished line, not past it.
  assert.equal(scannedTo, f.buf.indexOf('{"type":"ai-title","aiTitle":"half'));
});

test('scanTail: stops at its byte budget when there is no title at all', async () => {
  const f = fileOf(Array.from({ length: 20 }, () => noise(1000)));
  const { found } = await scanTail(f.size, f.read, { chunk: 1024, maxBytes: 4096 });
  assert.equal(pickTitle(found), undefined);
  assert.ok(f.stats.read <= 4096 + 1024);
});

test('scanAppended: reads only the bytes added since the last pass', async () => {
  const before = fileOf([ai('old'), noise(50_000)]);
  const after  = fileOf([ai('old'), noise(50_000), noise(10), ai('new')]);
  const { found, scannedTo } = await scanAppended(before.size, after.size, after.read);
  assert.equal(found.ai, 'new');
  assert.equal(scannedTo, after.size);
  assert.equal(after.stats.read, after.size - before.size);
});

test('scanAppended: nothing new keeps the scan where it was', async () => {
  const f = fileOf([ai('old')]);
  const { found, scannedTo } = await scanAppended(f.size, f.size, f.read);
  assert.deepEqual(found, {});
  assert.equal(scannedTo, f.size);
  assert.equal(f.stats.read, 0);
});

test('scanAppended: an unfinished last line is not consumed', async () => {
  const base = `${ai('old')}\n`;
  const f = fileOf([ai('old'), '{"type":"ai-title","aiTitle":"half'], false);
  const { found, scannedTo } = await scanAppended(Buffer.byteLength(base), f.size, f.read);
  assert.deepEqual(found, {});
  assert.equal(scannedTo, Buffer.byteLength(base));
});

// Whether a turn is still running is read from the same lines: a prompt or a
// tool result means Claude is working, an assistant message that stopped on
// `end_turn` means it is waiting for the user.

const prompt     = JSON.stringify({ type: 'user', message: { role: 'user', content: 'do it' } });
const toolResult = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result' }] } });
const toolUse    = JSON.stringify({ type: 'assistant', message: { stop_reason: 'tool_use' } });
const endTurn    = JSON.stringify({ type: 'assistant', message: { stop_reason: 'end_turn' } });
const meta       = JSON.stringify({ type: 'bridge-session' });

test('titlesIn: a prompt starts a turn', () => {
  assert.equal(titlesIn([endTurn, prompt].join('\n')).working, true);
});

test('titlesIn: a tool call or its result keeps the turn running', () => {
  assert.equal(titlesIn([prompt, toolUse].join('\n')).working, true);
  assert.equal(titlesIn([toolUse, toolResult].join('\n')).working, true);
});

test('titlesIn: end_turn ends it, whatever bookkeeping lines follow', () => {
  assert.equal(titlesIn([prompt, toolUse, toolResult, endTurn, meta, ai('t')].join('\n')).working, false);
});

test('titlesIn: no turn line says nothing about the turn', () => {
  assert.equal(titlesIn([meta, ai('t')].join('\n')).working, undefined);
});

test('scanAppended: the turn state of the new bytes overrides the old one', async () => {
  const before = fileOf([prompt, toolUse]);
  const after  = fileOf([prompt, toolUse, toolResult, endTurn]);
  const { found } = await scanAppended(before.size, after.size, after.read);
  assert.equal(found.working, false);
});
