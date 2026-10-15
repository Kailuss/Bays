import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestWins } from '../utils/latestWins';

// Activating a tab awaits several round trips to the workbench before the one
// command that changes the active tab. Two clicks in quick succession run two
// activations side by side, and whichever finishes LAST wins — not the one the
// user clicked last. These cases pin that only the newest one may act.

test('latestWins: the newest run is current', () => {
  const gate = latestWins();
  const isCurrent = gate.begin();
  assert.equal(isCurrent(), true);
});

test('latestWins: a newer run supersedes an older one', () => {
  const gate = latestWins();
  const first  = gate.begin();
  const second = gate.begin();
  assert.equal(first(), false);
  assert.equal(second(), true);
});

test('latestWins: separate gates do not interfere', () => {
  const a = latestWins();
  const b = latestWins();
  const runA = a.begin();
  b.begin();
  assert.equal(runA(), true);
});
