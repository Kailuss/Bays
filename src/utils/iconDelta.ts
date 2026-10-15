/**
 * What of the icon dictionary travels to the client, and when.
 *
 * An icon's markup is a theme `data:` URI counted in kilobytes, keyed by a short
 * key that is stable for the life of the theme (`IconKeyRegistry`). The client
 * keeps the dictionary, so an entry has to cross the wire ONCE per client: every
 * render used to resend all of it — every icon seen in the session, kilobytes
 * each — on every structural change.
 *
 * It is resent whole, as a RESET, exactly when the client cannot have it: a new
 * (or reloaded) webview, or a theme change that re-mints every key from `i0`,
 * where an old entry would draw one icon in place of another.
 */

import type { IconDelta } from '../shared/protocol';
export type { IconDelta };

/** Which dictionary keys the current client already holds. */
export class IconLedger {
  private sent = new Set<string>();
  private resetPending = true;

  /** The entries of `all` the client does not have yet, now counted as sent. */
  take(all: ReadonlyMap<string, string>): IconDelta {
    const entries: Record<string, string> = {};
    for (const [key, html] of all) {
      if (this.sent.has(key)) { continue; }
      entries[key] = html;
      this.sent.add(key);
    }
    const reset = this.resetPending;
    this.resetPending = false;
    return { entries, reset };
  }

  /** The client lost its dictionary, or its keys no longer mean the same. */
  forget(): void {
    this.sent.clear();
    this.resetPending = true;
  }
}

/** The client's side: what its dictionary is after a message. */
export function applyIconDelta(current: Record<string, string>, delta: IconDelta): Record<string, string> {
  return delta.reset ? { ...delta.entries } : { ...current, ...delta.entries };
}

/**
 * Rows grouped by the icon they wait for, so each distinct icon is resolved
 * once: ten `.ts` tabs that missed the cache used to read and encode the same
 * SVG ten times in parallel, because the cache is only written after a read.
 */
export function groupRequests<T>(items: readonly T[], keyOf: (item: T) => string): Array<{ first: T; members: T[] }> {
  const groups = new Map<string, { first: T; members: T[] }>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) { group.members.push(item); }
    else { groups.set(key, { first: item, members: [item] }); }
  }
  return [...groups.values()];
}
