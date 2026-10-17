/**
 * What `Lovervoid.sidetabs` takes over from `Lovervoid.bays`.
 *
 * The extension is published under the sidetabs id, and `workspaceState` is
 * keyed by extension id: what a Bays user had stored (group names, colours,
 * locks, the per-project view preferences) lives under the old id. The last
 * `Lovervoid.bays` release is an empty shell that hands that state over through
 * our API, and this rule decides which of its entries we keep.
 *
 * The offer comes from another extension, so it is read as `unknown`.
 */

/** Written once the handoff ran in a workspace: one adoption per workspace. */
export const HANDOFF_MARK = 'bays.handoffAdopted';

/** Every key this extension stores carries the prefix; nothing else is ours. */
const OWN_PREFIX = 'bays.';

/**
 * The entries to write, in a stable order.
 *
 * A key already held wins over the offer: anything written under the new id is
 * newer than what the shell kept, so the handoff only ever fills gaps. The mark
 * is never adopted, or a workspace could arrive already marked as done.
 */
export function adoptableEntries(offered: unknown, held: readonly string[]): Array<[string, unknown]> {
  if (typeof offered !== 'object' || offered === null || Array.isArray(offered)) { return []; }
  const taken = new Set(held);
  return Object.entries(offered as Record<string, unknown>)
    .filter(([key, value]) =>
      key.startsWith(OWN_PREFIX) &&
      key !== HANDOFF_MARK &&
      !taken.has(key) &&
      value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
