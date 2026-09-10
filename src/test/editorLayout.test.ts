import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countLayoutGroups } from '../utils/editorLayout';

// `vscode.getEditorLayout` describes the window that has OS focus, and so does
// `openEditorAtIndex`. Counting the layout's groups against what the Tab API
// reports is how activation tells one window from several before it acts.

test('countLayoutGroups: a single group', () => {
  assert.equal(countLayoutGroups({ orientation: 0, groups: [{}] }), 1);
});

test('countLayoutGroups: flat splits count one each', () => {
  assert.equal(countLayoutGroups({ orientation: 0, groups: [{ size: 0.5 }, { size: 0.5 }] }), 2);
});

test('countLayoutGroups: nested grids count their leaves', () => {
  const layout = {
    orientation: 0,
    groups: [
      { size: 0.5 },
      { size: 0.5, groups: [{ size: 0.5 }, { size: 0.5, groups: [{}, {}] }] },
    ],
  };
  assert.equal(countLayoutGroups(layout), 4);
});

test('countLayoutGroups: a branch with no children is one group', () => {
  assert.equal(countLayoutGroups({ orientation: 1, groups: [{ groups: [] }] }), 1);
});

test('countLayoutGroups: anything that is not a layout counts zero', () => {
  assert.equal(countLayoutGroups(undefined), 0);
  assert.equal(countLayoutGroups(null), 0);
  assert.equal(countLayoutGroups('layout'), 0);
  assert.equal(countLayoutGroups({ orientation: 0 }), 0);
  assert.equal(countLayoutGroups({ groups: 'nope' }), 0);
});
