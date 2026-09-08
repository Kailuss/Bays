// A repository's git state, indexed BY PATH.
//
// The git extension publishes its changes as three LISTS, and the question this
// extension asks is always the other way round: what is happening to this file.
// Answering it by walking the lists costs O(changes) per question, and there is
// one question per tab — so a repository with hundreds of changes costs those
// three lists in full, multiplied by the open tabs, on every git event, with two
// path normalisations per change along the way.
//
// Poured ONCE into a map, each question is a lookup: the walk is paid per
// repository event instead of per tab, which is the same sum the other way
// round — what multiplied now adds.
//
// The rule lives here, pure and with tests, because what it decides is a
// PRECEDENCE — which list wins when a file is in two of them — and getting that
// wrong does not show: it paints one git mark instead of another, and both look
// like a mark.

import * as path from 'path';
import type { GitStatus } from '../models/BayTypes';

/**
 * What the rule needs from one change.
 *
 * Structural rather than the `GitChange` of
 * `services/integration/gitApiTypes.ts`: a pure rule cannot import from
 * `services/`, and only the two paths and the code are ever read.
 */
export type ChangeLike = {
  uri?         : { fsPath?: string } | undefined;
  originalUri? : { fsPath?: string } | undefined;
  status?      : number | undefined;
};

/** A repository's three lists, as the git extension publishes them. */
export type RepoChanges = {
  workingTreeChanges? : readonly ChangeLike[] | undefined;
  indexChanges?       : readonly ChangeLike[] | undefined;
  mergeChanges?       : readonly ChangeLike[] | undefined;
};

/**
 * The shape a path takes to enter the index and to be asked back for.
 *
 * On Windows the comparison ignores case because the filesystem does too: the
 * same path arrives with its drive letter in one case from the git API and in
 * the other from a URI, and compared as-is they never match.
 */
export function normalizeFsPath(fsPath: string | undefined): string | null {
  if (!fsPath) { return null; }
  const normalized = path.normalize(fsPath);
  return path.sep === '\\' ? normalized.toLowerCase() : normalized;
}

/** True when `filePath` is `repoRoot` itself or lives under it. */
export function isPathInsideRepo(filePath: string, repoRoot: string): boolean {
  return filePath === repoRoot || filePath.startsWith(`${repoRoot}${path.sep}`);
}

/**
 * The git extension's status code, translated into what a row draws.
 *
 * The numbers are its `Status` enum, which it does not publish as types: they
 * are written out by hand here and are therefore also the answer to "what breaks
 * if upstream renumbers". An unknown code falls to `modified`, which is the safe
 * direction — saying a file changed when it is not known what happened to it is
 * less wrong than saying it is clean.
 */
export function mapGitApiStatus(status: number | undefined): GitStatus {
  switch (status) {
    case 7: return 'untracked';
    case 1:
    case 9: return 'added';
    case 0:
    case 3:
    case 4:
    case 5:
    case 10:
    case 11:
      return 'modified';
    case 2:
    case 6: return 'deleted';
    case 8: return 'ignored';
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
    case 17:
    case 18:
      return 'conflict';
    default:
      return status === undefined ? null : 'modified';
  }
}

/**
 * A repository's three lists poured into one path → status map.
 *
 * The ORDER of the pour IS the precedence, which is why it is written in one
 * place:
 *
 *  - the INDEX first, which is the weakest;
 *  - the WORKING TREE over it, because what is on disk wins over what was
 *    staged — a file added to the index and then edited reads `modified`, and
 *    that is the state the user is about to touch;
 *  - CONFLICTS last and flat, because an unresolved merge wins over anything
 *    else that might be said about that file.
 *
 * Each change goes in under BOTH of its paths: in a rename `originalUri` is
 * where it came from, and asking for the old path has to keep answering.
 */
export function buildGitIndex(state: RepoChanges | undefined): Map<string, GitStatus> {
  const index = new Map<string, GitStatus>();
  if (!state) { return index; }

  const put = (change: ChangeLike, status: GitStatus): void => {
    if (status === null) { return; }
    const current  = normalizeFsPath(change.uri?.fsPath);
    const original = normalizeFsPath(change.originalUri?.fsPath);
    if (current)  { index.set(current, status); }
    if (original) { index.set(original, status); }
  };

  for (const change of state.indexChanges       ?? []) { put(change, mapGitApiStatus(change.status)); }
  for (const change of state.workingTreeChanges ?? []) { put(change, mapGitApiStatus(change.status)); }
  for (const change of state.mergeChanges       ?? []) { put(change, 'conflict'); }

  return index;
}
