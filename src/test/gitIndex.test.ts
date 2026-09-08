import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { buildGitIndex, isPathInsideRepo, mapGitApiStatus, normalizeFsPath } from '../utils/gitIndex';

/** A change as the git extension shapes one, with only what the rule reads. */
const change = (fsPath: string, status: number, originalPath?: string) => ({
  uri        : { fsPath },
  originalUri: originalPath ? { fsPath: originalPath } : undefined,
  status,
});

/** The key a path takes inside the index, so the assertions match the platform. */
const key = (fsPath: string) => normalizeFsPath(fsPath) as string;

const MODIFIED  = 0;
const ADDED     = 1;
const UNTRACKED = 7;

test('an empty repository indexes nothing', () => {
  assert.equal(buildGitIndex(undefined).size, 0);
  assert.equal(buildGitIndex({}).size, 0);
});

test('a working tree change is found by its path', () => {
  const index = buildGitIndex({ workingTreeChanges: [change('/repo/src/a.ts', MODIFIED)] });
  assert.equal(index.get(key('/repo/src/a.ts')), 'modified');
});

test('the WORKING TREE wins over the index', () => {
  // Staged as added and then edited: what the user is about to touch is the
  // edit, so the row has to say `modified` and not `added`.
  const index = buildGitIndex({
    indexChanges      : [change('/repo/a.ts', ADDED)],
    workingTreeChanges: [change('/repo/a.ts', MODIFIED)],
  });
  assert.equal(index.get(key('/repo/a.ts')), 'modified');
});

test('a CONFLICT wins over everything else said about that file', () => {
  const index = buildGitIndex({
    indexChanges      : [change('/repo/a.ts', ADDED)],
    workingTreeChanges: [change('/repo/a.ts', MODIFIED)],
    mergeChanges      : [change('/repo/a.ts', MODIFIED)],
  });
  assert.equal(index.get(key('/repo/a.ts')), 'conflict');
});

test('a rename answers under BOTH of its paths', () => {
  // Asking for where it came from has to keep working: a bay converted before
  // the rename landed still carries the old uri.
  const index = buildGitIndex({
    workingTreeChanges: [change('/repo/new.ts', MODIFIED, '/repo/old.ts')],
  });
  assert.equal(index.get(key('/repo/new.ts')), 'modified');
  assert.equal(index.get(key('/repo/old.ts')), 'modified');
});

test('a file nobody reports is not in the index', () => {
  const index = buildGitIndex({ workingTreeChanges: [change('/repo/a.ts', MODIFIED)] });
  assert.equal(index.get(key('/repo/b.ts')), undefined);
});

test('a change without a path does not put an entry in', () => {
  const index = buildGitIndex({ workingTreeChanges: [{ status: MODIFIED }] });
  assert.equal(index.size, 0);
});

test('every status code maps to what the row draws', () => {
  assert.equal(mapGitApiStatus(UNTRACKED), 'untracked');
  assert.equal(mapGitApiStatus(ADDED), 'added');
  assert.equal(mapGitApiStatus(MODIFIED), 'modified');
  assert.equal(mapGitApiStatus(2), 'deleted');
  assert.equal(mapGitApiStatus(8), 'ignored');
  assert.equal(mapGitApiStatus(12), 'conflict');
  // Nothing said, nothing to draw.
  assert.equal(mapGitApiStatus(undefined), null);
  // An unknown code falls to `modified`: saying a file changed when it is not
  // known what happened is less wrong than saying it is clean.
  assert.equal(mapGitApiStatus(999), 'modified');
});

test('containment is by SEGMENT, so a sibling with a shared prefix is out', () => {
  const root = key('/repo');
  assert.ok(isPathInsideRepo(root, root));
  assert.ok(isPathInsideRepo(key('/repo/src/a.ts'), root));
  // `/repository` starts with `/repo` and is a different tree.
  assert.equal(isPathInsideRepo(key('/repository/a.ts'), root), false);
});

test('normalising is case-folding only where the filesystem folds', () => {
  const folded = path.sep === '\\';
  const a = normalizeFsPath('/Repo/A.ts');
  const b = normalizeFsPath('/repo/a.ts');
  assert.equal(a === b, folded);
  assert.equal(normalizeFsPath(undefined), null);
  assert.equal(normalizeFsPath(''), null);
});
