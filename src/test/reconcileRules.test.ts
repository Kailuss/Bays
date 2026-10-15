import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderGroup, orphanedVariants, sameShape, type ShapeFacts } from '../utils/reconcileRules';

// The state is rebuilt from the native tabs on every change. These rules are the
// part of that rebuild that is OURS: what order a group keeps, which variants have
// lost their parent, and when a bay is still the same bay.

const known = (ids: string[], uris: string[] = []) => ({
  byId : new Map(ids.map((id, i) => [id, i])),
  byUri: new Map(uris.map((u, i) => [u, i])),
});

test('orderGroup: keeps the order the panel already had, not the native one', () => {
  // The user dragged c above a; the native strip still says a, b, c.
  const fresh = [
    { id: 'a', nativeIndex: 0 },
    { id: 'b', nativeIndex: 1 },
    { id: 'c', nativeIndex: 2 },
  ];
  assert.deepEqual(orderGroup(fresh, known(['c', 'a', 'b'])), ['c', 'a', 'b']);
});

test('orderGroup: a bay nobody knew goes after the known ones, in native order', () => {
  const fresh = [
    { id: 'new2', nativeIndex: 0 },
    { id: 'a', nativeIndex: 1 },
    { id: 'new1', nativeIndex: 2 },
  ];
  assert.deepEqual(orderGroup(fresh, known(['a'])), ['a', 'new2', 'new1']);
});

test('orderGroup: falls back to the uri when the id moved (a split renumbered the column)', () => {
  // ids embed the column: after closing a split, file:///b-2 became file:///b-1.
  const fresh = [
    { id: 'file:///a-1', uriKey: 'file:///a', nativeIndex: 0 },
    { id: 'file:///b-1', uriKey: 'file:///b', nativeIndex: 1 },
  ];
  const previous = known(['file:///b-2', 'file:///a-2'], ['file:///b', 'file:///a']);
  assert.deepEqual(orderGroup(fresh, previous), ['file:///b-1', 'file:///a-1']);
});

test('orderGroup: an id match wins over a uri match', () => {
  const fresh = [
    { id: 'x', uriKey: 'u1', nativeIndex: 0 },
    { id: 'y', uriKey: 'u2', nativeIndex: 1 },
  ];
  // y is known by id at 0; x only by uri at 0, which ranks it behind every id match.
  const previous = { byId: new Map([['y', 0]]), byUri: new Map([['u1', 0]]) };
  assert.deepEqual(orderGroup(fresh, previous), ['y', 'x']);
});

test('orphanedVariants: a variant whose parent is not open is orphaned', () => {
  const bays = [
    { id: 'readme' },
    { id: 'preview-a', parentId: 'readme' },
    { id: 'preview-b', parentId: 'gone.md' },
  ];
  assert.deepEqual([...orphanedVariants(bays)], ['preview-b']);
});

test('orphanedVariants: a parent that is itself a variant does not count', () => {
  // Nested variants are never drawn, so the child of a variant is an orphan too.
  const bays = [
    { id: 'file' },
    { id: 'diff', parentId: 'file' },
    { id: 'nested', parentId: 'diff' },
  ];
  assert.deepEqual([...orphanedVariants(bays)], ['nested']);
});

const shape = (over: Partial<ShapeFacts> = {}): ShapeFacts => ({
  bayType: 'file', uri: 'file:///a.md', label: 'a.md', ...over,
});

test('sameShape: the same tab is the same bay', () => {
  assert.equal(sameShape(shape(), shape()), true);
});

test('sameShape: a preview that followed another file is a different bay', () => {
  // An unlocked markdown preview retargets with the active editor: its id is the
  // panel's, so only the parent link says it is now another file's preview.
  const before = shape({ bayType: 'webview', uri: undefined, diffType: 'preview', parentId: 'file:///a.md-1', label: 'Preview a.md' });
  const after  = shape({ bayType: 'webview', uri: undefined, diffType: 'preview', parentId: 'file:///b.md-1', label: 'Preview b.md' });
  assert.equal(sameShape(before, after), false);
});

test('sameShape: a webview retitling itself is still the same bay', () => {
  // The title of a panel or terminal is patched in place, never a rebuild.
  const before = shape({ bayType: 'webview', uri: undefined, label: 'Session one' });
  const after  = shape({ bayType: 'webview', uri: undefined, label: 'Session two' });
  assert.equal(sameShape(before, after), true);
});

test('sameShape: a file bay whose label moved is a different bay', () => {
  assert.equal(sameShape(shape(), shape({ label: 'b.md' })), false);
});
