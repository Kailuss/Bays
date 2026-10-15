import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IconLedger, applyIconDelta, groupRequests } from '../utils/iconDelta';

// An icon's markup is a theme `data:` URI counted in kilobytes, and the client
// keeps it in a dictionary keyed by short stable keys. These cases pin what
// travels: each entry ONCE per client, all of them again when the client is
// new or the keys were re-minted, and one resolution per distinct icon.

const dict = (entries: Record<string, string>) => new Map(Object.entries(entries));

test('IconLedger: a new client gets the whole dictionary, flagged as a reset', () => {
  const ledger = new IconLedger();
  assert.deepEqual(ledger.take(dict({ i0: '<a>', i1: '<b>' })), { entries: { i0: '<a>', i1: '<b>' }, reset: true });
});

test('IconLedger: later takes carry only what the client does not have', () => {
  const ledger = new IconLedger();
  ledger.take(dict({ i0: '<a>' }));
  assert.deepEqual(ledger.take(dict({ i0: '<a>', i1: '<b>' })), { entries: { i1: '<b>' }, reset: false });
  assert.deepEqual(ledger.take(dict({ i0: '<a>', i1: '<b>' })), { entries: {}, reset: false });
});

test('IconLedger: forget resends everything, as a reset', () => {
  // A reloaded webview, or a theme change that re-mints every key from i0.
  const ledger = new IconLedger();
  ledger.take(dict({ i0: '<a>' }));
  ledger.forget();
  assert.deepEqual(ledger.take(dict({ i0: '<new>' })), { entries: { i0: '<new>' }, reset: true });
});

test('applyIconDelta: a delta merges into what the client has', () => {
  assert.deepEqual(
    applyIconDelta({ i0: '<a>' }, { entries: { i1: '<b>' }, reset: false }),
    { i0: '<a>', i1: '<b>' },
  );
});

test('applyIconDelta: a reset drops what the client had', () => {
  assert.deepEqual(
    applyIconDelta({ i0: '<old>', i7: '<stale>' }, { entries: { i0: '<new>' }, reset: true }),
    { i0: '<new>' },
  );
});

test('groupRequests: ten rows of one icon are one resolution', () => {
  const pending = [
    { bayId: 'a', fileName: 'x.ts' },
    { bayId: 'b', fileName: 'y.css' },
    { bayId: 'c', fileName: 'x.ts' },
  ];
  const groups = groupRequests(pending, p => p.fileName);
  assert.deepEqual(groups.map(g => [g.first.fileName, g.members.map(m => m.bayId)]), [
    ['x.ts', ['a', 'c']],
    ['y.css', ['b']],
  ]);
});
