/**
 * The rules of the RECONCILE, as pure functions.
 *
 * The bay state is not patched event by event: every tab change rebuilds it from
 * `vscode.window.tabGroups`, which is the only thing that is never wrong about
 * what is open. Patching was the source of every drift this view had: four
 * handlers with awaits between them, each one a chance to apply a delta to a
 * state that had already moved, and nothing that ever corrected the result.
 *
 * What a rebuild cannot read from the native tabs is what the PANEL owns, and
 * that is what lives here: the order the user dragged a group into, which
 * variants have lost the row they hang from, and when a freshly converted bay is
 * still the bay already on screen (so its object, and what other services wrote
 * on it, survive).
 */

/** Where a bay sat before this rebuild, by id and by uri. */
export type PreviousOrder = {
  byId : ReadonlyMap<string, number>;
  byUri: ReadonlyMap<string, number>;
};

/** One freshly converted bay, as far as ordering is concerned. */
export type OrderFacts = {
  id         : string;
  uriKey?    : string;
  nativeIndex: number;
};

/**
 * The order a group keeps after a rebuild.
 *
 * A bay the panel already had keeps its slot, matched by id first and by uri
 * second: ids embed the column, so a split opening or closing renames every id
 * in the groups it renumbers, and the uri is what still says it is the same
 * file. Anything the panel never had goes after, in the order the native strip
 * gives it — which is where a newly opened tab has always landed here.
 */
export function orderGroup(fresh: readonly OrderFacts[], previous: PreviousOrder): string[] {
  // Id matches rank before uri matches before unknowns; inside each band the
  // previous slot (or the native index) decides. Three bands, so a uri match can
  // never jump ahead of a bay that was found by its exact id.
  const rank = (bay: OrderFacts): [number, number] => {
    const byId = previous.byId.get(bay.id);
    if (byId !== undefined) { return [0, byId]; }
    const byUri = bay.uriKey === undefined ? undefined : previous.byUri.get(bay.uriKey);
    if (byUri !== undefined) { return [1, byUri]; }
    return [2, bay.nativeIndex];
  };
  return [...fresh]
    .map(bay => ({ bay, r: rank(bay) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.bay.nativeIndex - b.bay.nativeIndex)
    .map(({ bay }) => bay.id);
}

/**
 * The variants whose parent is not a ROOT bay that is open right now.
 *
 * A variant is drawn under its parent row, so one without it would be a row
 * under nothing. These are demoted to root bays — drawn, never dropped, and never
 * answered by opening the parent behind the user's back: the native tabs say the
 * parent is closed, and that is what the panel shows.
 */
export function orphanedVariants(bays: readonly { id: string; parentId?: string }[]): Set<string> {
  const roots = new Set(bays.filter(b => !b.parentId).map(b => b.id));
  const orphans = new Set<string>();
  for (const bay of bays) {
    if (bay.parentId && !roots.has(bay.parentId)) { orphans.add(bay.id); }
  }
  return orphans;
}

/** The parts of a bay that say WHICH bay it is, as plain strings. */
export type ShapeFacts = {
  bayType     : string;
  uri?        : string;
  originalUri?: string;
  label       : string;
  detailLabel?: string;
  diffType?   : string;
  parentId?   : string;
  viewType?   : string;
};

/**
 * Whether a fresh conversion is still the bay already in state, so the old
 * object can be kept and only its native flags patched.
 *
 * The LABEL of a webview or a terminal is left out: those rewrite their own
 * title at runtime (a shell, a Claude Code session) and the id does not derive
 * from it, so a new title is a patch in place and not a new bay. Everything else
 * that differs — a preview now following another file, a diff whose sides moved
 * — is a different bay, rebuilt and redrawn.
 */
export function sameShape(a: ShapeFacts, b: ShapeFacts): boolean {
  const retitles = a.bayType === 'webview' || a.bayType === 'terminal';
  return a.bayType     === b.bayType
      && a.uri         === b.uri
      && a.originalUri === b.originalUri
      && a.detailLabel === b.detailLabel
      && a.diffType    === b.diffType
      && a.parentId    === b.parentId
      && a.viewType    === b.viewType
      && (retitles || a.label === b.label);
}
