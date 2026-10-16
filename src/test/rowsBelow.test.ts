import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsBelow } from '../utils/rowsBelow';

const rows = [
  { id: 'a' },
  { id: 'b' },
  { id: 'b1', parentId: 'b' },
  { id: 'c' },
  { id: 'c1', parentId: 'c' },
];

test('rowsBelow: every row after this one, in list order', () => {
  assert.deepEqual(rowsBelow(rows, 'a').map(r => r.id), ['b', 'b1', 'c', 'c1']);
});

test('rowsBelow: the row keeps its own variants', () => {
  assert.deepEqual(rowsBelow(rows, 'b').map(r => r.id), ['c', 'c1']);
});

test('rowsBelow: the last row and an unknown id close nothing', () => {
  assert.deepEqual(rowsBelow(rows, 'c1'), []);
  assert.deepEqual(rowsBelow(rows, 'zz'), []);
});
